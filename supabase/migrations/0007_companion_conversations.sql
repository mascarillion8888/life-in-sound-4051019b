-- Companion Conversation Foundation (Sprint — Companion Conversation Foundation)
--
-- First-class conversation abstraction for the Companion. This phase builds
-- ONLY the Conversation Foundation: conversations + turns. It does NOT build:
--   * companion_memories table
--   * significance classifier
--   * automatic memory extraction
--   * vector search / embeddings / semantic retrieval
--
-- Design invariants enforced/represented here:
--   * Every conversation + turn row is owned by user_id (auth.uid() = user_id).
--   * A turn belongs to exactly one conversation; conversation_id FK is
--     ON DELETE CASCADE so deleting a conversation removes its turns.
--   * auth.users deletion cascades to conversations and turns (user_id FK
--     ON DELETE CASCADE).
--   * Conversation content is HISTORICAL context only. It is NOT automatically
--     Memory, Pattern, Event, Chapter, or Companion Memory. A turn is just a
--     turn. No durable memory is inferred from it in this phase.
--   * Content is preserved exactly as produced. No rewriting/summarizing of
--     historical turns in place. Any future summary is additive + separate.
--   * role is constrained to user | assistant | system. v1 stores user and
--     assistant turns (system only if required by implementation).
--
-- Additive to 0006. No changes to existing tables.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- companion_conversations
-- ---------------------------------------------------------------------------
create table if not exists public.companion_conversations (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users (id) on delete cascade,
  title             text,
  status            text        not null default 'active'
                    check (status in ('active', 'archived')),
  started_at        timestamptz not null default now(),
  last_activity_at  timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists companion_conversations_user_id_idx
  on public.companion_conversations (user_id, last_activity_at desc);

comment on table public.companion_conversations is
  'Companion conversations. Owned by one user. Historical context only — NOT memory.';

alter table public.companion_conversations enable row level security;

create policy "companion_conversations_owner_select"
  on public.companion_conversations for select
  using (auth.uid() = user_id);

create policy "companion_conversations_owner_insert"
  on public.companion_conversations for insert
  with check (auth.uid() = user_id);

create policy "companion_conversations_owner_update"
  on public.companion_conversations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "companion_conversations_owner_delete"
  on public.companion_conversations for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- companion_turns
-- ---------------------------------------------------------------------------
create table if not exists public.companion_turns (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users (id) on delete cascade,
  conversation_id   uuid        not null references public.companion_conversations (id) on delete cascade,
  role              text        not null check (role in ('user', 'assistant', 'system')),
  content           text        not null,
  created_at        timestamptz not null default now(),
  metadata          jsonb
);

create index if not exists companion_turns_conversation_id_idx
  on public.companion_turns (conversation_id, created_at asc);

create index if not exists companion_turns_user_id_idx
  on public.companion_turns (user_id, created_at desc);

comment on table public.companion_turns is
  'Companion conversation turns. Historical content only — NOT memory. role: user | assistant | system.';

alter table public.companion_turns enable row level security;

create policy "companion_turns_owner_select"
  on public.companion_turns for select
  using (auth.uid() = user_id);

create policy "companion_turns_owner_insert"
  on public.companion_turns for insert
  with check (auth.uid() = user_id);

create policy "companion_turns_owner_delete"
  on public.companion_turns for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- last_activity_at maintenance: bump on each new turn.
-- A trigger keeps the conversation's last_activity_at in sync with its newest
-- turn so list ordering reflects real activity without app-side updates.
-- ---------------------------------------------------------------------------
create or replace function public.bump_conversation_last_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.companion_conversations
     set last_activity_at = now(),
         updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists companion_turns_bump_activity on public.companion_turns;
create trigger companion_turns_bump_activity
  after insert on public.companion_turns
  for each row execute function public.bump_conversation_last_activity();
