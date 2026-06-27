
-- 1) Backfill NULL branch_id rows to the Blennix branch so historical data
--    stops bleeding into newly created restaurants.
UPDATE public.menu_categories
  SET branch_id = 'd65c28f6-fcae-4de8-8834-e1d7dbe88a32'
  WHERE branch_id IS NULL;
UPDATE public.menu_items
  SET branch_id = 'd65c28f6-fcae-4de8-8834-e1d7dbe88a32'
  WHERE branch_id IS NULL;
UPDATE public.ingredients
  SET branch_id = 'd65c28f6-fcae-4de8-8834-e1d7dbe88a32'
  WHERE branch_id IS NULL;
UPDATE public.restaurant_tables
  SET branch_id = 'd65c28f6-fcae-4de8-8834-e1d7dbe88a32'
  WHERE branch_id IS NULL;

-- 2) Auto-assign branch_id on insert when caller has exactly one branch.
--    Admins / super_admins / multi-branch owners still must specify branch_id
--    explicitly from app code (existing behavior preserved).
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

DROP TRIGGER IF EXISTS auto_branch_menu_categories ON public.menu_categories;
CREATE TRIGGER auto_branch_menu_categories
  BEFORE INSERT ON public.menu_categories
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_branch_id();

DROP TRIGGER IF EXISTS auto_branch_menu_items ON public.menu_items;
CREATE TRIGGER auto_branch_menu_items
  BEFORE INSERT ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_branch_id();

DROP TRIGGER IF EXISTS auto_branch_ingredients ON public.ingredients;
CREATE TRIGGER auto_branch_ingredients
  BEFORE INSERT ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_branch_id();

DROP TRIGGER IF EXISTS auto_branch_restaurant_tables ON public.restaurant_tables;
CREATE TRIGGER auto_branch_restaurant_tables
  BEFORE INSERT ON public.restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_branch_id();

-- 3) Scope authenticated reads by branch. Admins / super_admins bypass.
--    Anonymous kiosk policies are left untouched.
DROP POLICY IF EXISTS "Authenticated can view menu items" ON public.menu_items;
CREATE POLICY "Authenticated can view menu items"
  ON public.menu_items FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
    OR branch_id = ANY(public.get_user_branch_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated can view active categories" ON public.menu_categories;
CREATE POLICY "Authenticated can view active categories"
  ON public.menu_categories FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (
      public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
      OR branch_id = ANY(public.get_user_branch_ids(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Authenticated can view ingredients" ON public.ingredients;
CREATE POLICY "Authenticated can view ingredients"
  ON public.ingredients FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
    OR branch_id = ANY(public.get_user_branch_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "Authenticated can view tables" ON public.restaurant_tables;
CREATE POLICY "Authenticated can view tables"
  ON public.restaurant_tables FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
    OR branch_id = ANY(public.get_user_branch_ids(auth.uid()))
  );
