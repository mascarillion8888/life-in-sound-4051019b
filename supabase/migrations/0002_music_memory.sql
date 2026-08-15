-- Music Memory Foundation (Sprint — Music Memory Foundation)
--
-- Minimum viable schema for the lifelong music-memory companion.
-- Four tables, additive to 0001_journeys.sql. Does NOT touch journeys.
--
-- Design invariants enforced/represented here:
--   * Memory is the central long-term object.
--   * A Memory references >=1 Music Experience via memory_music_experiences.
--   * A Music Experience may appear in multiple Memories (many-to-many).
--   * Memory does NOT require an Event or Chapter (none exist yet).
--   * Event Time / Record Time / Reflection Time are distinct.
--   * User facts and AI interpretation are structurally separated:
--       - memories.original_user_note + user_note + feeling + life_event +
--         location + weather + event_time_*  -> USER FACT
--       - memories.ai_context + ai_context_stale_at               -> AI INTERPRETATION
--       - reflections where author = 'companion'                  -> AI INTERPRETATION
--   * original_user_note is immutable; user_note is the editable current text.
--   * AI must never write to any user_* / original_user_note field.
--   * RLS enforces ownership on every table (owner-only CRUD).
--
-- Run via Supabase SQL editor or `supabase db push` once a project exists.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- music_experiences
--   A piece of music the user encountered (broader than a streaming track).
--   title is NULLABLE to support unknown / family / traditional / unnamed music.
-- ---------------------------------------------------------------------------
create table if not exists public.music_experiences (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  -- Constrained text contract (not a hard enum) so future source kinds are
  -- additive. Documented valid values:
  --   streaming | traditional | family | anonymous | unknown_title | live
  source_type  text        not null check (source_type in
                              ('streaming','traditional','family',
                               'anonymous','unknown_title','live')),
  title        text,
  artist       text,
  album        text,
  external_ref text,
  source_notes text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Per-user dedup by external_ref where present (NULLs allowed to coexist).
create unique index if not exists music_experiences_user_ref_uniq
  on public.music_experiences (user_id, external_ref)
  where external_ref is not null;

create index if not exists music_experiences_user_idx
  on public.music_experiences (user_id);

alter table public.music_experiences enable row level security;
drop policy if exists "music_experiences_owner_select" on public.music_experiences;
create policy "music_experiences_owner_select" on public.music_experiences
  for select using (auth.uid() = user_id);
drop policy if exists "music_experiences_owner_insert" on public.music_experiences;
create policy "music_experiences_owner_insert" on public.music_experiences
  for insert with check (auth.uid() = user_id);
drop policy if exists "music_experiences_owner_update" on public.music_experiences;
create policy "music_experiences_owner_update" on public.music_experiences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "music_experiences_owner_delete" on public.music_experiences;
create policy "music_experiences_owner_delete" on public.music_experiences
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- memories
--   The central long-term object: a lived moment tied to music.
-- ---------------------------------------------------------------------------
create table if not exists public.memories (
  id                     uuid        primary key default gen_random_uuid(),
  user_id                uuid        not null references auth.users (id) on delete cascade,

  -- Record Time: when the user captured this memory in the system.
  recorded_at            timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- USER FACT fields (verbatim; never written by AI):
  original_user_note     text,        -- immutable original text
  user_note              text,        -- editable current text
  feeling                text,
  life_event             text,
  location               text,
  weather                text,

  -- Event Time (approximate-time model). granularity documents precision so
  -- "unknown" is distinguishable from "sometime in 2019".
  event_time_granularity text check (event_time_granularity in
                              ('exact','day','month','year',
                               'season','period','unknown')),
  event_time_start       timestamptz,
  event_time_end         timestamptz,
  event_time_label       text,        -- the user's own words, verbatim

  -- AI INTERPRETATION (derived). Kept separate from user facts.
  -- ai_context_stale_at marks prior AI-derived context as stale when the
  -- user-confirmed source data changes, so it can be regenerated rather than
  -- blindly erased on every edit.
  ai_context             jsonb,
  ai_context_stale_at    timestamptz
);

create index if not exists memories_user_recorded_idx
  on public.memories (user_id, recorded_at desc);
create index if not exists memories_user_event_time_idx
  on public.memories (user_id, event_time_start desc)
  where event_time_start is not null;
create index if not exists memories_user_idx
  on public.memories (user_id);

alter table public.memories enable row level security;
drop policy if exists "memories_owner_select" on public.memories;
create policy "memories_owner_select" on public.memories
  for select using (auth.uid() = user_id);
drop policy if exists "memories_owner_insert" on public.memories;
create policy "memories_owner_insert" on public.memories
  for insert with check (auth.uid() = user_id);
drop policy if exists "memories_owner_update" on public.memories;
create policy "memories_owner_update" on public.memories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "memories_owner_delete" on public.memories;
create policy "memories_owner_delete" on public.memories
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- memory_music_experiences
--   Many-to-many bridge: a Memory references >=1 Music Experience.
--   Carries user_id so RLS is a single cheap check (no join needed).
-- ---------------------------------------------------------------------------
create table if not exists public.memory_music_experiences (
  memory_id            uuid        not null references public.memories (id) on delete cascade,
  music_experience_id  uuid        not null references public.music_experiences (id) on delete cascade,
  user_id              uuid        not null references auth.users (id) on delete cascade,
  position             integer     not null check (position >= 0),
  role                 text,       -- optional: 'primary' | 'secondary' | 'context'
  created_at           timestamptz not null default now(),
  primary key (memory_id, music_experience_id)
);

create index if not exists memory_music_experiences_experience_idx
  on public.memory_music_experiences (music_experience_id);
create index if not exists memory_music_experiences_user_idx
  on public.memory_music_experiences (user_id);

alter table public.memory_music_experiences enable row level security;
drop policy if exists "memory_music_experiences_owner_select" on public.memory_music_experiences;
create policy "memory_music_experiences_owner_select" on public.memory_music_experiences
  for select using (auth.uid() = user_id);
drop policy if exists "memory_music_experiences_owner_insert" on public.memory_music_experiences;
create policy "memory_music_experiences_owner_insert" on public.memory_music_experiences
  for insert with check (auth.uid() = user_id);
drop policy if exists "memory_music_experiences_owner_update" on public.memory_music_experiences;
create policy "memory_music_experiences_owner_update" on public.memory_music_experiences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "memory_music_experiences_owner_delete" on public.memory_music_experiences;
create policy "memory_music_experiences_owner_delete" on public.memory_music_experiences
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- reflections
--   Additive later-thoughts about a Memory. Append-only in v1.
--   author = 'user'      -> USER FACT (user-authored thought)
--   author = 'companion' -> AI INTERPRETATION (Companion output)
-- ---------------------------------------------------------------------------
create table if not exists public.reflections (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  memory_id     uuid        not null references public.memories (id) on delete cascade,
  author        text        not null check (author in ('user','companion')),
  body          text        not null,
  reflected_at  timestamptz not null default now(),   -- Reflection Time
  created_at    timestamptz not null default now(),
  -- Companion provenance only; NULL for user reflections.
  source_context jsonb
);

create index if not exists reflections_memory_reflected_idx
  on public.reflections (memory_id, reflected_at desc);
create index if not exists reflections_user_reflected_idx
  on public.reflections (user_id, reflected_at desc);

alter table public.reflections enable row level security;
drop policy if exists "reflections_owner_select" on public.reflections;
create policy "reflections_owner_select" on public.reflections
  for select using (auth.uid() = user_id);
drop policy if exists "reflections_owner_insert" on public.reflections;
create policy "reflections_owner_insert" on public.reflections
  for insert with check (auth.uid() = user_id);
drop policy if exists "reflections_owner_update" on public.reflections;
create policy "reflections_owner_update" on public.reflections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "reflections_owner_delete" on public.reflections;
create policy "reflections_owner_delete" on public.reflections
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at auto-maintenance (mirrors journeys_set_updated_at in 0001)
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists music_experiences_set_updated_at on public.music_experiences;
create trigger music_experiences_set_updated_at
  before update on public.music_experiences
  for each row execute function public.touch_updated_at();

drop trigger if exists memories_set_updated_at on public.memories;
create trigger memories_set_updated_at
  before update on public.memories
  for each row execute function public.touch_updated_at();

-- memories.original_user_note immutability: prevent UPDATE from changing it.
-- (INSERT sets it; UPDATE must preserve it.) A trigger is the DB-level guard
-- so neither the application layer nor a future bug can silently rewrite the
-- original user text.
create or replace function public.preserve_original_user_note()
returns trigger
language plpgsql
as $$
begin
  -- Always keep the original value on UPDATE.
  new.original_user_note = old.original_user_note;
  return new;
end;
$$;

drop trigger if exists memories_preserve_original_note on public.memories;
create trigger memories_preserve_original_note
  before update on public.memories
  for each row execute function public.preserve_original_user_note();

-- ---------------------------------------------------------------------------
-- Atomic Memory creation (memory + all bridge rows in one transaction).
--
-- Supabase PostgREST does not support multi-table transactions from the JS
-- client, so a single PL/pgSQL function gives the "create everything or
-- nothing" guarantee. RLS still applies (SECURITY INVOKER, the default).
--
-- Cross-user safety: each requested music_experience_id is re-verified to
-- belong to auth.uid() inside the transaction. If any check fails, the whole
-- transaction rolls back — no half-created Memory, no bridge links.
-- ---------------------------------------------------------------------------
create or replace function public.create_memory_atomic(
  p_user_id          uuid,
  p_recorded_at      timestamptz,
  p_original_note    text,
  p_user_note        text,
  p_feeling          text,
  p_life_event       text,
  p_location         text,
  p_weather          text,
  p_event_granularity text,
  p_event_start      timestamptz,
  p_event_end        timestamptz,
  p_event_label      text,
  p_links            jsonb
) returns uuid
language plpgsql
as $$
declare
  v_memory_id uuid;
  v_link      jsonb;
  v_exp_owner uuid;
  v_link_count integer := 0;
begin
  -- Reject a Memory with no Music Experiences.
  if p_links is null or jsonb_array_length(p_links) = 0 then
    raise exception 'a memory requires at least one music experience';
  end if;

  insert into public.memories (
    user_id, recorded_at, original_user_note, user_note,
    feeling, life_event, location, weather,
    event_time_granularity, event_time_start, event_time_end, event_time_label
  )
  values (
    p_user_id, p_recorded_at, p_original_note, p_user_note,
    p_feeling, p_life_event, p_location, p_weather,
    p_event_granularity, p_event_start, p_event_end, p_event_label
  )
  returning id into v_memory_id;

  foreach v_link in array jsonb_array_elements(p_links)
  loop
    v_link_count := v_link_count + 1;

    select user_id into v_exp_owner
      from public.music_experiences
      where id = (v_link ->> 'music_experience_id')::uuid;

    if v_exp_owner is null then
      raise exception 'music experience not found';
    end if;
    if v_exp_owner <> p_user_id then
      raise exception 'cross-user music experience reference';
    end if;

    insert into public.memory_music_experiences (
      memory_id, music_experience_id, user_id, position, role
    )
    values (
      v_memory_id,
      (v_link ->> 'music_experience_id')::uuid,
      p_user_id,
      (v_link ->> 'position')::integer,
      nullif(v_link ->> 'role', '')
    );
  end loop;

  if v_link_count = 0 then
    raise exception 'a memory requires at least one music experience';
  end if;

  return v_memory_id;
end;
$$;
