-- Allow platform admins (admin + super_admin) to fully manage branches
CREATE POLICY "Admins can insert branches"
ON public.branches
FOR INSERT
TO authenticated
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]));

CREATE POLICY "Admins can update branches"
ON public.branches
FOR UPDATE
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]))
WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]));

CREATE POLICY "Admins can delete branches"
ON public.branches
FOR DELETE
TO authenticated
USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]));

-- Allow admins/super admins to insert role rows for owner/manager/employee under them
CREATE POLICY "Admins can assign owner manager or employee"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  AND role = ANY (ARRAY['owner'::app_role, 'branch_manager'::app_role, 'employee'::app_role])
);