
-- Allow anonymous users to view active menu items
CREATE POLICY "Anon can view active menu items"
ON public.menu_items
FOR SELECT
TO anon
USING (is_active = true AND is_available = true);

-- Allow anonymous users to view active categories
CREATE POLICY "Anon can view active categories"
ON public.menu_categories
FOR SELECT
TO anon
USING (is_active = true);

-- Allow anonymous users to view tables (for table number lookup)
CREATE POLICY "Anon can view tables"
ON public.restaurant_tables
FOR SELECT
TO anon
USING (true);

-- Allow anonymous users to insert orders (QR ordering)
CREATE POLICY "Anon can create orders"
ON public.orders
FOR INSERT
TO anon
WITH CHECK (order_source = 'qr');

-- Allow anonymous users to insert order items
CREATE POLICY "Anon can create order items"
ON public.order_items
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous users to insert table sessions
CREATE POLICY "Anon can create table sessions"
ON public.table_sessions
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous users to update table status (to occupied)
CREATE POLICY "Anon can update table status"
ON public.restaurant_tables
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
