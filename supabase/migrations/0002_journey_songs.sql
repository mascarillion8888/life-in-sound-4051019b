-- Sprint 014 — Persist structured Song selections.
--
-- Adds a JSONB `songs` column to journeys so the full provider-neutral Song
-- object (title, artist, provider, providerId, artwork, isrc, album) survives
-- a refresh, not just the title strings already stored in `answers`.
--
-- RLS is per-row, not per-column: the existing owner policies from migration
-- 0001 cover this new column automatically — no new policies are needed. The
-- column defaults to '{}' so existing rows and inserts that omit `songs`
-- remain valid.

alter table public.journeys
  add column if not exists songs jsonb not null default '{}'::jsonb;

comment on column public.journeys.songs is
  'Structured Song selections per question id (provider-neutral Song objects).';
