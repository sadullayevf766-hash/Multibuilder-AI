-- ═══════════════════════════════════════════════════════════════
-- Multibuild AI — Credits & Plans schema
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── Plans ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id          TEXT PRIMARY KEY,          -- 'free' | 'pro' | 'business'
  name        TEXT NOT NULL,
  price_usd   NUMERIC(8,2) DEFAULT 0,
  credits_per_week  INTEGER DEFAULT 0,   -- free plan: weekly reset
  credits_per_month INTEGER DEFAULT 0,   -- paid plans: monthly
  max_projects      INTEGER DEFAULT 2,   -- saved projects limit
  max_mega_modules  INTEGER DEFAULT 3,   -- mega builder module limit
  has_dxf_export    BOOLEAN DEFAULT false,
  has_watermark     BOOLEAN DEFAULT true,
  has_api_access    BOOLEAN DEFAULT false,
  max_team_members  INTEGER DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plans VALUES
  ('free',     'Bepul',    0,     30,   0,     2,  3,  false, true,  false, 1),
  ('pro',      'Pro',      12.99, 0,    500,   -1, 11, true,  false, false, 1),
  ('business', 'Business', 29.99, 0,    2000,  -1, 11, true,  false, true,  5)
ON CONFLICT (id) DO UPDATE SET
  credits_per_week  = EXCLUDED.credits_per_week,
  credits_per_month = EXCLUDED.credits_per_month,
  max_projects      = EXCLUDED.max_projects;

-- ── User profiles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,
  plan_id         TEXT REFERENCES plans(id) DEFAULT 'free',
  credits         INTEGER NOT NULL DEFAULT 30,
  credits_reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  total_generated INTEGER DEFAULT 0,     -- all-time generatsiyalar soni
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Credit transactions (audit log) ─────────────────────────────
CREATE TABLE IF NOT EXISTS credit_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,          -- manfiy = sarflash, musbat = to'ldirish
  balance     INTEGER NOT NULL,          -- transaction dan keyingi balans
  action      TEXT NOT NULL,             -- 'super_generate' | 'mega_build' | 'edit' | 'export_pdf' | 'export_dxf' | 'weekly_reset' | 'purchase'
  description TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan_id);
CREATE INDEX IF NOT EXISTS idx_txn_user ON credit_transactions(user_id, created_at DESC);

-- ── Auto-create profile on signup ────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, plan_id, credits, credits_reset_at)
  VALUES (
    NEW.id,
    NEW.email,
    'free',
    30,
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Weekly credit reset function ─────────────────────────────────
CREATE OR REPLACE FUNCTION reset_weekly_credits()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
  SET
    credits          = p.credits_per_week,
    credits_reset_at = NOW() + INTERVAL '7 days',
    updated_at       = NOW()
  FROM plans p
  WHERE profiles.plan_id = p.id
    AND p.id = 'free'
    AND profiles.credits_reset_at <= NOW();
END;
$$;

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Foydalanuvchi faqat o'z profilini ko'radi
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Service role barcha profillarni ko'radi (server uchun)
CREATE POLICY "profiles_service_all" ON profiles
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "txn_select_own" ON credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "txn_service_all" ON credit_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- ── Helper: deduct credits (atomic) ─────────────────────────────
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_amount   INTEGER,
  p_action   TEXT,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(success BOOLEAN, new_balance INTEGER, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_credits INTEGER;
  v_new_bal INTEGER;
BEGIN
  -- Lock row
  SELECT credits INTO v_credits
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 'Profil topilmadi';
    RETURN;
  END IF;

  IF v_credits < p_amount THEN
    RETURN QUERY SELECT false, v_credits, 'Credit yetarli emas';
    RETURN;
  END IF;

  v_new_bal := v_credits - p_amount;

  -- Deduct
  UPDATE profiles
  SET credits    = v_new_bal,
      updated_at = NOW(),
      total_generated = total_generated + 1
  WHERE id = p_user_id;

  -- Log
  INSERT INTO credit_transactions (user_id, amount, balance, action, description, metadata)
  VALUES (p_user_id, -p_amount, v_new_bal, p_action, p_description, p_metadata);

  RETURN QUERY SELECT true, v_new_bal, 'OK';
END;
$$;

-- ── Helper: get user profile with plan ──────────────────────────
CREATE OR REPLACE FUNCTION get_user_profile(p_user_id UUID)
RETURNS TABLE(
  id UUID, email TEXT, plan_id TEXT, credits INTEGER,
  credits_reset_at TIMESTAMPTZ, total_generated INTEGER,
  plan_name TEXT, credits_per_week INTEGER, credits_per_month INTEGER,
  max_projects INTEGER, max_mega_modules INTEGER,
  has_dxf_export BOOLEAN, has_watermark BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id, pr.email, pr.plan_id, pr.credits,
    pr.credits_reset_at, pr.total_generated,
    pl.name, pl.credits_per_week, pl.credits_per_month,
    pl.max_projects, pl.max_mega_modules,
    pl.has_dxf_export, pl.has_watermark
  FROM profiles pr
  JOIN plans pl ON pr.plan_id = pl.id
  WHERE pr.id = p_user_id;
END;
$$;
