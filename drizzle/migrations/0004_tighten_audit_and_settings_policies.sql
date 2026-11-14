DROP POLICY IF EXISTS "Authenticated insert audit" ON public.user_audit_log;
DROP POLICY IF EXISTS "Authenticated read settings" ON public.app_settings;
CREATE POLICY "Authenticated read public settings" ON public.app_settings FOR SELECT TO authenticated USING (key = 'floating_ai_assistant');