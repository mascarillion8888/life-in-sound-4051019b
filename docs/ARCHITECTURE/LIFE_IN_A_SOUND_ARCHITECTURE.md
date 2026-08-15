# Life in a Sound — Canonical Architecture

This is the canonical technical architecture document for the long-term Life in
a Sound product. It is a durable reference, not a sprint plan. It deliberately
separates the **long-term architecture** from the **current implementation**
(which is a subset of it).

Life in a Sound is no longer to be treated as merely an 8-question music quiz.
The 8-question Journey is the initial **"First Listen"** / onboarding layer.
The long-term product is a **lifelong personal music-memory companion**.

This document is documentation only. It implies no migration, no code change,
no new dependency, and no sprint. Where a decision is made, it is recorded as a
decision; where work is future, it is marked as future.

Companion documents:

- `docs/AI_HANDOFF.md` — AI continuation / current repository state.
- `docs/PRODUCT/PRODUCT_VISION.md` — product vision (narrative).
- `docs/PRODUCT/MUSIC_MEMORY.md` — Music Memory conceptual model.
- `docs/MANAGEMENT/ROADMAP.md` — phased roadmap.

---

## 1. PRODUCT ARCHITECTURE

The Companion is the experience / orchestration layer that sits **above** the
domain objects. It does not own the data; it composes and narrates it.

```
USER
├── IDENTITY
├── PROFILE
├── COMPANION PROFILE
├── MUSIC DNA
├── MEDIA
├── LIFE CHAPTERS
│   └── LIFE EVENTS
│       └── MUSIC MEMORIES
│           ├── MUSIC EXPERIENCES
│           ├── REFLECTIONS
│           ├── MEDIA
│           └── CONNECTIONS
├── PATTERNS
└── STORIES
```

The Companion orchestrates across all of these domains. Reading the tree
top-down is a containment view (a User contains Chapters; a Chapter contains
Events; an Event contains Memories); it is **not** a strict foreign-key
constraint. In particular:

- **Memory is the central long-term product object.** A Memory can stand alone.
- **A Memory does not require an Event or a Chapter.** Event and Chapter are
  optional grouping layers that can be added later and attached retroactively.
- The Companion is **not** a node in this tree; it is the layer above it.

---

## 2. DOMAIN MODEL

The domains, summarised:

| Domain | Role |
|--------|------|
| Identity | Who the user is (auth). |
| Profile | User-authored identity facts (display name, etc.). |
| Companion Profile | How the Companion speaks to this user (voice, tone, preferences). |
| Music DNA | The user's musical signature, deterministic then longitudinal. |
| Media | Independent media assets that may attach to many domains. |
| Life Chapters | Large-scale periods of a life (a year, a season, a phase). |
| Life Events | Significant occurrences within a chapter (a move, a loss, a beginning). |
| Music Memories | The central object: a song tied to a lived moment and its context. |
| Music Experiences | The music itself, broader than a streaming track. |
| Reflections | The user's later thoughts about a memory (additive, never overwriting). |
| Connections | Links between memories, experiences, events, media. |
| Patterns | Recurring structures the system detects across memories. |
| Stories | Generated narrative output. |
| Companion | Orchestration/experience layer above all of the above. |

---

## 3. IDENTITY MODEL

- **Anonymous identity is the current implementation.** Supabase anonymous auth
  produces one anonymous user id per browser; the `journeys` row is owned by
  that id and protected by Row Level Security.
- **Durable cross-device identity is future work.** Anonymous identity is not a
  durable lifelong identity — it can be lost on browser-data wipe.
- Identity migration from anonymous to a real account must not lose the user's
  memories (see section 20).

---

## 4. PROFILE MODEL

User-authored identity facts: display name, preferred pronouns, Companion
preferences, etc. Profile fields are **USER FACTS** supplied by the user; they
are not inferred and not generated.

The **Companion Profile** is a distinct, narrower concept: how the Companion
addresses and speaks to this user (voice, tone, formality, preferred length).
It is derived from explicit user choices plus Companion defaults — never from
inferred biography.

---

## 5. MUSIC DNA MODEL

