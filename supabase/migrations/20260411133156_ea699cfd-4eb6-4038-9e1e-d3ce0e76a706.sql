CREATE POLICY "Employees can update table status"
ON public.restaurant_tables
FOR UPDATE
TO authenticated
USING (has_any_role(auth.uid(), ARRAY['employee'::app_role]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['employee'::app_role]));