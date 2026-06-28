-- Expand branch lookup beyond direct role assignments so owners can access branches
-- belonging to restaurants they own, while managers/employees remain scoped to assigned branches.
CREATE OR REPLACE FUNCTION public.get_user_branch_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT branch_id), '{}'::uuid[])
  FROM (
    SELECT ur.branch_id
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND COALESCE(ur.is_active, true) = true
      AND ur.branch_id IS NOT NULL

    UNION

    SELECT b.id AS branch_id
    FROM public.branches b
    JOIN public.restaurants r ON r.id = b.restaurant_id
    WHERE r.owner_user_id = _user_id
      AND COALESCE(r.is_active, true) = true
      AND COALESCE(b.is_active, true) = true

    UNION

    SELECT b.id AS branch_id
    FROM public.branches b
    WHERE b.manager_user_id = _user_id
      AND COALESCE(b.is_active, true) = true
  ) accessible;
$$;

CREATE OR REPLACE FUNCTION public.can_access_branch(_branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
    OR (_branch_id IS NOT NULL AND _branch_id = ANY(public.get_user_branch_ids(auth.uid())));
$$;

CREATE OR REPLACE FUNCTION public.can_access_order(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = _order_id
        AND o.branch_id = ANY(public.get_user_branch_ids(auth.uid()))
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_menu_item(_menu_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
    OR EXISTS (
      SELECT 1
      FROM public.menu_items mi
      WHERE mi.id = _menu_item_id
        AND mi.branch_id = ANY(public.get_user_branch_ids(auth.uid()))
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_ingredient(_ingredient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
    OR EXISTS (
      SELECT 1
      FROM public.ingredients i
      WHERE i.id = _ingredient_id
        AND i.branch_id = ANY(public.get_user_branch_ids(auth.uid()))
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_prep_recipe(_prep_recipe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
    OR EXISTS (
      SELECT 1
      FROM public.prep_recipes pr
      WHERE pr.id = _prep_recipe_id
        AND pr.branch_id = ANY(public.get_user_branch_ids(auth.uid()))
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_purchase_order(_purchase_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
    OR EXISTS (
      SELECT 1
      FROM public.purchase_orders po
      WHERE po.id = _purchase_order_id
        AND po.branch_id = ANY(public.get_user_branch_ids(auth.uid()))
    );
$$;

-- Auto-assign branch_id on insert when the caller has exactly one accessible branch.
CREATE OR REPLACE FUNCTION public.auto_assign_branch_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  branches uuid[];
BEGIN
  IF NEW.branch_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  branches := public.get_user_branch_ids(auth.uid());
  IF array_length(branches, 1) = 1 THEN
    NEW.branch_id := branches[1];
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_assign_menu_categories_branch ON public.menu_categories;
CREATE TRIGGER auto_assign_menu_categories_branch
BEFORE INSERT ON public.menu_categories
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_branch_id();

DROP TRIGGER IF EXISTS auto_assign_menu_items_branch ON public.menu_items;
CREATE TRIGGER auto_assign_menu_items_branch
BEFORE INSERT ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_branch_id();

DROP TRIGGER IF EXISTS auto_assign_ingredients_branch ON public.ingredients;
CREATE TRIGGER auto_assign_ingredients_branch
BEFORE INSERT ON public.ingredients
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_branch_id();

DROP TRIGGER IF EXISTS auto_assign_restaurant_tables_branch ON public.restaurant_tables;
CREATE TRIGGER auto_assign_restaurant_tables_branch
BEFORE INSERT ON public.restaurant_tables
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_branch_id();

DROP TRIGGER IF EXISTS auto_assign_payment_methods_branch ON public.payment_methods;
CREATE TRIGGER auto_assign_payment_methods_branch
BEFORE INSERT ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_branch_id();

DROP TRIGGER IF EXISTS auto_assign_stock_alerts_branch ON public.stock_alerts;
CREATE TRIGGER auto_assign_stock_alerts_branch
BEFORE INSERT ON public.stock_alerts
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_branch_id();

DROP TRIGGER IF EXISTS auto_assign_stock_transactions_branch ON public.stock_transactions;
CREATE TRIGGER auto_assign_stock_transactions_branch
BEFORE INSERT ON public.stock_transactions
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_branch_id();

DROP TRIGGER IF EXISTS auto_assign_prep_recipes_branch ON public.prep_recipes;
CREATE TRIGGER auto_assign_prep_recipes_branch
BEFORE INSERT ON public.prep_recipes
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_branch_id();

DROP TRIGGER IF EXISTS auto_assign_prep_batches_branch ON public.prep_batches;
CREATE TRIGGER auto_assign_prep_batches_branch
BEFORE INSERT ON public.prep_batches
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_branch_id();

DROP TRIGGER IF EXISTS auto_assign_purchase_orders_branch ON public.purchase_orders;
CREATE TRIGGER auto_assign_purchase_orders_branch
BEFORE INSERT ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_branch_id();

DROP TRIGGER IF EXISTS auto_assign_wastage_logs_branch ON public.wastage_logs;
CREATE TRIGGER auto_assign_wastage_logs_branch
BEFORE INSERT ON public.wastage_logs
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_branch_id();

DROP TRIGGER IF EXISTS auto_assign_orders_branch ON public.orders;
CREATE TRIGGER auto_assign_orders_branch
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_branch_id();

-- Menu categories
DROP POLICY IF EXISTS "Anon can view active categories" ON public.menu_categories;
DROP POLICY IF EXISTS "Authenticated can view active categories" ON public.menu_categories;
DROP POLICY IF EXISTS "Admins manage categories" ON public.menu_categories;
CREATE POLICY "Authenticated can view active categories"
ON public.menu_categories
FOR SELECT
TO authenticated
USING (is_active = true AND public.can_access_branch(branch_id));
CREATE POLICY "Managers can manage own branch categories"
ON public.menu_categories
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
);

-- Menu items
DROP POLICY IF EXISTS "Anon can view active menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Authenticated can view menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Admins manage menu items" ON public.menu_items;
CREATE POLICY "Authenticated can view menu items"
ON public.menu_items
FOR SELECT
TO authenticated
USING (public.can_access_branch(branch_id));
CREATE POLICY "Managers can manage own branch menu items"
ON public.menu_items
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
);

-- Ingredients
DROP POLICY IF EXISTS "Authenticated can view ingredients" ON public.ingredients;
DROP POLICY IF EXISTS "Managers+ manage ingredients" ON public.ingredients;
CREATE POLICY "Authenticated can view ingredients"
ON public.ingredients
FOR SELECT
TO authenticated
USING (public.can_access_branch(branch_id));
CREATE POLICY "Managers can manage own branch ingredients"
ON public.ingredients
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
);

-- Tables
DROP POLICY IF EXISTS "Anon can view tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Anon can update table status" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Authenticated can view tables" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Employees can update table status" ON public.restaurant_tables;
DROP POLICY IF EXISTS "Managers+ manage tables" ON public.restaurant_tables;
CREATE POLICY "Authenticated can view own branch tables"
ON public.restaurant_tables
FOR SELECT
TO authenticated
USING (public.can_access_branch(branch_id));
CREATE POLICY "Staff can update own branch table status"
ON public.restaurant_tables
FOR UPDATE
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role, 'employee'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role, 'employee'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
);
CREATE POLICY "Managers can manage own branch tables"
ON public.restaurant_tables
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
);

-- Payment methods
DROP POLICY IF EXISTS "Authenticated can view active payment methods" ON public.payment_methods;
DROP POLICY IF EXISTS "Managers+ manage payment methods" ON public.payment_methods;
CREATE POLICY "Authenticated can view own branch payment methods"
ON public.payment_methods
FOR SELECT
TO authenticated
USING (is_active = true AND public.can_access_branch(branch_id));
CREATE POLICY "Managers can manage own branch payment methods"
ON public.payment_methods
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
);

-- Stock alerts and transactions
DROP POLICY IF EXISTS "Authenticated can view alerts" ON public.stock_alerts;
DROP POLICY IF EXISTS "Managers+ manage alerts" ON public.stock_alerts;
CREATE POLICY "Authenticated can view own branch alerts"
ON public.stock_alerts
FOR SELECT
TO authenticated
USING (public.can_access_branch(branch_id));
CREATE POLICY "Managers can manage own branch alerts"
ON public.stock_alerts
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
);

DROP POLICY IF EXISTS "Authenticated can view stock txns" ON public.stock_transactions;
DROP POLICY IF EXISTS "Managers+ manage stock txns" ON public.stock_transactions;
CREATE POLICY "Authenticated can view own branch stock txns"
ON public.stock_transactions
FOR SELECT
TO authenticated
USING (public.can_access_branch(branch_id));
CREATE POLICY "Managers can manage own branch stock txns"
ON public.stock_transactions
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
);

-- Prep recipes/batches
DROP POLICY IF EXISTS "Authenticated read prep recipes" ON public.prep_recipes;
DROP POLICY IF EXISTS "Managers+ manage prep recipes" ON public.prep_recipes;
CREATE POLICY "Authenticated can view own branch prep recipes"
ON public.prep_recipes
FOR SELECT
TO authenticated
USING (public.can_access_branch(branch_id));
CREATE POLICY "Managers can manage own branch prep recipes"
ON public.prep_recipes
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
);

