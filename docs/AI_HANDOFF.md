# Life in a Sound — AI Handoff Document

This is the primary continuation document for any future AI session (ChatGPT,
Claude, OpenHands, or otherwise). It lets a brand-new conversation resume work
without relying on chat history. The Git repository and project documentation
are the permanent source of truth; this file indexes them.

---

## Project Identity

- **Project name:** Life in a Sound
- **One-sentence description:** A personal music-memory companion that turns
  the songs of your life into a living, AI-narrated timeline of who you were,
  who you are, and who you are becoming.
- **Internal code name (repo / sprint docs):** SoundMap
- **Tagline:** Your Life. One Soundtrack.

---

## Product Vision

The 8-question journey is ONLY the initial onboarding. It is not the product.

The long-term product is a **lifelong music-memory companion**. Users should
eventually be able to return whenever an emotionally important or
life-changing moment happens and save a **music memory**.

A music memory may include:

- song (required minimum)
- artist
- date/time
- location
- weather
- life event / context
- feeling
- optional free-form note

Over time these memories form a **personal music-memory timeline**. The AI
interprets the user's own memories and patterns — it reflects, it does not
invent. AI must never invent personal facts (people, places, dates, weather,
events, songs, artists, memories, relationships).

See `docs/PRODUCT/PRODUCT_VISION.md` and `docs/PRODUCT/MUSIC_MEMORY.md` for the
full product/model design (kept separate from this technical handoff).

---

## Core Product Layers

1. **Music DNA** — A deterministic signature of how the user listens: dominant
   emotions, music style/mood, recommended genres. Today it is computed from
   the 8-question journey. Eventually it should be recomputed from accumulated
   music memories so it evolves with the user over time.

2. **Music Memory** — A single recorded moment tying a song to its context
   (date/time, location, weather, life event, feeling, optional note). Many
   memories, ordered by time, form the longitudinal music-memory timeline.
   Not yet implemented (no schema, no UI).

3. **Music Companion** — The generative/empathetic layer. The AI narrates the
   relationship between the user's songs, memories and Music DNA. It is the
   "voice" of Life in a Sound. Today this is the Life Story narrative (Sprint
   014). Eventually it interprets the whole memory timeline.

---

## Current Architecture

- **Frontend:** React 19 + TanStack Start (file-based router) + TanStack React
  Query, Tailwind v4, Radix UI, lucide-react icons.
- **Build/deploy:** Vite 8 → Nitro 3 (beta) → **Cloudflare Workers** target.
  `src/server.ts` is a Workers `fetch` handler; build emits
  `.output/server/wrangler.json`.
- **Data:** Supabase (Postgres + Auth) as server-side source of truth;
  `localStorage` as cache / offline fallback.
- **Auth:** Supabase **anonymous auth** only (no login UI, no real accounts).
  One anonymous user id per browser.
- **Deterministic AI pipeline:** `src/lib/ai/pipeline.ts`
  (`analyzeUserJourney`) — fully deterministic (FNV-1a hash of answer text).
  Produces archetype, emotions, traits, music profile, poetic summary, poster
  model, confidence. Identical answers always produce an identical profile.
  This is the factual source of truth.
- **TypeScript Orchestra bridge:** `src/lib/llm/orchestra.ts` — server-only TS
  runtime mirroring the Python `orchestra/router.py` role/provider spec, calling
  provider OpenAI-compatible endpoints via native `fetch`. Used by
  `src/lib/llm/generateStory.server.ts` (a TanStack Start `createServerFn`) to
  generate the Life Story narrative.
- **Python `orchestra/`** — canonical reference/spec for roles, role prompts,
  provider mappings and intended orchestration. **Untouched.** Not executed at
  runtime (Cloudflare Workers cannot run Python). Kept as the source of truth
  the TS bridge mirrors.

---

## Deterministic vs Generative AI

This distinction is the most important architectural rule in the project.

- **Deterministic engine** (`src/lib/ai/pipeline.ts` and modules in
  `src/lib/ai/`) = **factual source of truth**. Output is reproducible and
  grounded only in what the user supplied.
- **LLM (Orchestra / Story Engine)** = **narrative interpretation only**. The
  LLM rephrases, synthesises, and narrates; it must never become the source of
  a factual claim.

The LLM must **not** invent:

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

The LLM may interpret emotional relationships between supplied songs and the
deterministic personality profile, but only when grounded in the supplied
data. When the LLM is unavailable or fails, the deterministic output is always
shown as the fallback. The application never breaks because the LLM is down.

---

## Completed Milestones

