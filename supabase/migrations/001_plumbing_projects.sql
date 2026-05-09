-- Santexnika loyihalari jadvali
-- Supabase SQL Editor da ishga tushiring

CREATE TABLE IF NOT EXISTS public.plumbing_projects (
  id          text        PRIMARY KEY,
  user_id     text        NOT NULL,
  name        text        NOT NULL DEFAULT 'Santexnika loyihasi',
  description text,
  data        jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_plumbing_projects_user_id
  ON public.plumbing_projects (user_id);

-- RLS
ALTER TABLE public.plumbing_projects ENABLE ROW LEVEL SECURITY;

-- Foydalanuvchi o'z loyihalarini ko'ra oladi
CREATE POLICY "Users see own plumbing projects"
  ON public.plumbing_projects FOR SELECT
  USING (auth.uid()::text = user_id OR user_id = 'anon');

-- Foydalanuvchi o'z loyihasini yarata oladi
CREATE POLICY "Users insert own plumbing projects"
  ON public.plumbing_projects FOR INSERT
  WITH CHECK (auth.uid()::text = user_id OR user_id = 'anon');

-- Foydalanuvchi o'z loyihasini yangilay oladi
CREATE POLICY "Users update own plumbing projects"
  ON public.plumbing_projects FOR UPDATE
  USING (auth.uid()::text = user_id OR user_id = 'anon');

-- Service role hamma narsani ko'ra oladi (server uchun)
CREATE POLICY "Service role full access"
  ON public.plumbing_projects
  USING (true)
  WITH CHECK (true);
