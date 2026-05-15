CREATE OR REPLACE FUNCTION public.run_inventory_deduction_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ing_id uuid := gen_random_uuid();
  cat_id uuid := gen_random_uuid();
  menu_id uuid := gen_random_uuid();
  order_id uuid := gen_random_uuid();
  start_stock numeric := 100;
  recipe_qty numeric := 0.25;
  order_qty int := 4;
  expected numeric;
  final_stock numeric;
  passed boolean;
BEGIN
  expected := start_stock - (recipe_qty * order_qty);

  INSERT INTO public.ingredients (id, name, unit, current_stock, min_threshold, cost_per_unit, status)
  VALUES (ing_id, '__test_ing_' || ing_id, 'kg', start_stock, 0, 10, 'good');

  INSERT INTO public.menu_categories (id, name, sort_order, is_active)
  VALUES (cat_id, '__test_cat_' || cat_id, 999, false);

  INSERT INTO public.menu_items (id, name, category_id, selling_price, cost_price, is_active, is_available)
  VALUES (menu_id, '__test_item_' || menu_id, cat_id, 100, 5, false, false);

  INSERT INTO public.recipe_ingredients (menu_item_id, ingredient_id, quantity, unit)
  VALUES (menu_id, ing_id, recipe_qty, 'kg');

  INSERT INTO public.orders (id, status, subtotal, tax, total, payment_mode, order_type, order_source)
  VALUES (order_id, 'new', 400, 0, 400, 'cash', 'dine_in', 'pos');

  INSERT INTO public.order_items (order_id, menu_item_id, item_name, quantity, unit_price, total_price)
  VALUES (order_id, menu_id, '__test_item', order_qty, 100, 400);

  UPDATE public.orders SET status = 'completed', completed_at = now() WHERE id = order_id;

  SELECT current_stock INTO final_stock FROM public.ingredients WHERE id = ing_id;
  passed := final_stock = expected;

  -- cleanup
  DELETE FROM public.stock_transactions WHERE ingredient_id = ing_id;
  DELETE FROM public.stock_alerts WHERE ingredient_id = ing_id;
  DELETE FROM public.order_items WHERE order_id = order_id;
  DELETE FROM public.orders WHERE id = order_id;
  DELETE FROM public.recipe_ingredients WHERE menu_item_id = menu_id;
  DELETE FROM public.menu_items WHERE id = menu_id;
  DELETE FROM public.menu_categories WHERE id = cat_id;
  DELETE FROM public.ingredients WHERE id = ing_id;

  RETURN jsonb_build_object(
    'passed', passed,
    'start_stock', start_stock,
    'expected_final', expected,
    'actual_final', final_stock,
    'recipe_qty', recipe_qty,
    'order_qty', order_qty
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_inventory_deduction_check() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.run_inventory_deduction_check() TO authenticated;