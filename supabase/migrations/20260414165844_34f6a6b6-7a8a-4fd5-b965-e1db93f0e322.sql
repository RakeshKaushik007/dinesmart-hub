-- Allow anon to read back their just-inserted QR orders (needed for .select() after .insert())
CREATE POLICY "Anon can view qr orders" ON public.orders
  FOR SELECT TO anon
  USING (order_source = 'qr'::order_source);
