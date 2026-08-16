# Environment variables and secrets — Node.js + Nitro deployment

This documents the runtime environment for the closed-beta Node.js + Nitro
deployment of Life in a Sound. The production server entry is
`.output/server/index.mjs`, run with `node .output/server/index.mjs` (or via
the Docker image — see `Dockerfile` / `docker-compose.yml`). Supabase is
unchanged by this deployment model.

## Build-time vs runtime

Two categories of configuration must not be confused:

- **Build-time (inlined into the client bundle).** Any `VITE_*` variable is
  statically replaced by Vite at build time and baked into the shipped client
  assets. These must be present in the build environment (`.env`) when
  `npm run build` runs. They are **not** runtime environment variables.
- **Runtime (Node `process.env`).** Read at request time inside the Node
  server via the native `process.env` (no compatibility shim needed under
  Node). These must **not** be present at build time; they must never be
  inlined.

## Runtime secret inventory (server-only)

These four LLM provider keys are read at runtime by the server-only Orchestra
bridge (`src/lib/llm/orchestra.ts`, `getApiKey()` → `process.env?.[keyEnv]`).
They are never shipped to the client, never inlined, and never written into
the image. Provide them as runtime environment variables:

```bash
export GROQ_API_KEY=...
export GEMINI_API_KEY=...
export MISTRAL_API_KEY=...
export OPENROUTER_API_KEY=...
```

The keys drive these roles (see `orchestra.ts` `ROLE_TO_PROVIDER`):

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
(RLS-enforced anon key). They live in `.env`:

| Variable                    | Purpose                          | Scope     |
|-----------------------------|----------------------------------|-----------|
| VITE_SUPABASE_URL           | Supabase project URL             | build-time|
| VITE_SUPABASE_ANON_KEY      | Supabase anon/public key (RLS)   | build-time|

The Supabase service-role key is **never** used by the client or the server;
auth is anonymous-first with RLS (no server-side service-role access). This
is unchanged by deployment.

## Local Node preview

Build and run the production server under Node directly:

```bash
npm run build
npm run start          # node .output/server/index.mjs, http://localhost:3000
```

The port defaults to 3000; override with `PORT=4000 npm run start`. For
local-only runtime secrets, export them in your shell or use a gitignored
`.env` loaded by your process manager. Never commit secrets.

## Deploy (Node)

```bash
npm run build
# set the four provider secrets + PORT as needed, then:
npm run start
```

## Deploy (Docker)

A production `Dockerfile` (multi-stage: build with Node, run the Nitro server)
and a minimal `docker-compose.yml` are provided. The image builds the client
bundle and runs `node .output/server/index.mjs` on port 3000.

```bash
# build the image
docker build -t life-in-sound .

# run it (pass runtime secrets as env vars)
docker run --rm -p 3000:3000 \
  -e GROQ_API_KEY -e GEMINI_API_KEY \
  -e MISTRAL_API_KEY -e OPENROUTER_API_KEY \
  life-in-sound

# or with docker compose (set secrets in the environment or an env file)
docker compose up --build
```

The build-time `VITE_*` variables must be available at `docker build` time
(they are inlined into the client bundle). Runtime provider secrets are
supplied at `docker run` / `compose` time and are never baked into the image.
