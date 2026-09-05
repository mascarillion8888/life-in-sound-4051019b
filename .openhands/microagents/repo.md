# SoundMap — Repository Microagent

## What this repository does

**SoundMap** ("Life in a Sound") turns a user's life into a single soundtrack.
The core flow is an **8-question journey** where each question maps to a life
stage (childhood, coming of age, etc.) and the user selects a **real song** per
question via **MusicBrainz** search. From those 8 selections the app produces:

- a **Life Story** narrative (LLM-generated, with a deterministic fallback),
- a **Music DNA / personality profile** (deterministic, computed in
  `src/lib/ai/pipeline.ts`),
- an **emotional timeline**, and
- a **cinematic poster**.

Selections persist across refresh (structured `Song` objects in a JSONB
`songs` column, not just title strings). The product's only runtime LLM call is
the `summarizer` role that generates the Life Story.

> Note: the `orchestra/` Python directory is **development-only** (a multi-role,
> multi-provider LiteLLM spec used during authoring sessions). No code in
> `src/` imports or executes it. Do not wire product code to it.

## Tech stack

- **Framework**: TanStack Start (file-based routing + SSR), React 19, TanStack
  Router + TanStack Query
- **Build / dev server**: Vite 8 (via `@lovable.dev/vite-tanstack-config`)
- **Language**: TypeScript 5.8 (strict)
- **Server runtime**: Nitro (`src/server.ts` is the SSR entry referenced from
  `vite.config.ts`)
- **Styling**: Tailwind CSS 4, `tw-animate-css`, Radix UI primitives + shadcn
  components (`src/components/ui/`)
- **Backend / data**: Supabase (Postgres + Row Level Security). The browser
  uses the **anon** client only — no service-role key ever reaches the client.
  Migrations live in `supabase/migrations/`.
- **Music data**: MusicBrainz API (`src/lib/song/`), mapped into a
  provider-neutral `Song` type before crossing into the UI.
- **LLM bridge**: `src/lib/llm/orchestra.ts` — native `fetch` to the provider,
  no LiteLLM, no Python at runtime. Reads the provider key from a server-only
  env var (`GROQ_API_KEY`).
- **Testing**: Vitest 4 (jsdom environment)
- **Node**: 22.x

## Install dependencies

```bash
npm install
```

## Configure environment variables

Two categories — keep them separate:

### 1. Build-time (public, browser-safe — RLS enforces security)

Copy the example and fill from your Supabase project
(Project Settings → API):

```bash
cp .env.example .env
```

`.env` contents:

```
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

> The **service-role key must NEVER** be placed here or used client-side.

### 2. Runtime server secret (never `VITE_`-prefixed, never in the browser)

The Life Story LLM call needs a provider key available to server code. Set it
in your local environment (e.g. shell / `.env` is fine **only if** it is not
`VITE_`-prefixed — Vite only exposes `VITE_` vars to the client):

```bash
export GROQ_API_KEY=<your-groq-api-key>
```

Without `GROQ_API_KEY`, the Life Story falls back to the deterministic template
(`deterministicLifeStory`) — the app still works, just without the LLM
narrative.

### Database

Apply the migrations to your Supabase project (SQL editor or
`supabase db push`):

- `supabase/migrations/0001_journeys.sql` — `journeys` table + RLS
- `supabase/migrations/0002_journey_songs.sql` — `songs` JSONB column

## Run the application locally

```bash
npm run dev
```

Vite starts on `http://localhost:8080/` by default. (To expose it on a
specific host/port: `npx vite dev --port 12000 --host 0.0.0.0` — any
`allowedHosts` config is a temporary local concern, not committed.)

## Other useful commands

```bash
npm test            # run the Vitest suite once
npm run test:watch  # watch mode
npm run typecheck   # tsc --noEmit (0 errors expected)
npm run lint        # eslint .
npm run build       # production build → .output/
npm run preview     # preview the production build
```

## Conventions / gotchas

- File-based routing in `src/routes/` — do **not** create `src/pages/` or
  `app/layout.tsx` (Next.js/Remix patterns). `__root.tsx` is the only root
  layout; preserve its `<Outlet />`.
- `routeTree.gen.ts` is auto-generated — never edit by hand.
- Provider-neutral `Song` (`src/lib/song/types.ts`) is the internal model;
  MusicBrainz responses are mapped into it before reaching the UI.
- All Supabase rows are owner-scoped via RLS (`auth.uid() = user_id`). No
  service-role usage in client-reachable code.