DROP POLICY IF EXISTS "Authenticated read prep batches" ON public.prep_batches;
DROP POLICY IF EXISTS "Staff+ manage prep batches" ON public.prep_batches;
CREATE POLICY "Authenticated can view own branch prep batches"
ON public.prep_batches
FOR SELECT
TO authenticated
USING (public.can_access_branch(branch_id));
CREATE POLICY "Staff can manage own branch prep batches"
ON public.prep_batches
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role, 'employee'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role, 'employee'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
);

DROP POLICY IF EXISTS "Authenticated read prep recipe lines" ON public.prep_recipe_ingredients;
DROP POLICY IF EXISTS "Managers+ manage prep recipe lines" ON public.prep_recipe_ingredients;
CREATE POLICY "Authenticated can view own branch prep recipe lines"
ON public.prep_recipe_ingredients
FOR SELECT
TO authenticated
USING (public.can_access_prep_recipe(prep_recipe_id) AND public.can_access_ingredient(ingredient_id));
CREATE POLICY "Managers can manage own branch prep recipe lines"
ON public.prep_recipe_ingredients
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND public.can_access_prep_recipe(prep_recipe_id) AND public.can_access_ingredient(ingredient_id))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND public.can_access_prep_recipe(prep_recipe_id) AND public.can_access_ingredient(ingredient_id))
);

