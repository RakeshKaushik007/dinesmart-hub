-- Replace the two unrestricted manager rules with branch-scoped ones.
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can update any profile" ON public.profiles;

CREATE POLICY "Managers can view own branch profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (
    public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role])
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = profiles.user_id
          AND ur.branch_id = ANY(public.get_user_branch_ids(auth.uid()))
      )
      OR profiles.user_id = ANY(public.get_descendant_user_ids(auth.uid()))
    )
  )
);

CREATE POLICY "Managers can update own branch profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (
    public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role])
    AND (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = profiles.user_id
          AND ur.branch_id = ANY(public.get_user_branch_ids(auth.uid()))
      )
      OR profiles.user_id = ANY(public.get_descendant_user_ids(auth.uid()))
    )
  )
);