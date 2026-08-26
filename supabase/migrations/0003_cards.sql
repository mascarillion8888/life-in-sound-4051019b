-- Option B port — persisted Era Cards (replaces card-studio's Prisma/Vercel
-- stack: Prisma `Card` model → this table, Vercel Blob → the `card-artworks`
-- Storage bucket, NextAuth session → Supabase Auth `auth.uid()`).
--
-- One row per generated era card painting. The painting bytes live in
-- Storage (bucket below); this row carries the card's full textual state
-- (multidimensional prompt inputs + the poetic lore line) so a card can be
-- re-rendered without regenerating anything.
--
-- RLS is per-row ownership, identical in spirit to migration 0001: the
-- browser uses only the anon key and can never touch another user's cards.

-- ---------------------------------------------------------------------------
-- cards
-- ---------------------------------------------------------------------------
create table if not exists public.cards (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  -- Cache identity of the track ("itunes:12345" / "manual:artist:title").
  track_key     text        not null,
  -- Multidimensional prompt inputs (all nullable except title — a manual
  -- entry may carry nothing but a title).
  title         text        not null,
  artist        text        not null default '',
  album         text,
  genre         text,
  release_year  integer     check (release_year is null or (release_year >= 1800 and release_year <= 2100)),
  birth_year    integer     check (birth_year is null or (birth_year >= 1900 and birth_year <= 2100)),
  encounter_age integer     check (encounter_age is null or (encounter_age >= 0 and encounter_age <= 120)),
  -- birth_year + encounter_age, materialized for cheap era queries.
  era_year      integer     generated always as (
    case when birth_year is not null and encounter_age is not null
      then birth_year + encounter_age else null end
  ) stored,
  user_memory   text,
  -- The resolved scene family (gothic/soul/grunge/…) that steered the prompt.
  scene         text        not null default 'gothic',
  -- The AI-written 2-sentence nostalgia snippet for the lore box (null when
  -- the deterministic fallback served).
  lore          text,
  -- Storage object path inside the card-artworks bucket
  -- ("<user_id>/<card_uuid>.png"); null while generation failed and the UI
  -- keeps its gothic placeholder.
  image_path    text,
  created_at    timestamptz not null default now()
);

comment on table public.cards is
  'Persisted Era Card state — one generated painting + its copy per track.';

-- Per-user timeline ordering + duplicate-track lookups.
create index if not exists cards_user_created_idx on public.cards (user_id, created_at desc);
create index if not exists cards_user_track_idx on public.cards (user_id, track_key);

-- ---------------------------------------------------------------------------
-- Row Level Security — ownership enforced at the database
-- ---------------------------------------------------------------------------
alter table public.cards enable row level security;

drop policy if exists "cards_owner_select" on public.cards;
create policy "cards_owner_select" on public.cards
  for select using (auth.uid() = user_id);

drop policy if exists "cards_owner_insert" on public.cards;
create policy "cards_owner_insert" on public.cards
  for insert with check (auth.uid() = user_id);

drop policy if exists "cards_owner_update" on public.cards;
create policy "cards_owner_update" on public.cards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "cards_owner_delete" on public.cards;
create policy "cards_owner_delete" on public.cards
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage bucket: card-artworks (private — paintings are personal)
-- ---------------------------------------------------------------------------
-- Idempotent bucket creation; private so raw object URLs 404 for everyone —
-- reads go through signed URLs or an authenticated download, both gated by
-- the storage policies below.
insert into storage.buckets (id, name, public)
values ('card-artworks', 'card-artworks', false)
on conflict (id) do nothing;

-- Object paths are namespaced by owner: "<user_id>/<file>". The first path
-- segment must equal the caller's auth.uid() — same ownership rule as the
-- table, enforced on the storage layer.
drop policy if exists "card_artworks_owner_select" on storage.objects;
create policy "card_artworks_owner_select" on storage.objects
  for select using (
    bucket_id = 'card-artworks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "card_artworks_owner_insert" on storage.objects;
create policy "card_artworks_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'card-artworks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "card_artworks_owner_update" on storage.objects;
create policy "card_artworks_owner_update" on storage.objects
  for update using (
    bucket_id = 'card-artworks'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'card-artworks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "card_artworks_owner_delete" on storage.objects;
create policy "card_artworks_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'card-artworks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
