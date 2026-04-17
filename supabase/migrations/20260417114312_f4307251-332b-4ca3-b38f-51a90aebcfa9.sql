
-- Custom payment methods table (manager-managed)
CREATE TABLE public.payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'aggregator', -- 'direct' or 'aggregator'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active payment methods"
  ON public.payment_methods FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Managers+ manage payment methods"
  ON public.payment_methods FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'owner'::app_role, 'branch_manager'::app_role]));

CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Refund tracking on order_items
ALTER TABLE public.order_items
  ADD COLUMN is_refunded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN refund_reason TEXT,
  ADD COLUMN refunded_by UUID,
  ADD COLUMN refunded_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN nc_reason TEXT;

-- Allow custom payment_mode strings: convert enum -> text
ALTER TABLE public.orders
  ALTER COLUMN payment_mode TYPE TEXT USING payment_mode::text;

ALTER TABLE public.orders
  ALTER COLUMN payment_mode SET DEFAULT 'pending';
