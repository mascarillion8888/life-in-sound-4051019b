# Life in a Sound — Product Vision

> Life in a Sound is not a music quiz. It is a personal music-memory companion
> that grows with the user over years.

This document is product strategy, not technical documentation. For the
current architecture, see `docs/AI_HANDOFF.md` and `docs/TECH/`. For the Music
Memory model design, see `docs/PRODUCT/MUSIC_MEMORY.md`.

---

## The central idea

People do not experience music as a static list of favourites. They experience
it as a sequence of moments — a song that played the night everything changed,
a track that became a person, an album that held a whole year together. Life in
a Sound turns that lived relationship with music into something visible,
durable, and narrated.

The product grows with the user. The first visit is a single guided discovery.
Every visit after that is a chance to record another moment. Over months and
years, those moments accumulate into a personal music-memory timeline that
reflects who the user was, who they are, and who they are becoming.

---

## The initial 8-question discovery

Every user begins with an 8-question journey. It is gentle, fast, and
onboarding — not the product. The user offers eight songs, one per question,
and the deterministic engine derives their Music DNA: dominant emotions, music
style, recommended genres, an archetype, a poetic summary, and a cinematic
poster. The Results page then narrates a "Life Story" from those eight songs.

The 8-question journey is the **front door**, not the house. It exists so the
product has something rich to show on day one, before the user has recorded any
memories of their own. It must never be treated as the ceiling of the product.

---

## Lifelong memories

After onboarding, the user should be able to return whenever an emotionally
important or life-changing moment happens and save a music memory. A memory
ties a song to its context:

- the song (required minimum)
- artist
- date/time
- location
- weather
- life event / context
- feeling
- an optional free-form note

These are raw facts supplied by the user. The AI never invents them. The user
is the only authority on their own life.

---

## Emotional timeline

As memories accumulate, they form a longitudinal emotional timeline: a
chronology of the songs the user lived through, with the feelings and context
the user attached to each one. The timeline is not a playlist and not a
feed — it is a personal record of becoming, ordered by time, made of the
user's own words and choices.

---

## AI storytelling

The AI is the narrative voice of Life in a Sound. It interprets the
relationship between the user's songs, memories and Music DNA. It writes the
Life Story. Later, it will write across the whole memory timeline — finding
through-lines, returning to recurring songs, marking the seasons of a life.

Crucially, the AI interprets; it does not invent. It may describe how a song
feels against a profile, or how two memories echo each other, but it must never
fabricate people, places, dates, weather, events, songs, artists, or
relationships that the user did not supply. The deterministic engine is the
factual source of truth; the LLM is the voice.

When the AI is unavailable, the deterministic narrative is always shown. The
product never breaks because the AI is down.

---

## Pattern discovery

Over time, patterns emerge that the user could not see alone: the same song
returning at every turning point; a season of melancholy giving way to a season
of hope; a city showing up in memory after memory. The product surfaces these
patterns gently, as reflections rather than diagnoses, so the user can
recognise their own shape without feeling analysed.

---

## Companionship through music

The end goal is not data. It is companionship. Life in a Sound should feel like
a thoughtful friend who has been paying attention to the music of your life —
one who remembers what you were listening to when, who notices when a new song
starts to matter, and who can tell your story back to you in a way that helps
you keep becoming. That is the product. Everything else is in service of it.

---

## What this is not

- Not a music quiz.
- Not a recommendation engine for discovering new songs.
- Not a social network or public feed.
- Not a static profile to be filled out once.
- Not a place where the AI pretends to know the user's life.

---

_End of product vision._

