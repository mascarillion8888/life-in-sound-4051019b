-- Collection entries: one row per saved track, per user. Backs the "favorites"
-- layer (src/lib/collection.ts) so a signed-in / anonymous Supabase user keeps
-- the same collection across devices. The client stays local-first: the UI
-- always reads/writes localStorage, and rows here are mirrored best-effort.
-- Ownership is enforced by RLS, the same rule as journeys, cards and profiles.
-- Note: unlike those tables this one is not part of a journey — it is a plain
-- per-user list, hence the composite (user_id, track_key) primary key.

create table if not exists public.collection_entries (
  user_id   uuid        not null references auth.users (id) on delete cascade,
  track_key text        not null,
  snapshot  jsonb       not null,
  added_at  timestamptz not null default now(),
  primary key (user_id, track_key)
);

alter table public.collection_entries enable row level security;

drop policy if exists "collection_entries_owner_select" on public.collection_entries;
create policy "collection_entries_owner_select" on public.collection_entries
  for select using (auth.uid() = user_id);

drop policy if exists "collection_entries_owner_insert" on public.collection_entries;
create policy "collection_entries_owner_insert" on public.collection_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "collection_entries_owner_update" on public.collection_entries;
create policy "collection_entries_owner_update" on public.collection_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "collection_entries_owner_delete" on public.collection_entries;
create policy "collection_entries_owner_delete" on public.collection_entries
  for delete using (auth.uid() = user_id);