| Sprint | Commit | Purpose |
|--------|--------|---------|
| Sprint 011 — Journey Persistence | `16fb0ba` (impl) + `8230598` (closeout) | Supabase journey persistence with anonymous auth + RLS; localStorage fallback/cache. Migration `0001_journeys.sql`. |
| Sprint 012 — Results Polish | `521eb0c` (impl) + `9d874ca` (closeout) | Replaced hardcoded Music DNA values with computed profile data; surfaced PosterModel fields in Cinematic Poster. |
| Sprint 013 — Timeline Improvements | `b33f43f` (impl) + `94e3855` (closeout) | Added per-question emotion labels to Emotional Timeline via existing `QUESTION_DIMENSIONS` + `EMOTION_BY_DIMENSION` maps; new helper `questionEmotions.ts` (read-only). |
| Sprint 014 — AI Story Engine | `2501bd2` | First real generative layer. TypeScript-native Orchestra bridge (`src/lib/llm/orchestra.ts`), grounded Life Story prompt (`src/lib/llm/prompts.ts`), server Story Engine (`src/lib/llm/generateStory.server.ts`). Life Story on Results now LLM-generated with deterministic fallback. 13 new tests (30 total). Phase 2 fully complete; Phase 3 begun. |

Earlier sprints (001–010): Landing Page, Journey Wizard, Results Page,
Responsive Design, documentation system.

> **Note:** Sprint 014 is committed (`2501bd2`) but its management closeout
> (SPRINT_BOARD / PROJECT_STATUS / ROADMAP / CTO_LOG updates marking Phase 3
> "AI Story Engine" done) had **not** been performed at the time this handoff
> was written — management docs still show Sprint 013 as the current sprint.
> The first job of the next session may be to perform that closeout.

---

## Current Repository State

- **Current branch:** `main`
- **HEAD commit:** `2501bd2` — Sprint 014 - AI Story Engine
- **Working tree:** expected **clean** (Sprint 014 was committed; this handoff
  adds only new untracked docs and does not commit them).
- **Remote push:** **NOT pushed.** `main` is **ahead of `origin/main` by 8
  commits** (all sprint work since `e08ad47`). Push only on explicit user
  instruction.
- **Commit history (latest 8):**
  ```
  2501bd2 Sprint 014 - AI Story Engine
  94e3855 Sprint 013 - Management Closeout
  b33f43f Sprint 013 - Timeline Improvements
  9d874ca Sprint 012 - Management Closeout
  521eb0c Sprint 012 - Results Polish
  8230598 Sprint 011 - Management Closeout
  16fb0ba Sprint 011 - Journey Persistence
  4cda012 Add LLM Orchestra infrastructure
  ```

---

## Important Architectural Decisions

- **Supabase anonymous auth for the current phase.** One anonymous user id per
  browser; the `journeys` row is owned by that id and protected by RLS. No
  login UI, no passwords, no friction.
- **localStorage fallback.** When Supabase env vars are absent or the request
  fails, persistence falls back to `localStorage` so the app always works.
- **Cloudflare Workers cannot run Python.** The Python `orchestra/` LiteLLM
  process cannot run inside the deployed worker.
- **Option 1 chosen: TypeScript-native Orchestra bridge.** Reimplemented the
  Orchestra's role→provider mapping in TS as `src/lib/llm/orchestra.ts`, calling
  provider OpenAI-compatible endpoints via native `fetch`. Keeps everything
  inside the Cloudflare Worker; no second runtime; no new dependencies.
- **Python `orchestra/` remains untouched as the canonical reference/spec.**
  The TS bridge is a faithful, documented port — it strips the LiteLLM
  provider prefix (e.g. `groq/qwen3.6-27b` → `qwen/qwen3.6-27b`) because it
  calls each provider's own endpoint directly rather than routing through
  LiteLLM. Model identifiers and key mappings match `router.py`.
- **Life Story has a deterministic fallback if the LLM fails.** The Results
  page calls the server Story Engine once per stable fingerprint; on success it
  shows the generated narrative, on any failure/loading/empty it shows the
  deterministic template. The app never breaks because the LLM is unavailable.
- **Provider API keys remain server-side only.** Keys are non-`VITE_`-prefixed
  (`GROQ_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`)
  in `.env`, read only inside server-only modules, never imported by client
  code, never present in the client bundle. The Supabase anon key is the only
  intentional `VITE_`-prefixed public credential (RLS-enforced).

---

## Do Not Change Without Explicit Approval

- **Deterministic scoring algorithms** (`src/lib/ai/personalityScoring.ts`,
  `emotionAnalyzer.ts`, `musicRecommendation.ts`, `poeticSummary.ts`,
  `posterModel.ts`, `pipeline.ts`). They are the factual source of truth.
- **Supabase schema** (`supabase/migrations/*`) unless a sprint explicitly
  requires it. RLS policies in `0001_journeys.sql` must be preserved.
