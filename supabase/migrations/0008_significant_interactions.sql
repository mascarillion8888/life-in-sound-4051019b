-- Significant Interaction Foundation
--
-- The middle layer between "conversation turn" and (later) "Companion Memory".
-- This phase answers ONLY: "Is this interaction worth remembering?"
--
-- It does NOT build:
--   * companion_memories table (a later phase promotes confirmed candidates)
--   * automatic durable memory creation
--   * vector search / embeddings
--
-- Design invariants enforced/represented here:
--   * Every row is owned by user_id (auth.uid() = user_id). RLS mandatory.
--   * Provenance: every candidate points back to its source conversation AND
--     turn (conversation_id + turn_id). The original turn is NEVER mutated or
--     copied as a replacement; candidate_content is an explicitly-marked
--     PROPOSED normalized memory statement, not the truth.
--   * A candidate is created by the classifier, but it can NEVER become
--     'confirmed' without explicit user action. No automatic confirmation.
--   * Only USER turns may be the source of a candidate. The application layer
--     enforces role == 'user' before classification; the schema documents it.
--   * A single turn should not produce duplicate ACTIVE candidates. A
--     fingerprint (turn_id + normalized candidate) plus a partial unique
--     index on (user_id, turn_id) WHERE status IN ('candidate','confirmed')
--     prevents duplicate active candidates per turn.
--   * kind is constrained to durable, user-expressed categories only. It
--     EXCLUDES ai_fact / psychological_profile / diagnosis / personality_trait
--     by construction — those values are not in the CHECK constraint.
--   * source distinguishes an explicit user ask (user_explicit) from an
--     AI-classified candidate (ai_classified).
--
-- Additive to 0007. No changes to companion_conversations, companion_turns,
-- or any other existing table.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- significant_interactions
-- ---------------------------------------------------------------------------
create table if not exists public.significant_interactions (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references auth.users (id) on delete cascade,
  conversation_id    uuid        not null references public.companion_conversations (id) on delete cascade,
  turn_id           uuid        not null references public.companion_turns (id) on delete cascade,
  kind               text        not null
                     check (kind in ('directive', 'preference', 'confirmed_context', 'boundary', 'decision')),
  candidate_content  text        not null,
  reason             text,
  status             text        not null default 'candidate'
                     check (status in ('candidate', 'confirmed', 'dismissed', 'archived')),
  source             text        not null default 'ai_classified'
                     check (source in ('user_explicit', 'ai_classified')),
  confidence         numeric     check (confidence is null or (confidence >= 0 and confidence <= 1)),
  fingerprint        text        not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Provenance lookups: by turn, and by conversation.
create index if not exists significant_interactions_turn_id_idx
  on public.significant_interactions (turn_id);

create index if not exists significant_interactions_conversation_id_idx
  on public.significant_interactions (conversation_id, created_at desc);

create index if not exists significant_interactions_user_id_idx
  on public.significant_interactions (user_id, created_at desc);

-- Prevent duplicate ACTIVE candidates for the same turn. A dismissed/archived
-- candidate does not block a future re-analysis of the same turn (the user may
-- change their mind later), but at most one candidate/confirmed row exists per
-- turn at a time. This is a partial unique index.
create unique index if not exists significant_interactions_active_per_turn_uniq
  on public.significant_interactions (user_id, turn_id)
  where status in ('candidate', 'confirmed');

comment on table public.significant_interactions is
  'Significant Interaction candidates. Provenance: conversation_id + turn_id. '
  'NOT a durable Companion Memory. A candidate becomes confirmed only via '
  'explicit user action; it is promoted to Companion Memory in a later phase.';

comment on column public.significant_interactions.kind is
  'directive | preference | confirmed_context | boundary | decision. '
  'Excludes ai_fact / psychological_profile / diagnosis / personality_trait.';

comment on column public.significant_interactions.candidate_content is
  'A PROPOSED normalized memory statement grounded in the source user turn. '
  'Explicitly a candidate — NOT the truth, NOT a copy of the original turn.';

comment on column public.significant_interactions.status is
  'candidate | confirmed | dismissed | archived. confirmed requires user action.';

comment on column public.significant_interactions.source is
  'user_explicit (the user asked to remember) | ai_classified (classifier proposed).';

comment on column public.significant_interactions.fingerprint is
  'Stable dedup key (turn_id + normalized candidate). Prevents duplicate active '
  'candidates per turn.';

alter table public.significant_interactions enable row level security;

create policy "significant_interactions_owner_select"
  on public.significant_interactions for select
  using (auth.uid() = user_id);

create policy "significant_interactions_owner_insert"
  on public.significant_interactions for insert
  with check (auth.uid() = user_id);

create policy "significant_interactions_owner_update"
  on public.significant_interactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "significant_interactions_owner_delete"
  on public.significant_interactions for delete
  using (auth.uid() = user_id);
