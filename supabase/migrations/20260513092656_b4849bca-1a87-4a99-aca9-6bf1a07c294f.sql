
-- 1. Allow ingredients to be marked as prep items (Base Gravy, etc.)
ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS is_prep boolean NOT NULL DEFAULT false;

-- 2. Prep recipes: a recipe that produces a prep ingredient batch
CREATE TABLE IF NOT EXISTS public.prep_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_ingredient_id uuid NOT NULL,
  name text NOT NULL,
  output_quantity numeric NOT NULL DEFAULT 1,
  output_unit text NOT NULL DEFAULT 'kg',
  notes text,
  branch_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prep_ingredient_id)
);

CREATE TABLE IF NOT EXISTS public.prep_recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_recipe_id uuid NOT NULL REFERENCES public.prep_recipes(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kg'
);

CREATE TABLE IF NOT EXISTS public.prep_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_ingredient_id uuid NOT NULL,
  prep_recipe_id uuid,
  batch_quantity numeric NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  expiry_date date,
  notes text,
  branch_id uuid,
  prepared_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prep_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prep_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prep_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read prep recipes" ON public.prep_recipes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers+ manage prep recipes" ON public.prep_recipes
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager']::app_role[]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager']::app_role[]));

CREATE POLICY "Authenticated read prep recipe lines" ON public.prep_recipe_ingredients
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers+ manage prep recipe lines" ON public.prep_recipe_ingredients
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager']::app_role[]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager']::app_role[]));

CREATE POLICY "Authenticated read prep batches" ON public.prep_batches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff+ manage prep batches" ON public.prep_batches
  FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager','employee']::app_role[]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager','employee']::app_role[]));

CREATE TRIGGER trg_prep_recipes_updated
  BEFORE UPDATE ON public.prep_recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Fix inventory deduction trigger to allow negative balances and prevent double-deduction.
-- Key changes:
--   * Remove GREATEST(0, ...) clamp so stock can go negative.
--   * Skip if order was previously completed (avoid double-deduct on reopen->complete).
--   * Track via stock_transactions either way for accurate consumption.
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_order_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item RECORD;
  recipe_line RECORD;
  ing RECORD;
  deduct_qty NUMERIC;
  updated_stock NUMERIC;
  threshold_value NUMERIC;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  FOR item IN
    SELECT oi.id, oi.menu_item_id, oi.quantity, oi.item_name, oi.is_void, oi.is_nc, oi.is_refunded
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.menu_item_id IS NOT NULL
      AND COALESCE(oi.is_void, false) = false
      AND COALESCE(oi.is_refunded, false) = false
  LOOP
    FOR recipe_line IN
      SELECT ri.ingredient_id, ri.quantity, ri.unit
      FROM public.recipe_ingredients ri
      WHERE ri.menu_item_id = item.menu_item_id
    LOOP
      deduct_qty := COALESCE(recipe_line.quantity, 0) * COALESCE(item.quantity, 0);
      IF deduct_qty <= 0 THEN CONTINUE; END IF;

      SELECT i.id, i.name, i.current_stock, i.min_threshold, i.cost_per_unit,
             i.unit, i.category, i.branch_id, i.expiry_date
      INTO ing
      FROM public.ingredients i
      WHERE i.id = recipe_line.ingredient_id;
      IF NOT FOUND THEN CONTINUE; END IF;

      -- Allow negative balances (no clamp); PO receive will backfill later
      UPDATE public.ingredients
      SET current_stock = COALESCE(current_stock, 0) - deduct_qty,
          status = CASE
            WHEN expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE THEN 'expired'
            WHEN COALESCE(current_stock, 0) - deduct_qty <= 0 THEN 'out'
            WHEN COALESCE(current_stock, 0) - deduct_qty <= COALESCE(min_threshold, 0) THEN 'low'
            WHEN expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + 7 THEN 'expiring'
            ELSE 'good'
          END,
          updated_at = now()
      WHERE id = ing.id
      RETURNING current_stock, min_threshold INTO updated_stock, threshold_value;

      INSERT INTO public.stock_transactions (
        ingredient_id, type, quantity, unit, unit_cost, total_cost,
        reference_id, reference_type, branch_id, created_by, notes
      ) VALUES (
        ing.id, 'out', deduct_qty, COALESCE(recipe_line.unit, ing.unit),
        COALESCE(ing.cost_per_unit, 0), deduct_qty * COALESCE(ing.cost_per_unit, 0),
        NEW.id, 'order', COALESCE(NEW.branch_id, ing.branch_id), NEW.created_by,
        CONCAT('Sold: "', item.item_name, '" x', item.quantity, ' on order #', NEW.order_number)
      );

      IF updated_stock <= 0 THEN
        INSERT INTO public.stock_alerts (ingredient_id, ingredient_name, type, message, branch_id)
        SELECT ing.id, ing.name, 'out_of_stock',
          CASE WHEN updated_stock < 0
            THEN CONCAT(ing.name, ' is at ', updated_stock, ' ', ing.unit, ' (negative — needs restock)')
            ELSE CONCAT(ing.name, ' is out of stock')
          END,
          COALESCE(NEW.branch_id, ing.branch_id)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.stock_alerts sa
          WHERE sa.ingredient_id = ing.id AND sa.type = 'out_of_stock' AND sa.resolved = false
            AND sa.branch_id IS NOT DISTINCT FROM COALESCE(NEW.branch_id, ing.branch_id)
        );
      ELSIF updated_stock <= COALESCE(threshold_value, 0) THEN
        INSERT INTO public.stock_alerts (ingredient_id, ingredient_name, type, message, branch_id)
        SELECT ing.id, ing.name, 'low_stock', CONCAT(ing.name, ' is below threshold'), COALESCE(NEW.branch_id, ing.branch_id)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.stock_alerts sa
          WHERE sa.ingredient_id = ing.id AND sa.type = 'low_stock' AND sa.resolved = false
            AND sa.branch_id IS NOT DISTINCT FROM COALESCE(NEW.branch_id, ing.branch_id)
        );
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'deduct_inventory_on_order_complete error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;

-- Ensure trigger exists (in case it never was attached)
DROP TRIGGER IF EXISTS trg_deduct_inventory_on_order_complete ON public.orders;
CREATE TRIGGER trg_deduct_inventory_on_order_complete
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.deduct_inventory_on_order_complete();
