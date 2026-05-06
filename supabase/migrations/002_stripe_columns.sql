-- Stripe integratsiyasi uchun ustunlar qo'shish
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status    TEXT DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS subscription_end_at    TIMESTAMPTZ;

-- Stripe customer ID bo'yicha tez qidirish
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Webhook idempotency (bir xil event ikki marta ishlanmasin)
CREATE TABLE IF NOT EXISTS stripe_events (
  id         TEXT PRIMARY KEY,  -- Stripe event ID
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
