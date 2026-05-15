-- 1) Attach the inventory deduction trigger (function exists but was never wired up)
DROP TRIGGER IF EXISTS trg_deduct_inventory ON public.orders;
CREATE TRIGGER trg_deduct_inventory
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.deduct_inventory_on_order_complete();

-- 2) Aggregator out-of-stock flag on menu items
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS aggregator_out_of_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aggregator_out_of_stock_at timestamptz;

-- 3) Auto-disable menu items + flag aggregator OOS when an ingredient hits zero
CREATE OR REPLACE FUNCTION public.disable_menu_items_on_stockout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_stock <= 0 AND COALESCE(OLD.current_stock, 0) > 0 THEN
    UPDATE public.menu_items mi
    SET is_available = false,
        aggregator_out_of_stock = true,
        aggregator_out_of_stock_at = now(),
        updated_at = now()
    WHERE mi.is_available = true
      AND mi.id IN (
        SELECT ri.menu_item_id FROM public.recipe_ingredients ri WHERE ri.ingredient_id = NEW.id
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_disable_menu_on_stockout ON public.ingredients;
CREATE TRIGGER trg_disable_menu_on_stockout
AFTER UPDATE OF current_stock ON public.ingredients
FOR EACH ROW
EXECUTE FUNCTION public.disable_menu_items_on_stockout();

-- 4) Expiry scanner — creates 'expiring' alerts and marks past-expiry as 'expired'
CREATE OR REPLACE FUNCTION public.scan_expiry_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.stock_alerts (ingredient_id, ingredient_name, type, message, branch_id)
  SELECT i.id, i.name, 'expiring',
    CASE WHEN i.expiry_date < CURRENT_DATE
      THEN i.name || ' expired on ' || i.expiry_date
      ELSE i.name || ' expires on ' || i.expiry_date
    END,
    i.branch_id
  FROM public.ingredients i
  WHERE i.expiry_date IS NOT NULL
    AND i.expiry_date <= CURRENT_DATE + 7
    AND NOT EXISTS (
      SELECT 1 FROM public.stock_alerts sa
      WHERE sa.ingredient_id = i.id
        AND sa.type = 'expiring'
        AND sa.resolved = false
    );

  UPDATE public.ingredients
  SET status = 'expired', updated_at = now()
  WHERE expiry_date IS NOT NULL
    AND expiry_date < CURRENT_DATE
    AND status <> 'expired';
END;
$$;

-- 5) Expiry vs consumption report (last N days, default 30)
CREATE OR REPLACE FUNCTION public.expiry_consumption_report(_days int DEFAULT 30)
RETURNS TABLE(
  ingredient_id uuid,
  ingredient_name text,
  is_prep boolean,
  unit text,
  consumed_qty numeric,
  consumed_cost numeric,
  expired_qty numeric,
  expired_cost numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH consumed AS (
    SELECT ingredient_id,
           SUM(quantity) AS qty,
           SUM(total_cost) AS cost
    FROM public.stock_transactions
    WHERE type = 'out'
      AND reference_type IN ('order', 'prep_batch')
      AND created_at >= now() - make_interval(days => _days)
    GROUP BY ingredient_id
  ),
  expired AS (
    SELECT ingredient_id,
           SUM(quantity) AS qty,
           SUM(cost) AS cost
    FROM public.wastage_logs
    WHERE lower(reason) IN ('expired', 'expiry')
      AND created_at >= now() - make_interval(days => _days)
    GROUP BY ingredient_id
  )
  SELECT i.id, i.name, i.is_prep, i.unit,
         COALESCE(c.qty, 0), COALESCE(c.cost, 0),
         COALESCE(e.qty, 0), COALESCE(e.cost, 0)
  FROM public.ingredients i
  LEFT JOIN consumed c ON c.ingredient_id = i.id
  LEFT JOIN expired  e ON e.ingredient_id = i.id
  WHERE COALESCE(c.qty, 0) > 0 OR COALESCE(e.qty, 0) > 0
  ORDER BY i.name;
$$;

GRANT EXECUTE ON FUNCTION public.scan_expiry_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expiry_consumption_report(int) TO authenticated;