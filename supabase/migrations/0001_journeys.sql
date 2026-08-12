-- Sprint 011 — Journey Persistence
-- Minimum schema: one server-side Journey record per authenticated user.
-- Run via Supabase SQL editor or `supabase db push` once a project exists.

-- Enable UUID generator (idempotent; available on managed Supabase by default).
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- journeys
-- ---------------------------------------------------------------------------
create table if not exists public.journeys (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  current     integer     not null default 1 check (current >= 1),
  answers     jsonb       not null default '{}'::jsonb,
  version     integer     not null default 1 check (version >= 1),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One active journey per user. If multi-journey support is added later, drop
-- this constraint and introduce a separate lookup; for Sprint 011, single-row
-- per user keeps load/save logic simple and avoids duplicate requests.
create unique index if not exists journeys_user_id_uniq on public.journeys (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security — ownership enforced at the database
-- ---------------------------------------------------------------------------
alter table public.journeys enable row level security;

-- SELECT: a user can read only their own journey.
drop policy if exists "journeys_owner_select" on public.journeys;
create policy "journeys_owner_select" on public.journeys
  for select using (auth.uid() = user_id);

-- INSERT: a user can insert only their own journey (user_id must match).
drop policy if exists "journeys_owner_insert" on public.journeys;
create policy "journeys_owner_insert" on public.journeys
  for insert with check (auth.uid() = user_id);

-- UPDATE: a user can update only their own journey.
drop policy if exists "journeys_owner_update" on public.journeys;
create policy "journeys_owner_update" on public.journeys
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- DELETE: a user can delete only their own journey.
drop policy if exists "journeys_owner_delete" on public.journeys;
create policy "journeys_owner_delete" on public.journeys
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at auto-maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_journey_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists journeys_set_updated_at on public.journeys;
create trigger journeys_set_updated_at
  before update on public.journeys
  for each row execute function public.touch_journey_updated_at();
