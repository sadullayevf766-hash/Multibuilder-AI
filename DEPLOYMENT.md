# Deployment Guide

## Railway

1. Railway.app ga kiring
2. "New Project" tugmasini bosing
3. GitHub repository ni ulang
4. Environment variables qo'shing:
   - `GEMINI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
5. Deploy qiling

## Render

1. Render.com ga kiring
2. "New Web Service" tugmasini bosing
3. GitHub repository ni ulang
4. `render.yaml` faylidan sozlamalar avtomatik yuklanadi
5. Environment variables qo'shing (yuqoridagi kabi)
6. Deploy qiling

## Supabase Database Setup

Quyidagi SQL ni Supabase SQL Editor da ishga tushiring:

```sql
create table projects (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  description text,
  drawing_data jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table projects enable row level security;

-- Policy: Users can only see their own projects
create policy "Users can view own projects"
  on projects for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own projects
create policy "Users can insert own projects"
  on projects for insert
  with check (auth.uid() = user_id);

-- Policy: Users can update their own projects
create policy "Users can update own projects"
  on projects for update
  using (auth.uid() = user_id);

-- Policy: Users can delete their own projects
create policy "Users can delete own projects"
  on projects for delete
  using (auth.uid() = user_id);
```

## Environment Variables

### Server (.env)
```
PORT=5000
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

### Client (.env)
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```
