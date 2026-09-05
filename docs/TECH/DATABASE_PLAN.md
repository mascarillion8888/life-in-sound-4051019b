# Database Plan — SoundMap

> **Status: DRAFT / DESIGN PROPOSAL — not implemented.** This document is a
> preparation artifact for Phase 4 (Music Memory). It proposes a concrete schema
> that resolves the open design questions in
> [`docs/PRODUCT/MUSIC_MEMORY.md`](../PRODUCT/MUSIC_MEMORY.md). Nothing here is
> built. It must be reviewed and approved before any migration is written.
>
> Scope guardrail: this proposal adds memory-logging capability on top of the
> existing `journeys` table. It does **not** re-introduce the Companion/Memory/
> Pattern/Event/Chapter/Reflection systems that were removed from main
> (see `legacy/companion-v1-2026-08-15`). Those are out of scope and would
> require explicit user direction.

---

## Current state (baseline)

The only persistence today is the `journeys` table (migration `0001`) extended
with a `songs` JSONB column (migration `0002`):

```
journeys
  id          uuid PK
  user_id     uuid FK -> auth.users  (one row per user)
  current     int     (1..8)
  answers     jsonb   {qid: title_string}
  songs       jsonb   {qid: Song}        -- migration 0002
  version     int
  created_at, updated_at
```

RLS is owner-scoped (select/insert/update/delete on `auth.uid() = user_id`).
There is exactly one active journey per user (`journeys_user_id_uniq`).

The `journeys` row is a _session_, not a _memory_: it captures the 8-question
onboarding. A Music Memory is a different, longitudinal unit (see
`MUSIC_MEMORY.md`). The two coexist; one does not replace the other.

---

## Proposed schema — Phase 4 Music Memory

### Table: `memories`

A Music Memory is one row. The only required field is the song (mirroring the
product model). Provider-neutral `Song` is reused from `src/lib/song/types.ts`
so a memory can carry a structured song (from MusicBrainz search) _or_ a
free-text label when the user types one without searching.

```
memories
  id            uuid PK default gen_random_uuid()
  user_id       uuid NOT NULL FK -> auth.users ON DELETE CASCADE
  song          jsonb NOT NULL                 -- provider-neutral Song OR free-text
  artist        text                            -- optional, denormalized for sort/filter
  happened_at   timestamptz                    -- optional; the moment it captures (NOT record time)
  location      text                            -- optional free text / place name
  weather       text                            -- optional
  life_event    text                            -- optional context label
  feeling       text                            -- optional emotion label(s)
  note          text                            -- optional free-form note
  source        text NOT NULL default 'user'   -- CHECK (source = 'user')
  status        text NOT NULL default 'active' -- CHECK (status in 'active','archived','deleted')
  created_at    timestamptz NOT NULL default now()   -- record time
  updated_at    timestamptz NOT NULL default now()
```

**Indexes**

- `memories_user_id_created_idx` on `(user_id, created_at desc)` — timeline list.
- `memories_user_id_happened_idx` on `(user_id, happened_at desc)` — chronological timeline. NULLs last.
- `memories_user_id_status_idx` on `(user_id, status)` — active vs archived filtering.

**RLS**: owner-scoped, mirroring `journeys` (select/insert/update/delete on
`auth.uid() = user_id`). No service-role in client code.

### Decisions on the open design questions (proposed)

These resolve the "Future questions still undecided" in `MUSIC_MEMORY.md`.
Each is a proposal to confirm, not a fait accompli.

1. **One song per memory (1:1).** A memory is atomic to a single song. A
   multi-song moment (an album, a playlist) is modelled as several memories
   sharing the same `happened_at` + `life_event`. Rationale: keeps the unit
   simple and sortable; the timeline groups by `happened_at` naturally.

2. **Empty optionals are NULL, displayed as "—"** (never inferred). Matches
   the "empty means empty" privacy principle. The timeline hides NULLs in
   compact view; the detail view shows "—".

3. **Editing is allowed; AI interpretations are invalidated, not versioned.**
   On edit, derived interpretations (`memory_interpretations` rows, see below)
   are marked `stale` and re-derived lazily on next view. Keeps the raw memory
   the single source of truth; no version table in v1.

4. **Soft-delete (`status = 'deleted'`), with a hard-purge job.** Deletion
   sets `status='deleted'`; a scheduled purge removes the row + derived
   interpretations after a grace window (e.g. 30 days). Restorable within the
   window. Matches "delete must mean delete" once the purge runs.

5. **Duplicate songs across memories are allowed and surfaced.** The same
   song in multiple moments is a feature, not a bug. The timeline shows a
   "this song appears in N memories" affordance — a pattern hint, not a fact.

6. **AI interpretation: stored separately, re-derivable, never overwrites
   the raw memory.** A `memory_interpretations` table holds derived text
   keyed to the memory at derivation time. Re-deriving produces a new row;
   old rows are kept as snapshots but marked `superseded`. The raw memory is
   never mutated.

```
memory_interpretations
  id            uuid PK
  memory_id     uuid FK -> memories ON DELETE CASCADE
  user_id       uuid NOT NULL FK -> auth.users ON DELETE CASCADE  -- for RLS scoping
  kind          text CHECK in ('reflection','throughline','pattern')  -- NOT 'diagnosis'
  content       text NOT NULL
  model         text                     -- which provider/model (for provenance)
  derived_at    timestamptz NOT NULL default now()
  status        text CHECK in ('active','stale','superseded')
  source_memory_snapshot jsonb           -- immutable copy of the memory at derivation time
```

RLS owner-scoped. `source_memory_snapshot` ensures an interpretation stays
truthful to the memory _as it was when derived_, even after the memory is
edited (stale/superseded handling).

### Timeline scaling (v1)

- Default view: last 50 memories, infinite scroll by `created_at` cursor.
- Grouping by `happened_at` year/month for long timelines.
- Search by song title / artist / note (SQL `ilike`, no vector search in v1 —
  same retrieval principle as the existing codebase: explicit, deterministic).

### Identity migration (anonymous -> account)

- Anonymous memories are written with the anon user_id.
- On account creation/linking, a one-time migration job re-parents the
  anon user's `memories` (and `memory_interpretations`) rows to the new
  `auth.users.id`.
- This is a Phase 4.5 concern; the schema supports it by keying everything on
  `user_id` with no other identity-bearing column.

---

## What this proposal deliberately does NOT add

- No companion conversation table, no patterns, no events, no chapters, no
  reflections-as-facts, no pgvector/embeddings, no service-role in client
  code, no new AI provider. (These were the removed companion-v1 surface;
  re-introducing them is out of scope and requires explicit direction.)
- No billing/quotas, no public feed, no social graph.

---

## Migration plan (sketch — to write only after approval)

- `0003_memories.sql` — create `memories` + indexes + RLS + updated_at trigger
  (mirror the `0001` pattern).
- `0004_memory_interpretations.sql` — create the interpretations table + RLS
  (deferred until the AI derivation path is actually built; can land later).

Each migration keeps the `comment on column` strings free of forbidden
category names (the CHECK constraint is the real enforcement).

---

## Open for review

Before any migration is written, confirm:

- [ ] 1:1 song-per-memory is correct (vs 1:many).
- [ ] Soft-delete + purge grace window (vs hard-delete).
- [ ] Interpretation storage approach (snapshot + stale/superseded).
- [ ] Whether `memory_interpretations` lands in Phase 4 or Phase 4.5.
- [ ] Identity migration approach (anon -> account re-parenting).
