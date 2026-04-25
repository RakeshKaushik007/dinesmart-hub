-- Create restaurants table
CREATE TABLE public.restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id UUID,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all restaurants"
  ON public.restaurants FOR ALL
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role]));

CREATE POLICY "Owners view their restaurant"
  ON public.restaurants FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "Owners update their restaurant"
  ON public.restaurants FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Authenticated view active restaurants"
  ON public.restaurants FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend branches with restaurant_id and manager_user_id
ALTER TABLE public.branches
  ADD COLUMN restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  ADD COLUMN manager_user_id UUID,
  ADD COLUMN created_by UUID;

CREATE INDEX idx_branches_restaurant_id ON public.branches(restaurant_id);
CREATE INDEX idx_branches_manager_user_id ON public.branches(manager_user_id);

-- Allow owners to manage branches under their own restaurants
CREATE POLICY "Owners manage their restaurant branches"
  ON public.branches FOR ALL
  USING (
    restaurant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = branches.restaurant_id AND r.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = branches.restaurant_id AND r.owner_user_id = auth.uid()
    )
  );

-- Allow owners to insert role rows for managers/employees they create (RLS already covers this).
