CREATE TABLE public.branch_settings (
  branch_id uuid PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_settings TO authenticated;
GRANT ALL ON public.branch_settings TO service_role;

ALTER TABLE public.branch_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read own branch settings"
ON public.branch_settings
FOR SELECT
TO authenticated
USING (public.can_access_branch(branch_id));

CREATE POLICY "Managers can manage own branch settings"
ON public.branch_settings
FOR ALL
TO authenticated
USING (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (
    public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role])
    AND branch_id = ANY(public.get_user_branch_ids(auth.uid()))
  )
)
WITH CHECK (
  public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role])
  OR (
    public.has_any_role(auth.uid(), ARRAY['owner'::app_role, 'branch_manager'::app_role])
    AND branch_id = ANY(public.get_user_branch_ids(auth.uid()))
  )
);