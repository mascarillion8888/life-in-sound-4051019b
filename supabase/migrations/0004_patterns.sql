-- Pattern Engine Foundation (Sprint — Pattern Engine Foundation)
--
-- The first Pattern Engine layer: deterministic, evidence-backed patterns
-- derived from recorded user memories. This is NOT a psychological profiler.
-- It MUST NOT invent personal facts.
--
-- Canonical trust flow:
--   USER FACTS → DETERMINISTIC EVIDENCE → PATTERN CANDIDATE →
--   (OPTIONAL) ORCHESTRA INTERPRETATION → USER SEES EVIDENCE
--
-- Design invariants enforced/represented here:
--   * A Pattern is owned by user_id (auth.uid() = user_id).
--   * Every persisted Pattern MUST have >=2 evidence Memories linked via
--     pattern_memories (exception: revisited_memory may use 1 Memory with
--     multiple Reflections — enforced in the app layer, not here).
--   * Deterministic evidence lives in pattern_memories (queryable), NOT as an
--     opaque JSON blob. patterns.evidence_summary is denormalized text only.
--   * AI interpretation fields are a SEPARATE layer and are NULL until an
--     interpretation is generated. They NEVER modify memories/reflections/
--     music_experiences/pattern_memories.
--   * A deterministic fingerprint (user_id, pattern_type, fingerprint) prevents
--     duplicate patterns for the same type/value/evidence set.
--   * Lifecycle: candidate | active | dismissed. Dismissal is not deletion.
--   * Deleting a Memory cascades to its pattern_memories rows (evidence is
--     removed safely); the Pattern itself is not deleted but its evidence
--     shrinks. Deleting a Pattern never deletes Memories.
--
-- Run via Supabase SQL editor or `supabase db push`. Additive to 0003.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- patterns
--   A deterministic, evidence-backed pattern candidate for a user.
-- ---------------------------------------------------------------------------
create table if not exists public.patterns (
  id                          uuid        primary key default gen_random_uuid(),
  user_id                     uuid        not null references auth.users (id) on delete cascade,
  -- v1 valid values:
  --   repeated_music | repeated_location | recurring_time_context |
  --   revisited_memory | recurring_weather_context | recurring_user_emotion
  pattern_type                text        not null check (pattern_type in (
                                'repeated_music','repeated_location','recurring_time_context',
                                'revisited_memory','recurring_weather_context','recurring_user_emotion')),
  -- Deterministic human-readable title (e.g. "A song that follows you").
  title                       text        not null,
  -- Deterministic summary grounded in evidence (e.g. "Appears in 3 memories.").
  summary                     text        not null,
  -- Deterministic confidence 0..1 (facts = 1.0).
  confidence                  numeric(4,3) not null default 1.0
                                check (confidence >= 0 and confidence <= 1),
  -- Time range of the evidence (nullable when unknown).
  observed_from               timestamptz,
  observed_to                 timestamptz,
  -- Lifecycle: candidate | active | dismissed
  status                      text        not null default 'candidate'
                                check (status in ('candidate','active','dismissed')),
  -- Deterministic fingerprint: stable key for (type, value/evidence set) so
  -- the same discovery does not create a duplicate pattern. e.g.
  --   repeated_music:<musicExperienceId>
  --   repeated_location:<normalizedLocation>
  fingerprint                 text        not null,
  -- Denormalized evidence count for fast display (authoritative count is in
  -- pattern_memories).
  evidence_count              integer     not null default 0 check (evidence_count >= 0),

  -- ---- AI INTERPRETATION LAYER (NULL until generated) ----
  -- The interpretation is advisory; it is NEVER a user fact and NEVER mutates
  -- source data.
  interpretation               text,
  interpretation_model         text,
  interpretation_prompt_version text,
  interpretation_created_at    timestamptz,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  -- One pattern per (user, type, fingerprint).
  constraint patterns_user_type_fingerprint_uniq
    unique (user_id, pattern_type, fingerprint)
);

create index if not exists patterns_user_idx on public.patterns (user_id);
create index if not exists patterns_user_status_idx
  on public.patterns (user_id, status);

alter table public.patterns enable row level security;

drop policy if exists "patterns_owner_select" on public.patterns;
create policy "patterns_owner_select" on public.patterns
  for select using (auth.uid() = user_id);

