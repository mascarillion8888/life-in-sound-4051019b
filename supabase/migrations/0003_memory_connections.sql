-- Memory Connections (Sprint — Memory Connection Foundation)
--
-- The explicit connection layer between existing Music Memories. This is NOT
-- the Pattern Engine, NOT Life Events or Chapters. It is the factual/owned
-- connection graph that future Pattern Discovery will consume.
--
-- Design invariants enforced/represented here:
--   * Every connection is owned by user_id (auth.uid() = user_id).
--   * A connection references two OWNED memories (source + target).
--   * Self-connections are rejected.
--   * Undirected deterministic types are stored in a normalized order
--     (lower(source_memory_id), higher(target_memory_id)) so A→B and B→A do
--     not both exist.
--   * Uniqueness per (user_id, source_memory_id, target_memory_id,
--     connection_type) prevents duplicates.
--   * Deterministic connection != AI interpretation. AI-suggested semantic
--     similarity is stored as source='ai_suggested' and is NEVER
--     auto-persisted; it must be user-accepted.
--   * Connections never modify the memories they reference.
--
-- Run via Supabase SQL editor or `supabase db push`. Additive to 0002.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- memory_connections
--   A directed-stored, undirected-for-deterministic-types link between two
--   memories owned by the same user.
-- ---------------------------------------------------------------------------
create table if not exists public.memory_connections (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users (id) on delete cascade,
  -- Stored normalized for undirected types: lower(source_memory_id).
  source_memory_id  uuid        not null references public.memories (id) on delete cascade,
  target_memory_id  uuid        not null references public.memories (id) on delete cascade,
  -- Constrained text contract (not a hard enum) so future types are additive.
  -- v1 valid values: same_music | same_location | overlapping_time | user_linked
  connection_type   text        not null check (connection_type in
                                ('same_music','same_location','overlapping_time','user_linked')),
  -- source: user | deterministic | ai_suggested
  source            text        not null check (source in
                                ('user','deterministic','ai_suggested')),
  -- confidence 0..1. Deterministic facts = 1.0; AI suggestions in (0,1).
  confidence        numeric(4,3) not null default 1.0
                                check (confidence >= 0 and confidence <= 1),
  -- Advisory, human-readable reason (mainly for AI suggestions). NULL-safe.
  reason            text,
  -- JSONB metadata for future-safe narrow fields (never replaces source data).
  metadata          jsonb       not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),

  -- No self-connections.
  constraint memory_connections_no_self check (source_memory_id <> target_memory_id)
);

-- Normalize undirected ordering at the DB level: source is the lower id.
-- (Checked via trigger below for robustness across client inserts.)

create or replace function public.normalize_connection_order()
returns trigger
language plpgsql
as $$
begin
  if new.source_memory_id > new.target_memory_id then
    -- Swap so the lower id is always source (undirected normalization).
    new.source_memory_id := new.target_memory_id;
    new.target_memory_id := OLD.source_memory_id;
  end if;
  return new;
end;
$$;

drop trigger if exists memory_connections_normalize_order on public.memory_connections;
create trigger memory_connections_normalize_order
  before insert or update on public.memory_connections
  for each row execute function public.normalize_connection_order();

-- Uniqueness: one connection per (user, pair, type).
-- Undirected types share the normalized pair so A→B and B→A collide.
create unique index if not exists memory_connections_pair_type_uniq
  on public.memory_connections (user_id, source_memory_id, target_memory_id, connection_type);

create index if not exists memory_connections_user_idx
  on public.memory_connections (user_id);
create index if not exists memory_connections_source_idx
  on public.memory_connections (source_memory_id);
create index if not exists memory_connections_target_idx
  on public.memory_connections (target_memory_id);

alter table public.memory_connections enable row level security;

drop policy if exists "memory_connections_owner_select" on public.memory_connections;
create policy "memory_connections_owner_select" on public.memory_connections
  for select using (auth.uid() = user_id);

drop policy if exists "memory_connections_owner_insert" on public.memory_connections;
create policy "memory_connections_owner_insert" on public.memory_connections
  for insert with check (auth.uid() = user_id);

drop policy if exists "memory_connections_owner_update" on public.memory_connections;
create policy "memory_connections_owner_update" on public.memory_connections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "memory_connections_owner_delete" on public.memory_connections;
create policy "memory_connections_owner_delete" on public.memory_connections
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Atomic, ownership-verified connection creator.
-- Verifies BOTH memories belong to the caller before inserting. Returns the
-- connection id, or raises on: self-connection, cross-user, or duplicate.
-- ---------------------------------------------------------------------------
create or replace function public.create_connection_atomic(
  p_user_id          uuid,
  p_source_memory_id uuid,
  p_target_memory_id uuid,
  p_connection_type  text,
  p_source           text,
  p_confidence       numeric,
  p_reason           text,
  p_metadata         jsonb
) returns uuid
language plpgsql
as $$
declare
  v_connection_id uuid;
  v_src_owner uuid;
  v_tgt_owner uuid;
begin
  if p_source_memory_id = p_target_memory_id then
    raise exception 'self-connection rejected';
  end if;

  select user_id into v_src_owner from public.memories where id = p_source_memory_id;
  select user_id into v_tgt_owner from public.memories where id = p_target_memory_id;

  if v_src_owner is null or v_tgt_owner is null then
    raise exception 'memory not found';
  end if;
  if v_src_owner <> p_user_id or v_tgt_owner <> p_user_id then
    raise exception 'cross-user memory reference';
  end if;

  -- Insert; the normalize_order trigger swaps ids so the lower id is source.
  -- The unique index on (user_id, source, target, type) rejects duplicates.
  insert into public.memory_connections (
    user_id, source_memory_id, target_memory_id,
    connection_type, source, confidence, reason, metadata
  )
  values (
    p_user_id, p_source_memory_id, p_target_memory_id,
    p_connection_type, p_source, p_confidence, p_reason, p_metadata
  )
  returning id into v_connection_id;

  return v_connection_id;
end;
$$;