Music DNA has two phases:

- **Initial Music DNA** comes from the **eight-question deterministic journey**
  (`src/lib/ai/pipeline.ts`). It is fully deterministic (identical answers →
  identical DNA) and is the factual source of truth for the onboarding profile.
- **Living Music DNA** is **future derived data** computed from longitudinal
  memories. As memories accumulate, Music DNA should be recomputed to reflect
  the user's evolving relationship with music. This does not exist yet.

Music DNA fields today: archetype, title, description, emotional profile,
traits, music style/mood, recommended genres, poetic summary, poster model,
confidence, raw scores/emotions.

---

## 6. MUSIC EXPERIENCE MODEL

A Music Experience is **broader than a streaming track**. It is "a piece of
music the user encountered", however they encountered it. Valid Music
Experiences include:

- a streaming track (the common case today),
- traditional / folk / hymnal music,
- family music (a song passed down, a lullaby),
- anonymous music (a track heard in passing, title unknown),
- unknown-title music ("I don't know what it was called, but…"),
- live music (a concert, a busker, a wedding band).

A Music Experience carries its own identity (title/artist where known, source
type) independent of any single Memory. **One Music Experience may appear in
multiple Memories** (the same song across many moments). **One Memory may
reference multiple Music Experiences** (a moment defined by several songs).

---

## 7. MUSIC MEMORY MODEL

A Music Memory is the **central long-term product object**. It records a moment
in which music mattered to the user.

- **Required minimum: the song** (as a Music Experience reference or free-text
  label). Everything else is optional.
- **A Memory does not require an Event or a Chapter.** It can stand alone; it
  can be grouped later.
- Optional context fields: artist, date/time, location, weather, life
  event/context, feeling, free-form note.
- A Memory may reference multiple Music Experiences, multiple Media items, and
  multiple Reflections, and may have Connections to other Memories/Events.
- The raw Memory is **USER FACT**, stored verbatim, never silently rewritten.

---

## 8. MEMORY LIFECYCLE

A Memory moves through states:

1. **Recorded** — the user captures the moment (song + any context).
2. **Contextualised** — the user adds or edits optional fields over time.
3. **Reflected on** — the user (or, later, the Companion) attaches Reflections.
4. **Connected** — links to other Memories, Events, Media are established.
5. **Patterned** — the system includes it in Pattern evidence.
6. **Narrated** — Stories reference it.
7. **Archived / Restricted / Deleted** — the user controls retention and usage.

Three distinct times are recorded and never conflated:

- **Event Time** — when the lived moment happened (may be approximate or
  absent).
- **Record Time** — when the user captured the Memory in the system.
- **Reflection Time** — when a Reflection was added.

**Exact dates are optional; approximate periods are valid.** "The summer of…",
"sometime in 2019", or no date at all are all legitimate. Absence is absence.

---

## 9. REFLECTION MODEL

A Reflection is a later thought about a Memory. Reflections are **additive**:
they layer onto a Memory over time. **Reflections do not overwrite original
Memory history.** The original Memory remains intact; Reflections are separate,
timestamped records attached to it.

Reflections may be user-authored or Companion-authored (clearly labelled). A
Companion-authored Reflection is **AI INTERPRETATION**, not a User Fact, and
must never be stored as or conflated with the original Memory.

---

## 10. LIFE EVENT MODEL

A Life Event is a significant occurrence (a move, a loss, a beginning, a
celebration) that may group one or more Memories. Events are optional; a Memory
can exist without one. **Event and Chapter can be added later**, including
retroactively to existing Memories.

An Event has its own Event Time (which may differ from the Record Times of its
Memories).

---

## 11. LIFE CHAPTER MODEL

A Life Chapter is a large-scale period (a year, a season, a phase) that groups
Events (and transitively Memories). Chapters are the coarsest grouping in the
tree. Like Events, they are optional and can be added later.

---

## 12. MEDIA MODEL

**Media is independent** and may relate to Profile, Memory, Event, or Chapter.
A photo, a short audio clip, a handwritten lyric image — these are Media assets
with their own identity, attachable to many domains. Media is not owned by a
Memory; it is referenced by a Memory (and possibly by several).

