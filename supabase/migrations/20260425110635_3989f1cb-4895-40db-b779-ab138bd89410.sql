-- 1. Extend user_roles with hierarchy fields
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS parent_user_id uuid,
  ADD COLUMN IF NOT EXISTS custom_role_name text,
  ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Unique custom role name per parent (case-insensitive, only when both set)
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_parent_custom_name_unique
  ON public.user_roles (parent_user_id, lower(custom_role_name))
  WHERE parent_user_id IS NOT NULL AND custom_role_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_roles_parent_user_id_idx
  ON public.user_roles (parent_user_id);

-- 2. Audit log
CREATE TABLE IF NOT EXISTS public.user_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  target_user_id uuid,
  target_email text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_audit_log_actor_idx ON public.user_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS user_audit_log_target_idx ON public.user_audit_log (target_user_id);
CREATE INDEX IF NOT EXISTS user_audit_log_created_at_idx ON public.user_audit_log (created_at DESC);

ALTER TABLE public.user_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins view all audit" ON public.user_audit_log;
CREATE POLICY "Super admins view all audit"
  ON public.user_audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Actors view their audit" ON public.user_audit_log;
CREATE POLICY "Actors view their audit"
  ON public.user_audit_log FOR SELECT
  USING (auth.uid() = actor_id);

DROP POLICY IF EXISTS "Authenticated insert audit" ON public.user_audit_log;
CREATE POLICY "Authenticated insert audit"
  ON public.user_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Recursive descendants helper
CREATE OR REPLACE FUNCTION public.get_descendant_user_ids(_root_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE tree AS (
    SELECT user_id FROM public.user_roles WHERE parent_user_id = _root_user_id
    UNION
    SELECT ur.user_id FROM public.user_roles ur
    INNER JOIN tree t ON ur.parent_user_id = t.user_id
  )
  SELECT COALESCE(array_agg(DISTINCT user_id), '{}'::uuid[]) FROM tree;
$$;

-- 4. Allow parents to manage their direct reports
DROP POLICY IF EXISTS "Parents update own descendants" ON public.user_roles;
CREATE POLICY "Parents update own descendants"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (parent_user_id = auth.uid())
  WITH CHECK (parent_user_id = auth.uid());

DROP POLICY IF EXISTS "Parents delete own descendants" ON public.user_roles;
CREATE POLICY "Parents delete own descendants"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (parent_user_id = auth.uid());