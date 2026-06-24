ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS balance_due numeric(10,2)
  GENERATED ALWAYS AS (GREATEST(total_amount - amount_paid, 0)) STORED;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS payment_status text
  GENERATED ALWAYS AS (
    CASE
      WHEN amount_paid >= total_amount AND total_amount > 0 THEN 'paid'
      WHEN amount_paid > 0 THEN 'partial'
      ELSE 'unpaid'
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS purchase_orders_payment_status_idx
  ON public.purchase_orders (payment_status);