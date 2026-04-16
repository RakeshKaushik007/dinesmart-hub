-- Add pending_adjustment to order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_adjustment';

-- Add reopen_reason column to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reopen_reason text DEFAULT NULL;
