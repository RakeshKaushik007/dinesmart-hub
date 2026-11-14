-- A names-only lookup for the Audit Log and Void/NC Log screens.
--
-- The profiles table also holds POS PINs and phone numbers, so it stays locked
-- down. This returns ONLY name and email, only to the roles that can open those
-- screens, and only for people in the caller's own restaurant - so a log can
-- say who did what without exposing anybody's PIN.
CREATE OR REPLACE FUNCTION public.staff_names()
RETURNS TABLE (user_id uuid, full_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE me AS (
    SELECT auth.uid() AS uid
  ),
  -- the person you report to, the person they report to, and so on, so an
  -- order settled by your own owner still shows their name
  ancestors AS (
    SELECT ur.parent_user_id AS uid
      FROM public.user_roles ur JOIN me ON ur.user_id = me.uid
     WHERE ur.parent_user_id IS NOT NULL
    UNION
    SELECT ur.parent_user_id
      FROM public.user_roles ur JOIN ancestors a ON ur.user_id = a.uid
     WHERE ur.parent_user_id IS NOT NULL
  ),
  caller AS (
    SELECT me.uid,
           public.has_any_role(me.uid, ARRAY['super_admin'::app_role, 'admin'::app_role]) AS is_admin,
           public.has_any_role(me.uid, ARRAY['owner'::app_role, 'branch_manager'::app_role]) AS is_manager
      FROM me
  )
  SELECT p.user_id, p.full_name, p.email
    FROM public.profiles p, caller c
   WHERE c.uid IS NOT NULL
     -- the log screens are branch manager and above; nobody else gets anything
     AND (c.is_admin OR c.is_manager)
     AND (
       c.is_admin
       OR p.user_id = c.uid
       OR (
         -- never expose the internal software team to a restaurant
         NOT public.has_any_role(p.user_id, ARRAY['super_admin'::app_role, 'admin'::app_role])
         AND (
           p.user_id = ANY(public.get_descendant_user_ids(c.uid))
           OR p.user_id IN (SELECT uid FROM ancestors)
           OR EXISTS (
                SELECT 1 FROM public.user_roles ur
                 WHERE ur.user_id = p.user_id
                   AND ur.branch_id = ANY(public.get_user_branch_ids(c.uid))
              )
         )
       )
     );
$$;

REVOKE ALL ON FUNCTION public.staff_names() FROM public;
GRANT EXECUTE ON FUNCTION public.staff_names() TO authenticated;