Media carries provenance (who added it, when) and is subject to the same
privacy/ownership rules as Memories.

---

## 13. CONNECTION MODEL

Connections are explicit links between entities: Memory↔Memory (two memories
echo each other), Memory↔Event, Memory↔Media, Experience↔Memory, etc.
Connections are **user-authored or system-suggested-but-confirmed**. A
suggested-but-unconfirmed connection is TRANSIENT, not a User Fact.

---

## 14. PATTERN MODEL

A Pattern is a recurring structure the system detects across Memories (a song
returning at every turning point; a season of melancholy; a city recurring).

- **Pattern evidence is separate from Pattern interpretation.** Evidence is the
  set of Memories/experiences that ground the Pattern; interpretation is the
  narrative the system (or Companion) builds from that evidence.
- Pattern evidence is DERIVED (computed from User Facts); Pattern
  interpretation is AI INTERPRETATION.
- Patterns are surfaced gently, as reflections, never as diagnoses.

---

## 15. STORY MODEL

A Story is **generated output, not source of truth.** The current Life Story
(Sprint 014) is the first Story. Future Stories narrate across the memory
timeline, Patterns, and Music DNA.

- A Story is always DERIVED/INTERPRETATION; it never becomes a User Fact.
- A Story references the Memories/Patterns/DNA it was built from (provenance).
- A Story may be regenerated; the underlying facts do not change when a Story
  is regenerated.
- When the AI is unavailable, the deterministic narrative is shown (Story has a
  deterministic fallback, as today).

---

## 16. COMPANION MODEL

**The Companion is not a database entity; it is an orchestration / experience
layer.** It composes across domains to produce the experience the user sees:
the voice, the timing, the retrieval, the narration, the gentle surfacing of
Patterns.

The Companion:

