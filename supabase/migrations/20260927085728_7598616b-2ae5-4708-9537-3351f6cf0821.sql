-- 1) Repair: every seating record takes the branch of its own table.
UPDATE public.table_sessions ts
SET branch_id = rt.branch_id
FROM public.restaurant_tables rt
WHERE ts.table_id = rt.id
  AND ts.branch_id IS NULL
  AND rt.branch_id IS NOT NULL;

-- 2) Replace the wide-open policies with branch-scoped ones.
DROP POLICY IF EXISTS "Authenticated can view sessions" ON public.table_sessions;
DROP POLICY IF EXISTS "Staff+ manage sessions" ON public.table_sessions;

CREATE POLICY "Authenticated can view own branch sessions"
ON public.table_sessions
FOR SELECT
TO authenticated
USING (public.can_access_branch(branch_id));

CREATE POLICY "Staff can manage own branch sessions"
ON public.table_sessions
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (
    public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role, 'employee'::app_role])
    AND branch_id = ANY(public.get_user_branch_ids(auth.uid()))
  )
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (
    public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role, 'employee'::app_role])
    AND branch_id = ANY(public.get_user_branch_ids(auth.uid()))
  )
);

-- 3) QR customers may still start a seating record, but only a labelled one.
DROP POLICY IF EXISTS "Anon can create table sessions" ON public.table_sessions;
CREATE POLICY "Anon can create table sessions with branch"
ON public.table_sessions
FOR INSERT
TO anon
WITH CHECK (branch_id IS NOT NULL);