-- Regular recipe lines inherit access from their menu item and ingredient branches.
DROP POLICY IF EXISTS "Authenticated can view recipes" ON public.recipe_ingredients;
DROP POLICY IF EXISTS "Managers+ manage recipes" ON public.recipe_ingredients;
CREATE POLICY "Authenticated can view own branch recipes"
ON public.recipe_ingredients
FOR SELECT
TO authenticated
USING (public.can_access_menu_item(menu_item_id) AND public.can_access_ingredient(ingredient_id));
CREATE POLICY "Managers can manage own branch recipes"
ON public.recipe_ingredients
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND public.can_access_menu_item(menu_item_id) AND public.can_access_ingredient(ingredient_id))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND public.can_access_menu_item(menu_item_id) AND public.can_access_ingredient(ingredient_id))
);

-- Purchase orders/items
DROP POLICY IF EXISTS "Authenticated can view POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Managers+ manage POs" ON public.purchase_orders;
CREATE POLICY "Authenticated can view own branch POs"
ON public.purchase_orders
FOR SELECT
TO authenticated
USING (public.can_access_branch(branch_id));
CREATE POLICY "Managers can manage own branch POs"
ON public.purchase_orders
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
);

DROP POLICY IF EXISTS "Authenticated can view PO items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Managers+ manage PO items" ON public.purchase_order_items;
CREATE POLICY "Authenticated can view own branch PO items"
ON public.purchase_order_items
FOR SELECT
TO authenticated
USING (public.can_access_purchase_order(purchase_order_id));
CREATE POLICY "Managers can manage own branch PO items"
ON public.purchase_order_items
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND public.can_access_purchase_order(purchase_order_id))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND public.can_access_purchase_order(purchase_order_id))
);

-- Wastage
DROP POLICY IF EXISTS "Authenticated can view wastage" ON public.wastage_logs;
DROP POLICY IF EXISTS "Managers+ manage wastage" ON public.wastage_logs;
CREATE POLICY "Authenticated can view own branch wastage"
ON public.wastage_logs
FOR SELECT
TO authenticated
USING (public.can_access_branch(branch_id));
CREATE POLICY "Managers can manage own branch wastage"
ON public.wastage_logs
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
);

-- Orders and order items
DROP POLICY IF EXISTS "Authenticated can view orders" ON public.orders;
DROP POLICY IF EXISTS "Staff+ manage orders" ON public.orders;
CREATE POLICY "Authenticated can view own branch orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.can_access_branch(branch_id));
CREATE POLICY "Staff can manage own branch orders"
ON public.orders
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role, 'employee'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role, 'employee'::app_role]) AND branch_id = ANY(public.get_user_branch_ids(auth.uid())))
);

DROP POLICY IF EXISTS "Authenticated can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Staff+ manage order items" ON public.order_items;
CREATE POLICY "Authenticated can view own branch order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (public.can_access_order(order_id));
CREATE POLICY "Staff can manage own branch order items"
ON public.order_items
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role, 'employee'::app_role]) AND public.can_access_order(order_id))
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role, 'employee'::app_role]) AND public.can_access_order(order_id))
);

-- Keep QR ordering anonymous but only when records are explicitly branch-linked.
DROP POLICY IF EXISTS "Anon can view qr orders" ON public.orders;
DROP POLICY IF EXISTS "Anon can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anon can create order items" ON public.order_items;
CREATE POLICY "Anon can view QR orders with branch"
ON public.orders
FOR SELECT
TO anon
USING (order_source = 'qr'::order_source AND branch_id IS NOT NULL);
CREATE POLICY "Anon can create QR orders with branch"
ON public.orders
FOR INSERT
TO anon
WITH CHECK (order_source = 'qr'::order_source AND branch_id IS NOT NULL);
CREATE POLICY "Anon can create QR order items"
ON public.order_items
FOR INSERT
TO anon
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.order_source = 'qr'::order_source AND o.branch_id IS NOT NULL));