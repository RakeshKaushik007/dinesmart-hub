ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS subscription_updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_subscription_status_check;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_subscription_status_check
  CHECK (subscription_status IN ('active','suspended','trial','cancelled'));

ALTER TABLE public.restaurants
  DROP CONSTRAINT IF EXISTS restaurants_subscription_tier_check;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_subscription_tier_check
  CHECK (subscription_tier IN ('starter','pro','enterprise'));