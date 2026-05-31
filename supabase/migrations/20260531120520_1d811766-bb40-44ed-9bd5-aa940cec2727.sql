CREATE POLICY "Owners can create own restaurant" ON public.restaurants
FOR INSERT TO authenticated
WITH CHECK (owner_user_id = auth.uid() AND public.has_role(auth.uid(), 'owner'::app_role));