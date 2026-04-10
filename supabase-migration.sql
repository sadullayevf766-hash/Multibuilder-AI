-- Run this in Supabase SQL Editor
-- https://app.supabase.com → SQL Editor

-- 1. Drop and recreate projects table with correct schema
DROP TABLE IF EXISTS projects CASCADE;

CREATE TABLE projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  drawing_data jsonb NOT NULL DEFAULT '{}',
  messages jsonb NOT NULL DEFAULT '[]',
  deleted_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 2. Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 3. Policies
CREATE POLICY "select_own" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert_own" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own" ON projects FOR DELETE USING (auth.uid() = user_id);

-- 4. Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Add columns to existing table (if already exists, run only these):
-- ALTER TABLE projects ADD COLUMN IF NOT EXISTS messages jsonb NOT NULL DEFAULT '[]';
-- ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
