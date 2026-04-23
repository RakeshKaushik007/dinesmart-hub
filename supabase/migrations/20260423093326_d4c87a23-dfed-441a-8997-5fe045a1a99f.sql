
-- Update inventory deduction trigger to set 'expired' when expiry_date is in the past
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

      UPDATE public.ingredients
      SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - deduct_qty),
          status = CASE
            WHEN expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE THEN 'expired'
            WHEN GREATEST(0, COALESCE(current_stock, 0) - deduct_qty) <= 0 THEN 'out'
            WHEN GREATEST(0, COALESCE(current_stock, 0) - deduct_qty) <= COALESCE(min_threshold, 0) THEN 'low'
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
        SELECT ing.id, ing.name, 'out_of_stock', CONCAT(ing.name, ' is out of stock'), COALESCE(NEW.branch_id, ing.branch_id)
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

-- Backfill: any ingredient already past its expiry_date should be marked 'expired'
UPDATE public.ingredients
SET status = 'expired', updated_at = now()
WHERE expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE;
