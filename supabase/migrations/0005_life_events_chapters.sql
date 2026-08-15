-- Life Events + Life Chapters Foundation (Sprint — Life Events + Life Chapters Foundation)
--
-- The next long-term product layer:
--   Memory → Pattern → Life Event → Life Chapter
--
-- A Life Event is a meaningful event or period in the user's life.
-- A Life Chapter is a larger grouping of Events and/or Memories representing a
-- broader period or theme.
--
-- Design invariants enforced/represented here:
--   * Memory remains the source of truth. Events and Chapters are user-owned
--     organization/context layers — they NEVER modify or delete Memories.
--   * Every Event, Chapter, and relationship row is owned by user_id
--     (auth.uid() = user_id).
--   * An Event does NOT require a Memory. A Memory can be in zero/one/many
--     Events. A Chapter can contain zero/many Events and/or Memories directly.
--   * A user can NEVER attach another user's Memory/Event/Chapter.
--   * Approximate time is first-class: time_precision (exact/day/month/year/
--     season/period/unknown). We NEVER invent exact dates from approximate
--     descriptions.
--   * Deleting an Event/Chapter removes its relationship rows only — it never
--     deletes Memories/Events/Chapters. Deleting a Memory cascades its
--     relationship rows (FK on delete cascade). Deleting a User cascades
--     everything owned.
--   * AI may SUGGEST structure but never silently create personal history. The
--     app layer creates Events/Chapters only on explicit user Accept.
--
-- Run via Supabase SQL editor or `supabase db push`. Additive to 0004.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- life_events
-- ---------------------------------------------------------------------------
create table if not exists public.life_events (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  title         text        not null,
  description   text,
  -- Approximate-time model, same philosophy as memories.event_time_*.
  start_at      timestamptz,
  end_at        timestamptz,
  time_precision text       not null default 'unknown' check (time_precision in
                            ('exact','day','month','year','season','period','unknown')),
  -- Human time wording preserved verbatim (e.g. "late 1990s").
  time_label    text,
  location      text,
  status        text        not null default 'active' check (status in
                            ('active','archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists life_events_user_idx on public.life_events (user_id);
create index if not exists life_events_user_start_idx
  on public.life_events (user_id, start_at);

alter table public.life_events enable row level security;

drop policy if exists "life_events_owner_select" on public.life_events;
create policy "life_events_owner_select" on public.life_events
  for select using (auth.uid() = user_id);

drop policy if exists "life_events_owner_insert" on public.life_events;
create policy "life_events_owner_insert" on public.life_events
  for insert with check (auth.uid() = user_id);

drop policy if exists "life_events_owner_update" on public.life_events;
create policy "life_events_owner_update" on public.life_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "life_events_owner_delete" on public.life_events;
create policy "life_events_owner_delete" on public.life_events
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- life_chapters
-- ---------------------------------------------------------------------------
create table if not exists public.life_chapters (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  title         text        not null,
  description   text,
  start_at      timestamptz,
  end_at        timestamptz,
  time_precision text       not null default 'unknown' check (time_precision in
                            ('exact','day','month','year','season','period','unknown')),
  time_label    text,
  status        text        not null default 'active' check (status in
                            ('active','archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists life_chapters_user_idx on public.life_chapters (user_id);
create index if not exists life_chapters_user_start_idx
  on public.life_chapters (user_id, start_at);

alter table public.life_chapters enable row level security;

drop policy if exists "life_chapters_owner_select" on public.life_chapters;
create policy "life_chapters_owner_select" on public.life_chapters
  for select using (auth.uid() = user_id);

drop policy if exists "life_chapters_owner_insert" on public.life_chapters;
create policy "life_chapters_owner_insert" on public.life_chapters
  for insert with check (auth.uid() = user_id);

drop policy if exists "life_chapters_owner_update" on public.life_chapters;
create policy "life_chapters_owner_update" on public.life_chapters
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "life_chapters_owner_delete" on public.life_chapters;
create policy "life_chapters_owner_delete" on public.life_chapters
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- life_event_memories  (Memory <-> Event)
--   A Memory can be in zero/one/many Events. relationship_type is advisory.
-- ---------------------------------------------------------------------------
create table if not exists public.life_event_memories (
  id               uuid     primary key default gen_random_uuid(),
  user_id          uuid     not null references auth.users (id) on delete cascade,
  event_id         uuid     not null references public.life_events (id) on delete cascade,
  memory_id        uuid     not null references public.memories (id) on delete cascade,
  relationship_type text,
  position         integer  not null default 0,
  created_at       timestamptz not null default now(),

  -- A memory appears at most once per event.
  constraint life_event_memories_event_memory_uniq
    unique (event_id, memory_id)
);

create index if not exists life_event_memories_event_idx
  on public.life_event_memories (event_id);
create index if not exists life_event_memories_memory_idx
  on public.life_event_memories (memory_id);
create index if not exists life_event_memories_user_idx
  on public.life_event_memories (user_id);

alter table public.life_event_memories enable row level security;

drop policy if exists "life_event_memories_owner_select" on public.life_event_memories;
create policy "life_event_memories_owner_select" on public.life_event_memories
  for select using (auth.uid() = user_id);

drop policy if exists "life_event_memories_owner_insert" on public.life_event_memories;
create policy "life_event_memories_owner_insert" on public.life_event_memories
  for insert with check (auth.uid() = user_id);

drop policy if exists "life_event_memories_owner_update" on public.life_event_memories;
create policy "life_event_memories_owner_update" on public.life_event_memories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "life_event_memories_owner_delete" on public.life_event_memories;
create policy "life_event_memories_owner_delete" on public.life_event_memories
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- chapter_events  (Event <-> Chapter)
-- ---------------------------------------------------------------------------
create table if not exists public.chapter_events (
  id         uuid     primary key default gen_random_uuid(),
  user_id    uuid     not null references auth.users (id) on delete cascade,
  chapter_id uuid     not null references public.life_chapters (id) on delete cascade,
  event_id   uuid     not null references public.life_events (id) on delete cascade,
  position   integer  not null default 0,
  created_at timestamptz not null default now(),

  -- An event appears at most once per chapter. No self-reference is possible
  -- here (different tables); enforced conceptually.
  constraint chapter_events_chapter_event_uniq
    unique (chapter_id, event_id)
);

create index if not exists chapter_events_chapter_idx
  on public.chapter_events (chapter_id);
create index if not exists chapter_events_event_idx
  on public.chapter_events (event_id);
create index if not exists chapter_events_user_idx
  on public.chapter_events (user_id);

alter table public.chapter_events enable row level security;

drop policy if exists "chapter_events_owner_select" on public.chapter_events;
create policy "chapter_events_owner_select" on public.chapter_events
  for select using (auth.uid() = user_id);

drop policy if exists "chapter_events_owner_insert" on public.chapter_events;
create policy "chapter_events_owner_insert" on public.chapter_events
  for insert with check (auth.uid() = user_id);

drop policy if exists "chapter_events_owner_update" on public.chapter_events;
create policy "chapter_events_owner_update" on public.chapter_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "chapter_events_owner_delete" on public.chapter_events;
create policy "chapter_events_owner_delete" on public.chapter_events
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- chapter_memories  (Memory <-> Chapter, direct — no Event needed)
-- ---------------------------------------------------------------------------
create table if not exists public.chapter_memories (
  id         uuid     primary key default gen_random_uuid(),
  user_id    uuid     not null references auth.users (id) on delete cascade,
  chapter_id uuid     not null references public.life_chapters (id) on delete cascade,
  memory_id  uuid     not null references public.memories (id) on delete cascade,
  position   integer  not null default 0,
  created_at timestamptz not null default now(),

  -- A memory appears at most once per chapter.
  constraint chapter_memories_chapter_memory_uniq
    unique (chapter_id, memory_id)
);

create index if not exists chapter_memories_chapter_idx
  on public.chapter_memories (chapter_id);
create index if not exists chapter_memories_memory_idx
  on public.chapter_memories (memory_id);
create index if not exists chapter_memories_user_idx
  on public.chapter_memories (user_id);

alter table public.chapter_memories enable row level security;

drop policy if exists "chapter_memories_owner_select" on public.chapter_memories;
create policy "chapter_memories_owner_select" on public.chapter_memories
  for select using (auth.uid() = user_id);

drop policy if exists "chapter_memories_owner_insert" on public.chapter_memories;
create policy "chapter_memories_owner_insert" on public.chapter_memories
  for insert with check (auth.uid() = user_id);

drop policy if exists "chapter_memories_owner_update" on public.chapter_memories;
create policy "chapter_memories_owner_update" on public.chapter_memories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "chapter_memories_owner_delete" on public.chapter_memories;
create policy "chapter_memories_owner_delete" on public.chapter_memories
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- attach_memory_to_event_atomic
--   Verifies the event AND the memory both belong to the caller before
--   inserting the link. Rejects duplicates (unique index) and cross-user.
--   No-op (returns 'ok') if the link already exists (idempotent attach).
-- ---------------------------------------------------------------------------
create or replace function public.attach_memory_to_event_atomic(
  p_user_id        uuid,
  p_event_id       uuid,
  p_memory_id      uuid,
  p_relationship_type text,
  p_position       integer
) returns text
language plpgsql
as $$
declare
  v_event_owner uuid;
  v_mem_owner   uuid;
begin
  select user_id into v_event_owner from public.life_events where id = p_event_id;
  if v_event_owner is null then
    raise exception 'event not found';
  end if;
  if v_event_owner <> p_user_id then
    raise exception 'cross-user event';
  end if;

  select user_id into v_mem_owner from public.memories where id = p_memory_id;
  if v_mem_owner is null then
    raise exception 'memory not found';
  end if;
  if v_mem_owner <> p_user_id then
    raise exception 'cross-user memory';
  end if;

  insert into public.life_event_memories (user_id, event_id, memory_id, relationship_type, position)
  values (p_user_id, p_event_id, p_memory_id, p_relationship_type, p_position)
  on conflict (event_id, memory_id) do nothing;

  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- attach_event_to_chapter_atomic
--   Verifies the chapter AND the event both belong to the caller.
-- ---------------------------------------------------------------------------
create or replace function public.attach_event_to_chapter_atomic(
  p_user_id   uuid,
  p_chapter_id uuid,
  p_event_id  uuid,
  p_position  integer
) returns text
language plpgsql
as $$
declare
  v_chapter_owner uuid;
  v_event_owner   uuid;
begin
  select user_id into v_chapter_owner from public.life_chapters where id = p_chapter_id;
  if v_chapter_owner is null then
    raise exception 'chapter not found';
  end if;
  if v_chapter_owner <> p_user_id then
    raise exception 'cross-user chapter';
  end if;

  select user_id into v_event_owner from public.life_events where id = p_event_id;
  if v_event_owner is null then
    raise exception 'event not found';
  end if;
  if v_event_owner <> p_user_id then
    raise exception 'cross-user event';
  end if;

  insert into public.chapter_events (user_id, chapter_id, event_id, position)
  values (p_user_id, p_chapter_id, p_event_id, p_position)
  on conflict (chapter_id, event_id) do nothing;

  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- attach_memory_to_chapter_atomic
--   Verifies the chapter AND the memory both belong to the caller.
-- ---------------------------------------------------------------------------
create or replace function public.attach_memory_to_chapter_atomic(
  p_user_id   uuid,
  p_chapter_id uuid,
  p_memory_id uuid,
  p_position  integer
) returns text
language plpgsql
as $$
declare
  v_chapter_owner uuid;
  v_mem_owner     uuid;
begin
  select user_id into v_chapter_owner from public.life_chapters where id = p_chapter_id;
  if v_chapter_owner is null then
    raise exception 'chapter not found';
  end if;
  if v_chapter_owner <> p_user_id then
    raise exception 'cross-user chapter';
  end if;

  select user_id into v_mem_owner from public.memories where id = p_memory_id;
  if v_mem_owner is null then
    raise exception 'memory not found';
  end if;
  if v_mem_owner <> p_user_id then
    raise exception 'cross-user memory';
  end if;

  insert into public.chapter_memories (user_id, chapter_id, memory_id, position)
  values (p_user_id, p_chapter_id, p_memory_id, p_position)
  on conflict (chapter_id, memory_id) do nothing;

  return 'ok';
end;
$$;
