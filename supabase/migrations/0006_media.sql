-- Media Foundation (Sprint — Media Foundation)
--
-- User-owned personal images attached to Profile, Memory, Life Event, and Life
-- Chapter. Media is an INDEPENDENT domain object: one media item may be
-- associated with multiple contexts. The binary file lives in Supabase Storage
-- (a PRIVATE bucket); Postgres stores only metadata + ownership + relationships.
--
-- Design invariants enforced/represented here:
--   * Every media + relationship row is owned by user_id (auth.uid() = user_id).
--   * storage_path is user-scoped: <user_id>/<media_id>/<sanitized-filename>.
--     The path namespace is the ownership boundary, NOT a browser-provided path.
--   * Bucket is PRIVATE. No public URLs. Access is via authenticated/signed
--     URLs only, generated only after media.user_id === current user.
--   * v1 MIME allowlist: image/jpeg | image/png | image/webp (enforced in app
--     layer + check constraint as defense-in-depth).
--   * No AI metadata, no captions, no tags in v1.
--   * Relationships are independent: deleting a Memory/Event/Chapter/Profile
--     does NOT delete the media object (it may be referenced elsewhere). Only a
--     direct media deletion removes the file + all relationships.
--   * Duplicate relationship rows are prevented by unique indexes.
--
-- Run via Supabase SQL editor or `supabase db push`. Additive to 0005.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Private Storage bucket for user media. Created idempotently; if it already
-- exists (e.g. created via dashboard) this is a no-op. The app assumes a bucket
-- named 'user_media' that is NOT public.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('user_media', 'user_media', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- media  (metadata + ownership only; binary lives in Storage)
-- ---------------------------------------------------------------------------
create table if not exists public.media (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users (id) on delete cascade,
  storage_path      text        not null,
  original_filename text,
  mime_type         text        not null check (mime_type in
                                  ('image/jpeg','image/png','image/webp')),
  byte_size         bigint      not null check (byte_size > 0),
  width             integer,
  height            integer,
  captured_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists media_user_idx on public.media (user_id);

alter table public.media enable row level security;

drop policy if exists "media_owner_select" on public.media;
create policy "media_owner_select" on public.media
  for select using (auth.uid() = user_id);

drop policy if exists "media_owner_insert" on public.media;
create policy "media_owner_insert" on public.media
  for insert with check (auth.uid() = user_id);

drop policy if exists "media_owner_update" on public.media;
create policy "media_owner_update" on public.media
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "media_owner_delete" on public.media;
create policy "media_owner_delete" on public.media
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage RLS: a user may only read/write objects under their own namespace
-- (<user_id>/...). This is the storage-side enforcement of the ownership
-- boundary; the app also checks media.user_id before any signed URL.
-- ---------------------------------------------------------------------------
drop policy if exists "user_media_owner_read" on storage.objects;
create policy "user_media_owner_read" on storage.objects
  for select using (
    bucket_id = 'user_media' and (auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "user_media_owner_insert" on storage.objects;
create policy "user_media_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'user_media' and (auth.uid())::text = (storage.foldername(name))[1]
  );

drop policy if exists "user_media_owner_delete" on storage.objects;
create policy "user_media_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'user_media' and (auth.uid())::text = (storage.foldername(name))[1]
  );

-- ---------------------------------------------------------------------------
-- profile_media  (Profile <-> Media; at most one active current image)
-- ---------------------------------------------------------------------------
create table if not exists public.profile_media (
  id         uuid     primary key default gen_random_uuid(),
  user_id    uuid     not null references auth.users (id) on delete cascade,
  media_id   uuid     not null references public.media (id) on delete cascade,
  is_current boolean  not null default false,
  position   integer  not null default 0,
  created_at timestamptz not null default now(),

  constraint profile_media_user_media_uniq unique (user_id, media_id)
);

create index if not exists profile_media_user_idx on public.profile_media (user_id);
create index if not exists profile_media_current_idx
  on public.profile_media (user_id, is_current);

alter table public.profile_media enable row level security;

drop policy if exists "profile_media_owner_select" on public.profile_media;
create policy "profile_media_owner_select" on public.profile_media
  for select using (auth.uid() = user_id);

drop policy if exists "profile_media_owner_insert" on public.profile_media;
create policy "profile_media_owner_insert" on public.profile_media
  for insert with check (auth.uid() = user_id);

drop policy if exists "profile_media_owner_update" on public.profile_media;
create policy "profile_media_owner_update" on public.profile_media
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "profile_media_owner_delete" on public.profile_media;
create policy "profile_media_owner_delete" on public.profile_media
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- memory_media  (Memory <-> Media)
-- ---------------------------------------------------------------------------
create table if not exists public.memory_media (
  id         uuid     primary key default gen_random_uuid(),
  user_id    uuid     not null references auth.users (id) on delete cascade,
  media_id   uuid     not null references public.media (id) on delete cascade,
  memory_id  uuid     not null references public.memories (id) on delete cascade,
  position   integer  not null default 0,
  created_at timestamptz not null default now(),

  constraint memory_media_memory_media_uniq unique (memory_id, media_id)
);

create index if not exists memory_media_memory_idx on public.memory_media (memory_id);
create index if not exists memory_media_media_idx on public.memory_media (media_id);
create index if not exists memory_media_user_idx on public.memory_media (user_id);

alter table public.memory_media enable row level security;

drop policy if exists "memory_media_owner_select" on public.memory_media;
create policy "memory_media_owner_select" on public.memory_media
  for select using (auth.uid() = user_id);

drop policy if exists "memory_media_owner_insert" on public.memory_media;
create policy "memory_media_owner_insert" on public.memory_media
  for insert with check (auth.uid() = user_id);

drop policy if exists "memory_media_owner_update" on public.memory_media;
create policy "memory_media_owner_update" on public.memory_media
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "memory_media_owner_delete" on public.memory_media;
create policy "memory_media_owner_delete" on public.memory_media
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- event_media  (Life Event <-> Media)
-- ---------------------------------------------------------------------------
create table if not exists public.event_media (
  id         uuid     primary key default gen_random_uuid(),
  user_id    uuid     not null references auth.users (id) on delete cascade,
  media_id   uuid     not null references public.media (id) on delete cascade,
  event_id   uuid     not null references public.life_events (id) on delete cascade,
  position   integer  not null default 0,
  created_at timestamptz not null default now(),

  constraint event_media_event_media_uniq unique (event_id, media_id)
);

create index if not exists event_media_event_idx on public.event_media (event_id);
create index if not exists event_media_media_idx on public.event_media (media_id);
create index if not exists event_media_user_idx on public.event_media (user_id);

alter table public.event_media enable row level security;

drop policy if exists "event_media_owner_select" on public.event_media;
create policy "event_media_owner_select" on public.event_media
  for select using (auth.uid() = user_id);

drop policy if exists "event_media_owner_insert" on public.event_media;
create policy "event_media_owner_insert" on public.event_media
  for insert with check (auth.uid() = user_id);

drop policy if exists "event_media_owner_update" on public.event_media;
create policy "event_media_owner_update" on public.event_media
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "event_media_owner_delete" on public.event_media;
create policy "event_media_owner_delete" on public.event_media
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- chapter_media  (Life Chapter <-> Media)
-- ---------------------------------------------------------------------------
create table if not exists public.chapter_media (
  id         uuid     primary key default gen_random_uuid(),
  user_id    uuid     not null references auth.users (id) on delete cascade,
  media_id   uuid     not null references public.media (id) on delete cascade,
  chapter_id uuid     not null references public.life_chapters (id) on delete cascade,
  position   integer  not null default 0,
  created_at timestamptz not null default now(),

  constraint chapter_media_chapter_media_uniq unique (chapter_id, media_id)
);

create index if not exists chapter_media_chapter_idx on public.chapter_media (chapter_id);
create index if not exists chapter_media_media_idx on public.chapter_media (media_id);
create index if not exists chapter_media_user_idx on public.chapter_media (user_id);

alter table public.chapter_media enable row level security;

drop policy if exists "chapter_media_owner_select" on public.chapter_media;
create policy "chapter_media_owner_select" on public.chapter_media
  for select using (auth.uid() = user_id);

drop policy if exists "chapter_media_owner_insert" on public.chapter_media;
create policy "chapter_media_owner_insert" on public.chapter_media
  for insert with check (auth.uid() = user_id);

drop policy if exists "chapter_media_owner_update" on public.chapter_media;
create policy "chapter_media_owner_update" on public.chapter_media
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "chapter_media_owner_delete" on public.chapter_media;
create policy "chapter_media_owner_delete" on public.chapter_media
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- attach_media_to_context_atomic
--   Generic ownership-verified attach for memory/event/chapter context.
--   Verifies the media AND the context object both belong to the caller before
--   inserting the relationship. Idempotent (unique index + on conflict).
--   'p_context' is one of: 'memory' | 'event' | 'chapter'.
-- ---------------------------------------------------------------------------
create or replace function public.attach_media_to_context_atomic(
  p_user_id   uuid,
  p_media_id  uuid,
  p_context   text,
  p_context_id uuid,
  p_position  integer
) returns text
language plpgsql
as $$
declare
  v_media_owner uuid;
  v_ctx_owner   uuid;
begin
  select user_id into v_media_owner from public.media where id = p_media_id;
  if v_media_owner is null then
    raise exception 'media not found';
  end if;
  if v_media_owner <> p_user_id then
    raise exception 'cross-user media';
  end if;

  if p_context = 'memory' then
    select user_id into v_ctx_owner from public.memories where id = p_context_id;
    if v_ctx_owner is null then raise exception 'memory not found'; end if;
    if v_ctx_owner <> p_user_id then raise exception 'cross-user memory'; end if;
    insert into public.memory_media (user_id, media_id, memory_id, position)
    values (p_user_id, p_media_id, p_context_id, p_position)
    on conflict (memory_id, media_id) do nothing;
  elsif p_context = 'event' then
    select user_id into v_ctx_owner from public.life_events where id = p_context_id;
    if v_ctx_owner is null then raise exception 'event not found'; end if;
    if v_ctx_owner <> p_user_id then raise exception 'cross-user event'; end if;
    insert into public.event_media (user_id, media_id, event_id, position)
    values (p_user_id, p_media_id, p_context_id, p_position)
    on conflict (event_id, media_id) do nothing;
  elsif p_context = 'chapter' then
    select user_id into v_ctx_owner from public.life_chapters where id = p_context_id;
    if v_ctx_owner is null then raise exception 'chapter not found'; end if;
    if v_ctx_owner <> p_user_id then raise exception 'cross-user chapter'; end if;
    insert into public.chapter_media (user_id, media_id, chapter_id, position)
    values (p_user_id, p_media_id, p_context_id, p_position)
    on conflict (chapter_id, media_id) do nothing;
  else
    raise exception 'unknown context';
  end if;

  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- set_current_profile_media_atomic
--   Verifies the media belongs to the caller, inserts the profile_media row,
--   and atomically unsets any other is_current row for the caller (so the
--   profile has at most one active current image). Old media is NOT deleted.
-- ---------------------------------------------------------------------------
create or replace function public.set_current_profile_media_atomic(
  p_user_id  uuid,
  p_media_id uuid
) returns text
language plpgsql
as $$
declare
  v_media_owner uuid;
begin
  select user_id into v_media_owner from public.media where id = p_media_id;
  if v_media_owner is null then
    raise exception 'media not found';
  end if;
  if v_media_owner <> p_user_id then
    raise exception 'cross-user media';
  end if;

  -- Unset any existing current for this user, then insert/set the new current.
  update public.profile_media set is_current = false where user_id = p_user_id and is_current;

  insert into public.profile_media (user_id, media_id, is_current, position)
  values (p_user_id, p_media_id, true, 0)
  on conflict (user_id, media_id) do update set is_current = true;

  return 'ok';
end;
$$;
