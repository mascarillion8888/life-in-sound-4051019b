# Life in a Sound — Persistent Project Checkpoint

> Canonical compact resume/save file. NOT a historical diary.
> Git HEAD is the authoritative source of truth; this file resumes current work.

## CURRENT CHECKPOINT

```
HEAD = 4c90958
BRANCH = migration/node-docker-v1
MAIN = 7070c45
HEAD_EQUALS_ORIGIN = YES
WORKTREE = CLEAN
```

## CURRENT PHASE

Open-Source Deployment Migration v1 — COMPLETE

## CURRENT TASK

Migration branch `migration/node-docker-v1` is ready for PR/merge to main.
Awaiting explicit user go-ahead to open the PR (do NOT merge to main yet).

## LAST COMPLETED SPRINT

Open-Source Deployment Migration v1 (Cloudflare/Wrangler → Node + Nitro + Docker)

Commits:
- `f30b857` — core migration (removed wrangler.jsonc/devDep/scripts; Nitro preset → node-server; added Dockerfile/docker-compose.yml/.dockerignore; updated docs)
- `4c90958` — Docker non-root runtime hardening + final verification

## COMPLETED PHASES

- Cloudflare Workers deployment foundation (prior phase, pushed to main)
- Pre-Beta Legal/IP/Data Readiness v1 (prior phase, pushed to main)
- Open-Source Deployment Migration v1 (this branch, ready for PR)

## ACTIVE ARCHITECTURE

- Runtime: Node.js v22 + Nitro (`node-server` preset)
- Production entry: `.output/server/index.mjs` (`node .output/server/index.mjs` / `npm run start`)
- Build: `npm run build` (Vite + Nitro)
- Containerization: Docker (multi-stage, Node 22, non-root `node` uid 1000, configurable PORT)
- Frontend: TanStack Start + React + Tailwind
- Backend/data: Supabase (unchanged), existing AI providers (Groq/Gemini/Mistral/OpenRouter)
- Fonts: Inter via Google Fonts CDN (variable font; no local font files)
- No Cloudflare/Wrangler active infrastructure

## TEST STATUS

641/641 passed (20 test files) — tsc exit 0, eslint clean on changed files

## BUILD STATUS

`npm run build` exit 0; Nitro preset `node-server`; entry `server/index.mjs`

## DEPLOYMENT STATUS

- Local Node server: all 13 routes 200 (9 static + 4 dynamic)
- Docker: multi-stage build OK (~336 MB minimal image), non-root uid 1000, `.env` excluded, no secrets baked in, PORT configurable (tested 3000 + 8080)
- Docker runtime smoke test: 13 routes 200, CSS/JS/favicon/robots/poster 200, Inter woff2 (CDN) all 200, no 404s
- Final repo purity check: ACTIVE_CLOUDFLARE = NONE (accepted). Remaining refs are transitive optional lockfile metadata (nitro dev tooling), historical migration documentation, and defensive .gitignore/.dockerignore entries.

## BLOCKERS

- None (migration v1 complete and verified).
- Separate/unrelated: Cloudflare auth-check token not injected (moot for this migration).

## NEXT TASK

Open PR `migration/node-docker-v1` → `main` upon explicit user go-ahead.

## DO NOT REVISIT

- Completed Companion work
- Golden Conversation tests
- Completed Memory architecture
- Completed Beta readiness work
- Completed IP/legal documentation
- Previous deployment experiments (Cloudflare)
- Open-Source Deployment Migration v1 (complete; purity check accepted)

## LAST UPDATED

2026-08-11