- retrieves relevant context (not the user's entire history),
- grounds the LLM in that context plus Music DNA,
- narrates Stories and Reflections,
- never invents personal biography,
- defers to the user as the sole authority on their own life.

The Companion Profile (section 4) governs *how* the Companion speaks; the
Companion layer governs *what* it does.

---

## 17. DATA PROVENANCE

Every piece of data in the system carries a provenance layer. These are the
**canonical data layers**:

| Layer | Trust | Examples |
|-------|-------|----------|
| **SOURCE / USER FACT** | Highest | The raw Memory, Profile fields, user-authored Reflections, user-confirmed Connections, Media the user added. Stored verbatim. |
| **DERIVED / COMPUTED** | Medium | Initial Music DNA (deterministic), Living Music DNA (future, from memories), Pattern evidence, indexes. Reproducible from USER FACT. |
| **AI INTERPRETATION** | Low | Stories, Companion-authored Reflections, Pattern interpretation. Clearly labelled, never stored as fact. |
| **TRANSIENT** | Lowest | Suggested-but-unconfirmed Connections, in-session retrieval state, draft text. Never persisted as fact. |

**Nothing generated at a lower-trust layer may silently become a higher-trust
source of truth.** An AI Story does not become a User Fact. A suggested
Connection does not become a confirmed Connection. Pattern interpretation does
not become Pattern evidence.

---

## 18. SOURCE-OF-TRUTH RULES

The chain of derivation is one-directional:

```
FACT → INTERPRETATION → PATTERN → STORY
```

- **FACT** (USER FACT) is the only source of truth. The user is the sole
  authority on their own life.
- **INTERPRETATION** is derived from FACT and may be regenerated.
- **PATTERN** is derived from FACT (evidence) and interpreted (narrative).
- **STORY** is generated from interpretation + pattern + DNA.

Each arrow is one-way. A Story cannot rewrite a Pattern; a Pattern cannot
rewrite a Fact. Regeneration flows downhill only.

**AI interpretation is never a User Fact.** This is the single most important
rule in the system and must be preserved end-to-end in implementation.

---

## 19. PRIVACY AND OWNERSHIP

- **The user owns the memory.** Memories, Media, Reflections, and Connections
  belong to the user who created them.
- **The user can eventually archive, delete, or restrict AI/Pattern usage.**
  Restriction means the user can mark a Memory as excluded from Pattern
  detection or AI narration without deleting the Memory itself.
- Memories are private by default. No public feed, no social graph.
- The raw Memory is inviolable: AI output is stored separately and never
  overwrites the user's original words.
- Delete must respect the layer rules: deleting a USER FACT must not leave
  derived INTERPRETATION/PATTERN/STORY pretending the fact still exists.
- Empty optional fields are absence, never an invitation to infer.

---

## 20. ANONYMOUS → PERMANENT IDENTITY

- **Anonymous identity is the current implementation.**
- **Durable cross-device identity is future work.**
- Migration from anonymous to a real account must rebind all of the user's
  domain objects (Identity, Profile, Memories, Media, Reflections, Connections,
  Patterns, Stories) to the new identity without data loss.
- An unclaimed anonymous timeline is a known edge case; its retention policy is
  an open product question (see `docs/PRODUCT/MUSIC_MEMORY.md`).

---

## 21. RETRIEVAL MODEL

- **The LLM must receive retrieved/relevant context, not the user's entire
  history.** Feeding the whole timeline into every prompt is neither scalable
  nor safe.
- **Supabase/Postgres is sufficient for the first Memory architecture.**
  Relational retrieval (by user, by time, by experience, by event) is enough to
  begin.
- **Future semantic/vector retrieval is allowed as an extension, not a
  prerequisite.** When introduced, it sits alongside Postgres as a retrieval
  accelerator, not as the system of record. The source of truth stays
  relational and USER FACT.

Retrieval returns context to ground the Companion; it does not return the
Companion's output.

---

## 22. AI GROUNDING RULES

The AI (Companion/LLM) **must never invent personal biography**. Concretely,
the LLM must not fabricate:

- people
- places
- dates
- weather
- events
- songs
- artists
- memories
- relationships
- any fact not explicitly present in the supplied input

Emotional interpretation is allowed only when grounded in supplied USER FACT and
the deterministic Music DNA. When the LLM is unavailable, the deterministic
narrative is shown. The product never breaks because the AI is down.

These rules are already enforced in the current Life Story prompt
(`src/lib/llm/prompts.ts`) and must be preserved in every future generated
output.

---

## 23. 1 → 10 → 100 → 1000 MEMORY SCALE

The architecture must stay usable as a single user accumulates memories:

- **1 memory** — the first recorded moment after onboarding. The product must
  feel complete and meaningful with just one.
- **10 memories** — a handful of moments. The timeline is a short list;
  Patterns are not yet meaningful; Stories narrate the few.
- **100 memories** — a real timeline. Grouping by Event/Chapter becomes useful;
  Patterns begin to surface; retrieval by time/experience matters.
- **1000 memories** — years of a life. The timeline must group, summarise, and
  search; semantic retrieval becomes valuable; Patterns are dense; Stories must
  select relevant context rather than narrate everything.

Every domain must be designed to degrade gracefully at each scale. Nothing
should require all 1000 memories to be loaded to render a single screen.

---

## 24. CURRENT IMPLEMENTATION STATUS

Repository verified at **HEAD `2501bd2` — Sprint 014 - AI Story Engine** on
branch `main`.

What exists and is committed:

- ✅ **Journey Persistence** — Sprint 011 (`16fb0ba`). Supabase `journeys`
  table, anonymous auth, RLS, localStorage fallback.
- ✅ **Results Polish** — Sprint 012 (`521eb0c`). Music DNA rendered from
  computed profile data; Poster fields surfaced.
- ✅ **Timeline Improvements** — Sprint 013 (`b33f43f`). Per-question emotion
  labels on the Emotional Timeline.
- ✅ **AI Story Engine** — Sprint 014 (`2501bd2`). TypeScript-native Orchestra
  bridge, grounded Life Story prompt, server Story Engine, Life Story UI with
  deterministic fallback.

What does **NOT** yet exist:

- ❌ **Music Memory database/schema** — only `journeys` (one row/user, 8 song
  strings). No memories table.
- ❌ **Longitudinal Memory UI** — no memory capture or timeline UI.
- ❌ **Life Event / Chapter system** — no schema, no UI.
- ❌ **Media system for the long-term memory product** — no media storage.
- ❌ **Pattern Engine** — no detection or evidence store.
- ❌ **Long-term Companion retrieval** — no relevant-context retrieval layer.
- ❌ **Durable real-account identity** — anonymous auth only.

The current implementation is a strict subset of this architecture: the
First Listen (8-question journey) plus deterministic DNA plus the first Story.
Everything else in this document is the target architecture toward which the
product grows.

---

## 25. FUTURE IMPLEMENTATION ORDER

Recommended order (no sprint numbers assigned):

1. **Music Memory foundation** — the central object: schema, capture, storage,
   ownership, RLS. The rest depends on this.
2. **Memory media attachment** — independent Media that references Memories.
3. **Life Events / Chapters** — optional grouping layers, retroactively
   attachable.
4. **Identity continuity** — anonymous → permanent migration without data loss.
5. **Memory retrieval** — relevant-context retrieval for the Companion
   (Postgres-first).
6. **Pattern Engine** — evidence + interpretation, clearly layered.
7. **Longitudinal Story Engine** — Stories across the timeline, grounded in
   retrieved context.
8. **Advanced Music Companion** — the full orchestration/experience layer.

Each step builds on USER FACT and preserves the layer rules. No step silently
promotes INTERPRETATION to FACT.

---

## 26. NON-GOALS

This architecture does **NOT** currently require:

- replacing Supabase,
- replacing TanStack Start,
- replacing the deterministic AI pipeline,
- changing the Python Orchestra,
- creating a Python sidecar,
- introducing vector search immediately,
- creating a graph database,
- building social/sharing features,
- creating real accounts immediately,
- implementing all future features at once.

It explicitly does **not** require:

- a graph database,
- a vector database,
- a microservice,
- or a separate memory service **yet**.

Future semantic/vector retrieval is permitted as a later extension, not a
prerequisite for the first Memory architecture.

---

## MANDATORY DECISIONS (RECORDED)

These decisions are binding on future implementation:

- Memory is the central long-term product object.
- Memory does not require an Event or Chapter.
- Event and Chapter can be added later.
- One Memory may reference multiple Music Experiences.
- One Music Experience may appear in multiple Memories.
- Media is independent and may relate to Profile, Memory, Event, or Chapter.
- Reflections do not overwrite original Memory history.
- Event Time, Record Time, and Reflection Time are distinct.
- Exact dates are optional; approximate periods are valid.
- A Music Experience is broader than a streaming track.
- Traditional, family, anonymous, unknown-title and live music are valid.
- Initial Music DNA comes from the eight-question deterministic journey.
- Living Music DNA is future derived data from longitudinal memories.
- AI interpretation is never a User Fact.
- Pattern evidence is separate from Pattern interpretation.
- Story is generated output, not source of truth.
- Companion is not a database entity; it is an orchestration/experience layer.
- Anonymous identity is the current implementation.
- Durable cross-device identity is future work.
- User owns the memory.
- User can eventually archive, delete, or restrict AI/pattern usage.
- The AI must never invent personal biography.
- The LLM must receive retrieved/relevant context, not the user's entire history.
- Supabase/Postgres is sufficient for the first Memory architecture.
- Do not introduce a graph database, vector database, microservice, or separate
  memory service yet.
- Future semantic/vector retrieval is allowed as an extension, not a
  prerequisite.

---

## CANONICAL DATA LAYERS (RECORDED)

```
SOURCE / USER FACT      ← highest trust, stored verbatim
DERIVED / COMPUTED      ← medium trust, reproducible from USER FACT
AI INTERPRETATION       ← low trust, clearly labelled, never stored as fact
TRANSIENT               ← lowest trust, never persisted as fact
```

Derivation chain (one-way):

```
FACT → INTERPRETATION → PATTERN → STORY
```

**Nothing generated at a lower-trust layer may silently become a higher-trust
source of truth.**

---

_End of canonical architecture. Documentation only — no migration, no code
change, no sprint implied._
