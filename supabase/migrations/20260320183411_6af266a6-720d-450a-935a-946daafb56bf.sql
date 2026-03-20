
-- ============================================================
-- MENU CATEGORIES
-- ============================================================
CREATE TABLE public.menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view active categories" ON public.menu_categories FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins manage categories" ON public.menu_categories FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner']::app_role[]));

-- ============================================================
-- MENU ITEMS
-- ============================================================
CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  selling_price numeric(10,2) NOT NULL DEFAULT 0,
  cost_price numeric(10,2) NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  image_url text,
  prep_time_minutes int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view menu items" ON public.menu_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage menu items" ON public.menu_items FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager']::app_role[]));

-- ============================================================
-- INGREDIENTS
-- ============================================================
CREATE TABLE public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  current_stock numeric(12,3) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kg',
  min_threshold numeric(12,3) NOT NULL DEFAULT 0,
  cost_per_unit numeric(10,2) NOT NULL DEFAULT 0,
  expiry_date date,
  status text NOT NULL DEFAULT 'good',
  last_restocked timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view ingredients" ON public.ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers+ manage ingredients" ON public.ingredients FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager']::app_role[]));

-- ============================================================
-- RECIPE INGREDIENTS (menu_item <-> ingredient mapping)
-- ============================================================
CREATE TABLE public.recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE CASCADE NOT NULL,
  ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE CASCADE NOT NULL,
  quantity numeric(10,4) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kg',
  UNIQUE(menu_item_id, ingredient_id)
);
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view recipes" ON public.recipe_ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers+ manage recipes" ON public.recipe_ingredients FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager']::app_role[]));

-- ============================================================
-- RESTAURANT TABLES
-- ============================================================
CREATE TABLE public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  table_number int NOT NULL,
  seats int NOT NULL DEFAULT 4,
  section text NOT NULL DEFAULT 'Main',
  status text NOT NULL DEFAULT 'available',
  qr_code_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view tables" ON public.restaurant_tables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers+ manage tables" ON public.restaurant_tables FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager']::app_role[]));

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TYPE public.order_type AS ENUM ('dine_in','takeaway','online');
CREATE TYPE public.order_source AS ENUM ('pos','swiggy','zomato','qr','phone');
CREATE TYPE public.order_status AS ENUM ('new','accepted','preparing','ready','dispatched','completed','cancelled');
CREATE TYPE public.payment_mode AS ENUM ('cash','upi','card','wallet','mixed','pending');

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  order_number serial,
  order_type order_type NOT NULL DEFAULT 'dine_in',
  order_source order_source NOT NULL DEFAULT 'pos',
  status order_status NOT NULL DEFAULT 'new',
  payment_mode payment_mode NOT NULL DEFAULT 'pending',
  customer_name text,
  customer_phone text,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff+ manage orders" ON public.orders FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager','employee']::app_role[]));

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view order items" ON public.order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff+ manage order items" ON public.order_items FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager','employee']::app_role[]));

-- ============================================================
-- TABLE SESSIONS (occupancy tracking)
-- ============================================================
CREATE TABLE public.table_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE CASCADE NOT NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  guest_name text,
  guest_count int DEFAULT 1,
  seated_at timestamptz NOT NULL DEFAULT now(),
  cleared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view sessions" ON public.table_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff+ manage sessions" ON public.table_sessions FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager','employee']::app_role[]));

-- ============================================================
-- SHIFTS
-- ============================================================
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  shift_date date NOT NULL DEFAULT CURRENT_DATE,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  orders_handled int DEFAULT 0,
  total_sales numeric(10,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own shifts" ON public.shifts FOR SELECT TO authenticated USING (auth.uid() = employee_id);
CREATE POLICY "Managers+ view all shifts" ON public.shifts FOR SELECT USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager']::app_role[]));
CREATE POLICY "Managers+ manage shifts" ON public.shifts FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager']::app_role[]));

-- ============================================================
-- WASTAGE LOGS
-- ============================================================
CREATE TABLE public.wastage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE SET NULL,
  ingredient_name text NOT NULL,
  category text,
  quantity numeric(10,3) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kg',
  reason text NOT NULL DEFAULT 'expired',
  cost numeric(10,2) NOT NULL DEFAULT 0,
  logged_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wastage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view wastage" ON public.wastage_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers+ manage wastage" ON public.wastage_logs FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager']::app_role[]));

-- ============================================================
-- STOCK TRANSACTIONS
-- ============================================================
CREATE TABLE public.stock_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL DEFAULT 'in', -- 'in', 'out', 'adjustment'
  quantity numeric(12,3) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kg',
  unit_cost numeric(10,2) DEFAULT 0,
  total_cost numeric(10,2) DEFAULT 0,
  reference_type text, -- 'purchase_order', 'order', 'wastage', 'manual'
  reference_id uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view stock txns" ON public.stock_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers+ manage stock txns" ON public.stock_transactions FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager']::app_role[]));

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================
CREATE TYPE public.po_status AS ENUM ('draft','sent','partial','received','cancelled');

CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  po_number serial,
  vendor_name text NOT NULL,
  vendor_phone text,
  status po_status NOT NULL DEFAULT 'draft',
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  expected_date date,
  received_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view POs" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers+ manage POs" ON public.purchase_orders FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager']::app_role[]));

-- ============================================================
-- PURCHASE ORDER ITEMS
-- ============================================================
CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
  ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE SET NULL,
  ingredient_name text NOT NULL,
  quantity numeric(10,3) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'kg',
  unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  total_cost numeric(10,2) NOT NULL DEFAULT 0,
  received_quantity numeric(10,3) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view PO items" ON public.purchase_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers+ manage PO items" ON public.purchase_order_items FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager']::app_role[]));

-- ============================================================
-- DAILY SUMMARIES (pre-computed analytics)
-- ============================================================
CREATE TABLE public.daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  summary_date date NOT NULL,
  total_orders int DEFAULT 0,
  total_revenue numeric(12,2) DEFAULT 0,
  total_cost numeric(12,2) DEFAULT 0,
  gross_profit numeric(12,2) DEFAULT 0,
  avg_order_value numeric(10,2) DEFAULT 0,
  dine_in_orders int DEFAULT 0,
  takeaway_orders int DEFAULT 0,
  online_orders int DEFAULT 0,
  cash_revenue numeric(12,2) DEFAULT 0,
  upi_revenue numeric(12,2) DEFAULT 0,
  card_revenue numeric(12,2) DEFAULT 0,
  swiggy_revenue numeric(12,2) DEFAULT 0,
  zomato_revenue numeric(12,2) DEFAULT 0,
  cancellation_count int DEFAULT 0,
  wastage_cost numeric(10,2) DEFAULT 0,
  peak_hour int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(branch_id, summary_date)
);
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers+ view summaries" ON public.daily_summaries FOR SELECT USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager']::app_role[]));
CREATE POLICY "System manage summaries" ON public.daily_summaries FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin']::app_role[]));

-- ============================================================
-- STOCK ALERTS
-- ============================================================
CREATE TABLE public.stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'low_stock',
  ingredient_name text NOT NULL,
  message text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view alerts" ON public.stock_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers+ manage alerts" ON public.stock_alerts FOR ALL USING (has_any_role(auth.uid(), ARRAY['super_admin','admin','owner','branch_manager']::app_role[]));

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE TRIGGER update_menu_categories_updated_at BEFORE UPDATE ON public.menu_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON public.ingredients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_restaurant_tables_updated_at BEFORE UPDATE ON public.restaurant_tables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- ENABLE REALTIME for orders
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_alerts;
