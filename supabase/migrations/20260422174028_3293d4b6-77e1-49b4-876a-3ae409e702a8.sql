CREATE OR REPLACE FUNCTION public.deduct_inventory_on_order_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    SELECT
      oi.id,
      oi.menu_item_id,
      oi.quantity,
      oi.item_name,
      oi.is_void,
      oi.is_nc,
      oi.is_refunded,
      oi.void_reason,
      oi.nc_reason,
      oi.refund_reason
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.menu_item_id IS NOT NULL
  LOOP
    FOR recipe_line IN
      SELECT ri.ingredient_id, ri.quantity, ri.unit
      FROM public.recipe_ingredients ri
      WHERE ri.menu_item_id = item.menu_item_id
    LOOP
      deduct_qty := COALESCE(recipe_line.quantity, 0) * COALESCE(item.quantity, 0);

      IF deduct_qty <= 0 THEN
        CONTINUE;
      END IF;

      SELECT
        i.id,
        i.name,
        i.current_stock,
        i.min_threshold,
        i.cost_per_unit,
        i.unit,
        i.category,
        i.branch_id,
        i.expiry_date
      INTO ing
      FROM public.ingredients i
      WHERE i.id = recipe_line.ingredient_id;

      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      UPDATE public.ingredients
      SET
        current_stock = GREATEST(0, COALESCE(current_stock, 0) - deduct_qty),
        status = CASE
          WHEN GREATEST(0, COALESCE(current_stock, 0) - deduct_qty) <= 0 THEN 'out'
          WHEN GREATEST(0, COALESCE(current_stock, 0) - deduct_qty) <= COALESCE(min_threshold, 0) THEN 'low'
          WHEN expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + 7 THEN 'expiring'
          ELSE 'good'
        END,
        updated_at = now()
      WHERE id = ing.id
      RETURNING current_stock, min_threshold INTO updated_stock, threshold_value;

      IF item.is_void OR item.is_refunded THEN
        INSERT INTO public.wastage_logs (
          ingredient_id,
          ingredient_name,
          category,
          quantity,
          unit,
          cost,
          reason,
          notes,
          branch_id,
          logged_by
        ) VALUES (
          ing.id,
          ing.name,
          ing.category,
          deduct_qty,
          COALESCE(recipe_line.unit, ing.unit),
          deduct_qty * COALESCE(ing.cost_per_unit, 0),
          CASE WHEN item.is_void THEN 'spoiled' ELSE 'discrepancy' END,
          CONCAT(
            'Auto: ',
            CASE WHEN item.is_void THEN 'Voided' ELSE 'Refunded' END,
            ' item "', item.item_name, '" on order #', NEW.order_number,
            COALESCE(' - ' || item.void_reason, ''),
            COALESCE(' - ' || item.refund_reason, '')
          ),
          COALESCE(NEW.branch_id, ing.branch_id),
          NEW.created_by
        );
      ELSE
        INSERT INTO public.stock_transactions (
          ingredient_id,
          type,
          quantity,
          unit,
          unit_cost,
          total_cost,
          reference_id,
          reference_type,
          branch_id,
          created_by,
          notes
        ) VALUES (
          ing.id,
          'out',
          deduct_qty,
          COALESCE(recipe_line.unit, ing.unit),
          COALESCE(ing.cost_per_unit, 0),
          deduct_qty * COALESCE(ing.cost_per_unit, 0),
          NEW.id,
          'order',
          COALESCE(NEW.branch_id, ing.branch_id),
          NEW.created_by,
          CONCAT('Sold: "', item.item_name, '" x', item.quantity, ' on order #', NEW.order_number)
        );
      END IF;

      IF updated_stock <= 0 THEN
        INSERT INTO public.stock_alerts (ingredient_id, ingredient_name, type, message, branch_id)
        SELECT
          ing.id,
          ing.name,
          'out_of_stock',
          CONCAT(ing.name, ' is out of stock'),
          COALESCE(NEW.branch_id, ing.branch_id)
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.stock_alerts sa
          WHERE sa.ingredient_id = ing.id
            AND sa.type = 'out_of_stock'
            AND sa.resolved = false
            AND sa.branch_id IS NOT DISTINCT FROM COALESCE(NEW.branch_id, ing.branch_id)
        );
      ELSIF updated_stock <= COALESCE(threshold_value, 0) THEN
        INSERT INTO public.stock_alerts (ingredient_id, ingredient_name, type, message, branch_id)
        SELECT
          ing.id,
          ing.name,
          'low_stock',
          CONCAT(ing.name, ' is below threshold'),
          COALESCE(NEW.branch_id, ing.branch_id)
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.stock_alerts sa
          WHERE sa.ingredient_id = ing.id
            AND sa.type = 'low_stock'
            AND sa.resolved = false
            AND sa.branch_id IS NOT DISTINCT FROM COALESCE(NEW.branch_id, ing.branch_id)
        );
      END IF;
    END LOOP;
  END LOOP;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'deduct_inventory_on_order_complete error: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deduct_inventory_on_order_complete ON public.orders;

CREATE TRIGGER trg_deduct_inventory_on_order_complete
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.deduct_inventory_on_order_complete();