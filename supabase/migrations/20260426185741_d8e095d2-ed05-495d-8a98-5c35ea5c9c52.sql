
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins manage settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

INSERT INTO public.app_settings (key, value)
VALUES ('floating_ai_assistant', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;
