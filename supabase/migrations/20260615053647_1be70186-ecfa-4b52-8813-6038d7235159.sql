
CREATE TABLE public.system_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  audience TEXT NOT NULL DEFAULT 'owners' CHECK (audience IN ('all','owners','managers','employees')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_banners TO authenticated;
GRANT ALL ON public.system_banners TO service_role;

ALTER TABLE public.system_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read active banners"
ON public.system_banners FOR SELECT
TO authenticated
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "Super admins manage banners"
ON public.system_banners FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_system_banners_updated_at
BEFORE UPDATE ON public.system_banners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
