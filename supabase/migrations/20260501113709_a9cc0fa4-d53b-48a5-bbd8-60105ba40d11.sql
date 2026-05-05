DROP POLICY IF EXISTS "Admins can manage branches" ON public.branches;
DROP POLICY IF EXISTS "Admins can view all branches" ON public.branches;
DROP POLICY IF EXISTS "Authenticated users can view active branches" ON public.branches;
DROP POLICY IF EXISTS "Owners manage their restaurant branches" ON public.branches;

CREATE POLICY "Platform admins can view branches"
ON public.branches
FOR SELECT
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]));

CREATE POLICY "Super admins can manage branches"
ON public.branches
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Owners can view their own restaurant branches"
ON public.branches
FOR SELECT
TO authenticated
USING (
  restaurant_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = branches.restaurant_id
      AND r.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Owners can create their own restaurant branches"
ON public.branches
FOR INSERT
TO authenticated
WITH CHECK (
  restaurant_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = branches.restaurant_id
      AND r.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Owners can update their own restaurant branches"
ON public.branches
FOR UPDATE
TO authenticated
USING (
  restaurant_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = branches.restaurant_id
      AND r.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  restaurant_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = branches.restaurant_id
      AND r.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete their own restaurant branches"
ON public.branches
FOR DELETE
TO authenticated
USING (
  restaurant_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = branches.restaurant_id
      AND r.owner_user_id = auth.uid()
  )
);

CREATE POLICY "Assigned staff can view their branch"
ON public.branches
FOR SELECT
TO authenticated
USING (
  id = ANY(public.get_user_branch_ids(auth.uid()))
);