- **Python `orchestra/`** — canonical reference/spec. Not executed at runtime.
- **Security boundaries / API-key handling.** Provider keys stay server-only
  and non-`VITE_`; the anon key is the only public credential; the service-role
  key never reaches the browser.
- **The Results page sections other than Life Story** (Personality Card, Music
  DNA, Emotional Timeline, Cinematic Poster) unless a sprint explicitly
  requires it.

---

## Known Limitations

- **Anonymous auth is not durable lifelong identity.** Anonymous users can be
  cleared by browser-data wipes; "lifelong" memory is not yet durable. True
  longitudinal memory likely needs Phase 4 (User Accounts).
- **No memories table yet.** There is only the `journeys` table (one row per
  user, 8 fixed song strings). The Music Memory model exists as a product
  design only (`docs/PRODUCT/MUSIC_MEMORY.md`), not as a schema or UI.
- **No longitudinal timeline yet.** Memories and the memory timeline are
  future work; the Emotional Timeline on the Results page is the 8-question
  journey's emotion sequence, not a lifelong memory timeline.
- **Current Life Story is the first generative feature.** Everything else in
  Results is deterministic. Only the Life Story prose is LLM-generated.
- **Current Music DNA still begins with the 8-question journey.** It does not
  yet incorporate stored memories; it will need to evolve as memories
  accumulate.

---

## Next Product Direction

Do **NOT** invent Sprint 015.

The next roadmap/design work is to **define the Music Memory data model before
implementation**. The memories table and the lifelong timeline are explicitly
deferred until that design is approved.

Open design questions (from `docs/PRODUCT/MUSIC_MEMORY.md`):

- One song per memory, or many songs per memory?
- Which context fields are optional vs required, and how do empty optionals
  behave in the timeline and in AI interpretation?
- Can memories be edited after creation? If so, what happens to AI
  interpretations already derived from the original?
- Can memories be deleted? Soft-delete vs hard-delete?
- Are duplicate songs allowed across memories (the same song across many
  moments)?
- Where are AI interpretations stored — re-derived on the fly, persisted
  alongside the memory, or both?
- How does the timeline scale across years and hundreds/thousands of memories?
- How does identity migrate from anonymous auth to real user accounts without
  losing data (Phase 4)?

---

## Continuation Protocol

Any AI resuming work on this project must:

1. **Read `docs/AI_HANDOFF.md` first** (this file).
2. **Read the management docs:** `docs/MANAGEMENT/SPRINT_BOARD.md`,
   `docs/MANAGEMENT/PROJECT_STATUS.md`, `docs/MANAGEMENT/ROADMAP.md`,
   `docs/CTO_LOG.md`, `docs/MANAGEMENT/DEVELOPMENT_STANDARD.md`.
3. **Inspect git:** `git log --oneline -10`, current HEAD, working tree status,
   remote sync status. Note that management docs may lag behind git (e.g. they
   may not yet reflect Sprint 014's closeout).
4. **Perform read-only discovery** before proposing any change. Understand the
   deterministic AI pipeline, the Supabase persistence layer, the TypeScript
   Orchestra bridge, and the security boundary before touching anything.
5. **Do not code until the user approves.** Read-only first.
6. **Never invent a sprint.** Wait for the user to scope it. One sprint at a
   time (see `DEVELOPMENT_STANDARD.md`).
7. **Preserve the product vision:** Life in a Sound is a lifelong music-memory
   companion, not an 8-question quiz. The 8-question journey is onboarding.
   The AI interprets; it never invents personal facts.

---

## Key File Index

- Deterministic AI pipeline: `src/lib/ai/pipeline.ts` (+ `personalityScoring.ts`,
  `emotionAnalyzer.ts`, `musicRecommendation.ts`, `poeticSummary.ts`,
  `posterModel.ts`, `questionEmotions.ts`, `types.ts`)
- TS Orchestra bridge: `src/lib/llm/orchestra.ts`
- Grounded Life Story prompt + deterministic fallback: `src/lib/llm/prompts.ts`
- Server Story Engine: `src/lib/llm/generateStory.server.ts`
- Life Story tests: `src/lib/llm/lifeStory.test.ts`
- Results page (Life Story section): `src/routes/results.tsx`
- Supabase client + session: `src/lib/supabase/client.ts`, `use-session.ts`,
  `journey-remote.ts`, `types.ts`
- Journey storage: `src/lib/journey-storage.ts`
- Supabase migration: `supabase/migrations/0001_journeys.sql`
- Python Orchestra (reference only): `orchestra/router.py`, `orchestra/config.yaml`
- Server entry (Workers fetch handler): `src/server.ts`
- Start config (CSRF middleware on server fns): `src/start.ts`

---

_End of AI handoff. The Git repository is the permanent source of truth._
