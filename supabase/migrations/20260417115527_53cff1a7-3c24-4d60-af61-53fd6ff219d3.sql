-- Add icon column to payment_methods for custom icon picker
ALTER TABLE public.payment_methods
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'Building2';

-- Add settlement tracking columns to orders for aggregator reconciliation
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS aggregator_settled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS aggregator_settled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS aggregator_settled_by UUID,
ADD COLUMN IF NOT EXISTS aggregator_settlement_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_aggregator_settled ON public.orders(aggregator_settled, payment_mode) WHERE status = 'completed';