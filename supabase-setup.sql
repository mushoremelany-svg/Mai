-- ============================================================================
-- MAI — Supabase database setup
-- Run this once in your Supabase project: Dashboard → SQL Editor → New query
-- → paste this whole file → Run.
-- ============================================================================

-- One generic table holds all of Mai's data, keyed per user + per app section
-- (quest, todo, challenges, reflect, finance, settings). This mirrors the
-- simple key/value shape the app already used, so no other schema changes
-- are needed as the app grows.
create table if not exists app_kv (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

-- Row Level Security: every user can only ever see and edit their own rows.
-- This is what makes it safe to call the API directly from the browser.
alter table app_kv enable row level security;

create policy "Users can read their own data"
  on app_kv for select
  using (auth.uid() = user_id);

create policy "Users can insert their own data"
  on app_kv for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own data"
  on app_kv for update
  using (auth.uid() = user_id);

create policy "Users can delete their own data"
  on app_kv for delete
  using (auth.uid() = user_id);

-- Keep updated_at fresh automatically on every write.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger app_kv_updated_at
  before update on app_kv
  for each row
  execute function set_updated_at();
