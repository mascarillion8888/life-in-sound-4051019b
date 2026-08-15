# Environment variables and secrets — Cloudflare Workers deployment

This documents the runtime environment for the closed-beta Cloudflare Workers
deployment of Life in a Sound. It is the source of truth referenced by
`wrangler.jsonc` (root).

## Build-time vs runtime

Two categories of configuration must not be confused:

- **Build-time (inlined into the client bundle).** Any `VITE_*` variable is
  statically replaced by Vite at build time and baked into the shipped client
  assets. These must be present in the build environment (`.env`) when
  `npm run build` runs. They are **not** Worker runtime bindings.
- **Runtime (Worker env bindings).** Read at request time inside the Worker via
  `process.env` (Cloudflare `nodejs_compat` populates `process.env` from the
  Worker's `vars` and `secrets` bindings — verified empirically). These must
  **not** be present at build time; they must never be inlined.

## Runtime secret inventory (server-only)

These four LLM provider keys are read at runtime by the server-only Orchestra
bridge (`src/lib/llm/orchestra.ts`, `getApiKey()` → `process.env?.[keyEnv]`).
They are never shipped to the client, never inlined, and never written to
`wrangler.jsonc`. Set each as an encrypted Cloudflare Worker secret:

```bash
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put MISTRAL_API_KEY
npx wrangler secret put OPENROUTER_API_KEY
```

`wrangler.jsonc` declares these as required secrets (the `secrets.required`
list) so a missing key is surfaced before deploy rather than as a silent
runtime 500. The keys drive these roles (see `orchestra.ts` `ROLE_TO_PROVIDER`):

| Secret              | Used by roles                                         |
|---------------------|-------------------------------------------------------|
| GROQ_API_KEY        | namer, connector                                      |
| GEMINI_API_KEY      | interpreter, weaver                                   |
| MISTRAL_API_KEY     | reflector, companion                                  |
| OPENROUTER_API_KEY  | poet, summarizer                                      |

When a key is absent, the Orchestra falls back to the deterministic
non-LLM fallback per role (existing product behaviour — unchanged by
deployment).

## Build-time (public) variables

These are inlined into the client bundle at build time and are safe to ship
(RLS-enforced anon key). They live in `.env`, not in `wrangler.jsonc`:

| Variable                    | Purpose                          | Scope     |
|-----------------------------|----------------------------------|-----------|
| VITE_SUPABASE_URL           | Supabase project URL             | build-time|
| VITE_SUPABASE_ANON_KEY      | Supabase anon/public key (RLS)   | build-time|

The Supabase service-role key is **never** used by the client or the Worker;
auth is anonymous-first with RLS (no second hosting platform, no server-side
service-role access). This is unchanged by deployment.

## Local Cloudflare preview

To run the built Worker under the real workerd runtime locally (the most
faithful local preview of the deployed Worker):

```bash
npm run build
npm run cf:dev          # wrangler dev --local, http://localhost:8787
```

For local-only secret values during `cf:dev`, use a `.dev.vars` file (gitignored):
one `KEY=value` per line; `wrangler dev` loads it as local bindings. Never
commit `.dev.vars`.

## Deploy

```bash
npm run deploy          # build + wrangler deploy
# or check the upload without publishing:
npm run deploy:dry-run  # build + wrangler deploy --dry-run
```

`wrangler deploy` requires Cloudflare authentication (`wrangler login` or a
`CLOUDFLARE_API_TOKEN`). The first deploy creates the Worker
`mascarillion8888-life-in-sound-4051019b` on the authenticated account. Set
the four provider secrets (above) before/at first deploy; the Worker will
start without them (LLM roles fall back) but the beta is not functional
until they are set.