drop policy if exists "patterns_owner_insert" on public.patterns;
create policy "patterns_owner_insert" on public.patterns
  for insert with check (auth.uid() = user_id);

drop policy if exists "patterns_owner_update" on public.patterns;
create policy "patterns_owner_update" on public.patterns
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "patterns_owner_delete" on public.patterns;
create policy "patterns_owner_delete" on public.patterns
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- pattern_memories
--   The evidence link: which Memories support a Pattern. This is authoritative
--   evidence (not an opaque blob) so the UI can explain "why this pattern?"
--   and open the underlying memories.
-- ---------------------------------------------------------------------------
create table if not exists public.pattern_memories (
  id           uuid        primary key default gen_random_uuid(),
  pattern_id   uuid        not null references public.patterns (id) on delete cascade,
  memory_id    uuid        not null references public.memories (id) on delete cascade,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  -- evidence_role documents how this memory supports the pattern (advisory).
  evidence_role text,
  created_at   timestamptz not null default now(),

  -- A memory appears at most once per pattern (no double-counting).
  constraint pattern_memories_pattern_memory_uniq
    unique (pattern_id, memory_id)
);

create index if not exists pattern_memories_pattern_idx
  on public.pattern_memories (pattern_id);
create index if not exists pattern_memories_memory_idx
  on public.pattern_memories (memory_id);
create index if not exists pattern_memories_user_idx
  on public.pattern_memories (user_id);

alter table public.pattern_memories enable row level security;

drop policy if exists "pattern_memories_owner_select" on public.pattern_memories;
create policy "pattern_memories_owner_select" on public.pattern_memories
  for select using (auth.uid() = user_id);

drop policy if exists "pattern_memories_owner_insert" on public.pattern_memories;
create policy "pattern_memories_owner_insert" on public.pattern_memories
  for insert with check (auth.uid() = user_id);

drop policy if exists "pattern_memories_owner_update" on public.pattern_memories;
create policy "pattern_memories_owner_update" on public.pattern_memories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "pattern_memories_owner_delete" on public.pattern_memories;
create policy "pattern_memories_owner_delete" on public.pattern_memories
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Atomic pattern + evidence creator.
-- Verifies every evidence Memory belongs to the caller before inserting.
-- Rejects duplicates via the unique fingerprint index (raises on conflict).
-- Returns the pattern id, or raises on: no evidence, cross-user evidence,
-- or duplicate fingerprint.
-- ---------------------------------------------------------------------------
create or replace function public.create_pattern_atomic(
  p_user_id        uuid,
  p_pattern_type   text,
  p_title          text,
  p_summary        text,
  p_confidence     numeric,
  p_observed_from  timestamptz,
  p_observed_to    timestamptz,
  p_status         text,
  p_fingerprint    text,
  p_evidence_count integer,
  p_evidence       jsonb
) returns uuid
language plpgsql
as $$
declare
  v_pattern_id uuid;
  v_link       jsonb;
  v_mem_owner  uuid;
  v_count      integer := 0;
begin
  if p_evidence is null or jsonb_array_length(p_evidence) = 0 then
    raise exception 'a pattern requires at least one evidence memory';
  end if;

  insert into public.patterns (
    user_id, pattern_type, title, summary, confidence,
    observed_from, observed_to, status, fingerprint, evidence_count
  )
  values (
    p_user_id, p_pattern_type, p_title, p_summary, p_confidence,
    p_observed_from, p_observed_to, p_status, p_fingerprint, p_evidence_count
  )
  returning id into v_pattern_id;

  foreach v_link in array jsonb_array_elements(p_evidence)
  loop
    v_count := v_count + 1;

    select user_id into v_mem_owner
      from public.memories
      where id = (v_link ->> 'memory_id')::uuid;

    if v_mem_owner is null then
      raise exception 'evidence memory not found';
    end if;
    if v_mem_owner <> p_user_id then
      raise exception 'cross-user evidence memory';
    end if;

    insert into public.pattern_memories (pattern_id, memory_id, user_id, evidence_role)
    values (
      v_pattern_id,
      (v_link ->> 'memory_id')::uuid,
      p_user_id,
      nullif(v_link ->> 'evidence_role', '')
    );
  end loop;

  return v_pattern_id;
end;
$$;
