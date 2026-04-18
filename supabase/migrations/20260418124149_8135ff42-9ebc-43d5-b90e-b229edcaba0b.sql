-- Add pos_pin to profiles for terminal login
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pos_pin TEXT;

-- Optional: ensure 4-digit format when present (validation trigger style; soft check)
CREATE OR REPLACE FUNCTION public.validate_pos_pin()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.pos_pin IS NOT NULL AND NEW.pos_pin !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'pos_pin must be exactly 4 digits';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_pos_pin_trigger ON public.profiles;
CREATE TRIGGER validate_pos_pin_trigger
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_pos_pin();

-- Allow managers+ to update any profile (needed for staff management)
DROP POLICY IF EXISTS "Managers can update any profile" ON public.profiles;
CREATE POLICY "Managers can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'owner'::app_role, 'branch_manager'::app_role]));

-- Allow managers+ to view all profiles (for staff list)
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.profiles;
CREATE POLICY "Managers can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'owner'::app_role, 'branch_manager'::app_role]));
