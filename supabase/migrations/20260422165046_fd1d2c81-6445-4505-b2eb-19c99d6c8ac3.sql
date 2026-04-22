
-- Trigger to deduct ingredients from inventory and log wastage when orders complete

CREATE OR REPLACE FUNCTION public.deduct_inventory_on_order_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
  recipe_line RECORD;
  deduct_qty NUMERIC;
  ing RECORD;
BEGIN
  -- Only fire when status transitions TO completed
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    
    FOR item IN
      SELECT oi.id, oi.menu_item_id, oi.quantity, oi.item_name, oi.unit_price,
             oi.is_void, oi.is_nc, oi.is_refunded, oi.void_reason, oi.nc_reason, oi.refund_reason
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id AND oi.menu_item_id IS NOT NULL
    LOOP
      FOR recipe_line IN
        SELECT ri.ingredient_id, ri.quantity AS recipe_qty, ri.unit
        FROM public.recipe_ingredients ri
        WHERE ri.menu_item_id = item.menu_item_id
      LOOP
        deduct_qty := recipe_line.recipe_qty * item.quantity;

        SELECT id, name, current_stock, cost_per_unit, unit, category, branch_id
        INTO ing
        FROM public.ingredients
        WHERE id = recipe_line.ingredient_id;

        IF NOT FOUND THEN CONTINUE; END IF;

        IF item.is_void OR item.is_refunded THEN
          -- Wastage: still deduct stock + log wastage
          UPDATE public.ingredients
          SET current_stock = GREATEST(0, current_stock - deduct_qty),
              updated_at = now()
          WHERE id = ing.id;

          INSERT INTO public.wastage_logs (
            ingredient_id, ingredient_name, category, quantity, unit, cost,
            reason, notes, branch_id, logged_by
          ) VALUES (
            ing.id, ing.name, ing.category, deduct_qty, recipe_line.unit,
            deduct_qty * ing.cost_per_unit,
            CASE WHEN item.is_void THEN 'spoiled' ELSE 'discrepancy' END,
            CONCAT('Auto: ', CASE WHEN item.is_void THEN 'Voided' ELSE 'Refunded' END,
                   ' item "', item.item_name, '" on order #', NEW.order_number,
                   COALESCE(' - ' || item.void_reason, ''),
                   COALESCE(' - ' || item.refund_reason, '')),
            NEW.branch_id, NEW.created_by
          );
        ELSIF item.is_nc THEN
          -- NC: deduct stock, no wastage (consumed but not charged)
          UPDATE public.ingredients
          SET current_stock = GREATEST(0, current_stock - deduct_qty),
              updated_at = now()
          WHERE id = ing.id;
        ELSE
          -- Normal sold item: deduct stock + log txn
          UPDATE public.ingredients
          SET current_stock = GREATEST(0, current_stock - deduct_qty),
              updated_at = now()
          WHERE id = ing.id;

          INSERT INTO public.stock_transactions (
            ingredient_id, type, quantity, unit, unit_cost, total_cost,
            reference_id, reference_type, branch_id, created_by, notes
          ) VALUES (
            ing.id, 'out', deduct_qty, recipe_line.unit, ing.cost_per_unit,
            deduct_qty * ing.cost_per_unit,
            NEW.id, 'order', NEW.branch_id, NEW.created_by,
            CONCAT('Sold: "', item.item_name, '" x', item.quantity, ' on order #', NEW.order_number)
          );
        END IF;

        -- Auto-create low stock alert
        SELECT current_stock, min_threshold INTO ing.current_stock, ing.min_threshold
        FROM public.ingredients WHERE id = recipe_line.ingredient_id;

        IF ing.current_stock <= 0 THEN
          INSERT INTO public.stock_alerts (ingredient_id, ingredient_name, type, message, branch_id)
          SELECT recipe_line.ingredient_id, ing.name, 'out_of_stock',
                 CONCAT(ing.name, ' is out of stock'), NEW.branch_id
          WHERE NOT EXISTS (
            SELECT 1 FROM public.stock_alerts
            WHERE ingredient_id = recipe_line.ingredient_id AND resolved = false AND type = 'out_of_stock'
          );
        ELSIF ing.current_stock <= COALESCE(ing.min_threshold, 0) THEN
          INSERT INTO public.stock_alerts (ingredient_id, ingredient_name, type, message, branch_id)
          SELECT recipe_line.ingredient_id, ing.name, 'low_stock',
                 CONCAT(ing.name, ' is below threshold'), NEW.branch_id
          WHERE NOT EXISTS (
            SELECT 1 FROM public.stock_alerts
            WHERE ingredient_id = recipe_line.ingredient_id AND resolved = false AND type = 'low_stock'
          );
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'deduct_inventory_on_order_complete error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deduct_inventory_on_complete ON public.orders;
CREATE TRIGGER trg_deduct_inventory_on_complete
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_inventory_on_order_complete();
