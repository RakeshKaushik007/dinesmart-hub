
-- Add aggregator payment modes to the enum
ALTER TYPE public.payment_mode ADD VALUE IF NOT EXISTS 'zomato_pay';
ALTER TYPE public.payment_mode ADD VALUE IF NOT EXISTS 'swiggy_dineout';
ALTER TYPE public.payment_mode ADD VALUE IF NOT EXISTS 'easydiner';

-- Add discount and service charge columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charge numeric DEFAULT 0;

-- Add void and NC tracking to order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS is_void boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS void_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS voided_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_nc boolean DEFAULT false;
