> **Implementation status note (added on `restore-work`):** Same status as
> `PRODUCT_VISION.md` — this is the product design for a feature (unlimited,
> anytime memory logging beyond the 8-question journey) that is **not yet
> built** in this branch. No `memories` table, no schema, no UI exists here.
> Treat as design reference for a future sprint, not current state.

# Music Memory — Conceptual Model

This is a product/model design document. It describes what a Music Memory *is*
and the principles that govern it. It is deliberately **not** a schema, an API,
or an implementation plan. No SQL, no TypeScript types, no storage decisions
belong here — those are deferred until the design is approved and a sprint is
scoped.

See `docs/PRODUCT/PRODUCT_VISION.md` for the surrounding vision and
`docs/AI_HANDOFF.md` for the current technical state and continuation protocol.

---

## What is a Music Memory?

A Music Memory is a single recorded moment in which a song mattered to the user.
It is the atomic unit of the lifelong music-memory timeline. Where the
8-question journey asks the user to recall eight songs up front, a Music Memory
asks them to capture one moment, in its full context, as it happens or shortly
after.

A Music Memory is **user-authored fact**. The user supplies the song and any
context they choose to attach. The product stores what the user gives it —
nothing more. The AI may later interpret the relationship between memories, but
it never authors or alters the raw memory.

---

## Required minimum: song

The only required field is **the song**. Everything else is optional. This
parallels the current journey, where the only thing the user supplies per
question is a song title. Keeping the song as the single required field means
recording a memory can be as fast as naming a track; the user can add context
later, or never.

The song is a free-text label supplied by the user (a title, optionally with an
artist). It is treated as a user-provided label, not as evidence about the
user's actual life.

---

## Optional context fields

Beyond the song, a Music Memory may carry context the user chooses to attach:

- **artist** — who performed or is associated with the song.
- **date/time** — when the moment happened (or when the user is recording it).
  May be a specific timestamp or a vague period ("the summer of...").
- **location** — where the moment happened. Free text or a place name.
- **weather** — the weather at the time, if the user finds it meaningful.
- **life event / context** — what was happening in the user's life (a move, a
  breakup, a beginning, a loss, a celebration).
- **feeling** — the emotion(s) the user associates with the moment.
- **note** — an optional free-form note in the user's own words.

All optional fields may be left empty. Empty optionals are not "unknown facts";
they are simply absent. The product and the AI must treat absence as absence,
never as an invitation to infer.

---

## Raw facts vs AI interpretation

This distinction is foundational and must be preserved end-to-end.

- **Raw facts** are what the user supplied: the song, the artist, the date, the
  location, the weather, the life event, the feeling, the note. These are the
  source of truth. They are stored verbatim and never silently rewritten.
- **AI interpretation** is anything the product generates from those facts: a
  Life Story, a through-line across memories, a pattern, a reflection. It is
  derivative. It is clearly labelled as interpretation, never presented as a
  fact, and never stored *as* the memory.

The AI must **not** invent:

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

Emotional interpretation is allowed only when grounded in the supplied memory
and the deterministic Music DNA. If a field is absent, the AI must not fill it
in. When the AI is unavailable, the raw facts are still fully usable on their
own.

---

## Privacy principles

- **The user is the only authority on their own life.** The product never
  corrects, contradicts, or "knows better than" the user about their memories.
- **Memories are private by default.** A memory belongs to the user who
  recorded it. There is no public feed, no social graph, no sharing unless the
  user explicitly chooses it (a Phase 4 concern).
- **The raw memory is inviolable.** AI output is stored separately from, and
  never overwrites, the user's original words and choices.
- **Empty means empty.** Optional fields are never inferred from other fields
  or from the song itself (e.g. the product does not guess a location from a
  song's lyrics).
- **Delete must mean delete.** If the user removes a memory, the raw fact and
  any derived interpretations tied to it must not linger as if the memory still
  exists. (Soft-delete vs hard-delete is an open implementation question.)

---

## Longitudinal timeline concept

Memories are ordered by time into a **personal music-memory timeline**: the
chronology of the songs the user lived through, with the feelings and context
they attached to each one.

The timeline is:

- **personal** — only the user's memories.
- **chronological** — ordered by the moment each memory captures, not by when
  it was recorded.
- **living** — new memories extend it; it is never "finished".
- **reflective, not diagnostic** — the product surfaces patterns as gentle
  reflections, never as diagnoses of the user.

Over years, the timeline becomes the spine of the product: the raw material
from which Music DNA evolves, the AI narrates, and patterns are discovered.

---

## Future questions still undecided

These are open design questions. They must be resolved before implementation,
not during it. Listing them here so the next design session starts from a
shared frame.

- **One song per memory, or many songs per memory?** A single moment may
  involve a whole album or a playlist; the model must decide whether a memory
  is 1:1 with a song or 1:many.
- **Optional metadata behaviour.** How do empty optionals behave in the
  timeline view and in AI interpretation? Are they hidden, shown as "—", or
  omitted entirely?
- **Editing memories.** Can a user edit a memory after creating it? If they
  do, what happens to AI interpretations already derived from the original?
  Are interpretations re-derived, versioned, or invalidated?
- **Deleting memories.** Soft-delete vs hard-delete? If a memory is deleted,
  are derived interpretations removed too? Can deletion be undone?
- **Duplicate songs across memories.** The same song may matter across many
  moments. Is that allowed, encouraged, or surfaced as a pattern?
- **AI interpretation storage.** Are interpretations re-derived on the fly each
  time, persisted alongside the memory, or both? If persisted, do they become
  immutable snapshots tied to the memory's state at derivation time?
- **Timeline scaling.** How does the timeline stay usable across years and
  hundreds or thousands of memories? Grouping, summarising, infinite scroll,
  search?
- **Identity migration.** How does a user's memory timeline migrate from
  anonymous auth to a real account (Phase 4) without losing data? What happens
  to an anonymous timeline that is never claimed?

---

_End of Music Memory model design._
