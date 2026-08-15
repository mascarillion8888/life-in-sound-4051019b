-- Companion Memory Foundation
--
-- The durable Companion Memory layer. A CONFIRMED Significant Interaction may
-- be promoted into a Companion Memory. Promotion is explicit, traceable,
-- ownership-verified, reversible (archive/delete), and grounded in the
-- original user interaction. No unconfirmed interaction may become Companion
-- Memory.
--
-- Provenance chain:
--   Companion Memory
--       ↓ significant_interaction_id
--   Significant Interaction
--       ↓ turn_id
--   Conversation Turn
--       ↓ conversation_id
--   Conversation
--
-- Design invariants enforced/represented here:
--   * Every row is owned by user_id (auth.uid() = user_id). RLS mandatory.
--   * Every Companion Memory references exactly ONE significant_interaction_id
--     (NOT NULL), and that interaction must be CONFIRMED before promotion.
--     The unique constraint on significant_interaction_id (WHERE not deleted)
--     prevents duplicate promotion — a Significant Interaction is promoted at
--     most once.
--   * kind is constrained to durable, user-expressed categories ONLY. It
--     EXCLUDES ai_fact / psychological_profile / diagnosis / personality_trait
--     / inferred_relationship / inferred_biography by construction — those
--     values are not in the CHECK constraint.
--   * status is active | archived only (no extra lifecycle states). Created
--     active; archive is reversible; deletion is explicit (a soft marker is
--     not used — DELETE is real, owner-scoped, RLS-enforced).
--   * source is user_confirmed only for v1 (no ai_generated Companion Memory).
--     The CHECK constraint locks this so future code cannot invent an
--     ai_generated source without a migration.
--   * Optional related_memory_id / related_event_id / related_chapter_id point
--     to EXISTING user-owned objects. They use ON DELETE SET NULL — deleting a
--     related Memory/Event/Chapter does NOT cascade-delete the Companion
--     Memory; the relationship safely detaches and the Companion Memory content
--     remains intact. The referenced objects' ownership is verified server-side
--     before linking (RLS + .eq user_id).
--   * The original conversation turn is NEVER mutated by Companion Memory
--     creation. The Companion Memory stores a concise user-approved
--     representation (copied from the confirmed candidate_content at promotion
--     time), not a replacement copy of the transcript.
--
-- Additive to 0008. No changes to significant_interactions, companion_turns,
-- companion_conversations, or any other existing table.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- companion_memories
-- ---------------------------------------------------------------------------
create table if not exists public.companion_memories (
  id                          uuid        primary key default gen_random_uuid(),
  user_id                     uuid        not null references auth.users (id) on delete cascade,
  significant_interaction_id  uuid        not null references public.significant_interactions (id) on delete cascade,
  kind                        text        not null
                              check (kind in ('directive', 'preference', 'confirmed_context', 'boundary', 'decision')),
  content                     text        not null,
  status                      text        not null default 'active'
                              check (status in ('active', 'archived')),
  source                      text        not null default 'user_confirmed'
                              check (source in ('user_confirmed')),
  related_memory_id           uuid        references public.memories (id) on delete set null,
  related_event_id            uuid        references public.life_events (id) on delete set null,
  related_chapter_id          uuid        references public.life_chapters (id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  archived_at                 timestamptz
);

-- A Significant Interaction is promoted at most once. The unique constraint on
-- significant_interaction_id guarantees no duplicate Companion Memory for the
-- same source interaction. (Rows are DELETEd on explicit user delete, so there
-- is no "deleted" marker to filter out — the constraint is a plain UNIQUE.)
create unique index if not exists companion_memories_si_uniq
  on public.companion_memories (significant_interaction_id);

create index if not exists companion_memories_user_id_idx
  on public.companion_memories (user_id, created_at desc);

create index if not exists companion_memories_user_active_idx
  on public.companion_memories (user_id, created_at desc)
  where status = 'active';

comment on table public.companion_memories is
  'Durable Companion Memory. Promoted from a CONFIRMED Significant Interaction '
  'via explicit user action. source is always user_confirmed in v1. Provenance: '
  'significant_interaction_id → turn_id → conversation_id. The original turn is '
  'never mutated; content is a concise user-approved representation.';

comment on column public.companion_memories.kind is
  'directive | preference | confirmed_context | boundary | decision only. '
  'Other categories are excluded by the CHECK constraint.';

comment on column public.companion_memories.status is
  'active | archived. Created active. Archive is reversible. Delete is explicit.';

comment on column public.companion_memories.source is
  'user_confirmed only in v1. No machine-generated source is permitted.';

comment on column public.companion_memories.significant_interaction_id is
  'Exactly one source Significant Interaction. UNIQUE — promoted at most once.';

comment on column public.companion_memories.related_memory_id is
  'Optional link to a user-owned Memory. ON DELETE SET NULL: deleting the Memory '
  'detaches the link but preserves the Companion Memory.';

comment on column public.companion_memories.related_event_id is
  'Optional link to a user-owned Life Event. ON DELETE SET NULL.';

comment on column public.companion_memories.related_chapter_id is
  'Optional link to a user-owned Life Chapter. ON DELETE SET NULL.';

alter table public.companion_memories enable row level security;

create policy "companion_memories_owner_select"
  on public.companion_memories for select
  using (auth.uid() = user_id);

create policy "companion_memories_owner_insert"
  on public.companion_memories for insert
  with check (auth.uid() = user_id);

create policy "companion_memories_owner_update"
  on public.companion_memories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "companion_memories_owner_delete"
  on public.companion_memories for delete
  using (auth.uid() = user_id);
