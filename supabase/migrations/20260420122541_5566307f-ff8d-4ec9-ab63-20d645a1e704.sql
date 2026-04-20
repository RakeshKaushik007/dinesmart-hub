DROP POLICY IF EXISTS "Owners can assign manager or employee" ON public.user_roles;
CREATE POLICY "Owners can assign manager or employee"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['owner'::app_role])
  AND role IN ('branch_manager'::app_role, 'employee'::app_role)
);

DROP POLICY IF EXISTS "Managers can assign employee" ON public.user_roles;
CREATE POLICY "Managers can assign employee"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['branch_manager'::app_role])
  AND role = 'employee'::app_role
);