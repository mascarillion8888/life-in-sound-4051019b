# Closed Beta Readiness

This document records the closed-beta readiness state of Life in a Sound as of
this checkpoint. It is written for the team running the closed beta, not for end
users. The end-user concept lives in the onboarding copy itself.

## What "closed beta" means here

- A small, invited group uses the live app.
- The product is feature-complete enough to reach **first value** (a saved
  memory + a Companion conversation) but is not yet hardened for public scale.
- We collect **structured, privacy-safe feedback**, not raw content.
- No billing or quotas are enforced; the cost governor is an interface only.

## First-value path (must work end to end)

1. Landing (`/`) → **Begin Your Journey** → `/journey` (8-question discovery).
2. Journey complete → `/results` (SoundMap poster, Music DNA, timeline).
3. Results **"This was your first listen"** section → **Save your first memory**
   → `/memory`.
4. Memory saved → **View this memory** → `/memory/$memoryId` (detail view).
5. From Results (or Profile) → `/companion` → start a conversation →
   `/companion/$conversationId`.

A new user should reach **first memory created** without navigating the whole
product and without a permanent account (anonymous-first auth).

## Onboarding clarity

- The 8-question Journey **is** the onboarding ("First Listen"). We did not
  add a separate onboarding wizard; we improved the existing flow.
- The Results page now states, in plain language, what the user can do next
  (save a memory, revisit it, discover patterns, build chapters, talk with a
  Companion).
- A subtle **Beta** indicator appears in the landing header so testers know
  this is not the final product.

## Instrumentation (privacy-safe)

`src/lib/telemetry.ts` is a tiny internal abstraction (no third-party SDK).
Rules enforced structurally:

- Only event names + low-risk categorical metadata are recorded.
- **Never** raw user messages, raw Memory/Reflection content, photographs,
  signed URLs, provider secrets, access tokens, full prompts, or full LLM
  responses. A forbidden-key list strips any such field as defence in depth.
- Deterministic in tests via an injectable `TelemetrySink` (default no-op).

Product events (closed set): `app_opened`, `onboarding_started`,
`onboarding_completed`, `memory_created`, `reflection_created`,
`connection_created`, `pattern_opened`, `event_created`, `chapter_created`,
`companion_started`, `companion_turn`, `companion_memory_confirmed`,
`story_requested`, `feedback_submitted`.

### AI usage observability (provider-neutral)

Each Companion turn records a content-free `ai_call` event:

- `capability` (what was called), `provider` (inferred from model name — never
  the API key), `model`, `success`, `fallback`, `latencyBucket`.
- Token counts are **omitted** in v1 because the Orchestra bridge does not
  expose usage. The contract has optional `inputTokens`/`outputTokens` fields
  for a future bridge that returns them safely.

This is captured in `companionConversation.server.ts` as a **telemetry hook
only** — the success/failure behaviour of the conversation is unchanged. The
Orchestra bridge (`src/lib/llm/orchestra.ts`) is untouched.

### Cost governor (interface only, v1)

`src/lib/aiUsage.ts` exposes `canUseAi(userId, capability)` and
`recordAiUsage(usage)`. In v1 `canUseAi` **always allows** (the closed beta is
unmetered; no user is blocked). The interface is structured so a future
governor can become a daily/monthly/capability budget or provider fallback
without changing call sites. No provider billing API is used.

## Feedback

`src/lib/feedback.ts` collects a minimal structured signal after two key first
experiences:

- **After the first memory** ("Did this feel meaningful?" → Yes / Somewhat /
  Not really).
- **After the first Companion turn** ("Was this helpful?" → Yes / Not really).

Only `kind` + `rating` are recorded — never raw memory text, reflection
content, or conversation contents. Ratings are a closed set; an invalid rating
records nothing. Feedback is recorded via the telemetry sink.

### Persistence note

v1 records feedback via the telemetry sink (default no-op; the closed beta may
log structured events server-side for dev review). **No new database table was
created** for feedback — it is not absolutely necessary for a closed beta, and
the privacy-safe structured signal is sufficient to guide iteration. If
persistent product analytics later requires a table, it will be justified in
this document before creation.

## Reliability / failure UX

`src/lib/reliability.ts` centralises the canonical user-safe failure messages.
The product must never show raw `500 Internal Server Error`, stack traces,
provider error bodies, or credential-related strings to a beta user. Each
failure mode has a calm, non-technical message that reassures the user their
own data is safe where applicable.

Persistence failures are **never** shown as success: a failed save surfaces a
clear "could not save" message; a successful save surfaces a clear "saved"
confirmation. The two never share a string.

## What is NOT in this beta (constraints respected)

- **No new domain tables.** No companion_memories extraction table, no
  significance-classifier table, no analytics table. Existing identity/memory
  trust model and tables are unchanged.
- **No vector / embeddings / pgvector.** None added.
- **No new LLM provider.** No service-role key in companion code. The Orchestra
  bridge and `src/lib/ai/` are untouched.
- **No new third-party analytics dependency.** Instrumentation is internal.
- **No billing or quotas.** The cost governor is an interface only.
- **No data reset button.** Beta accounts are not reset from the UI; see
  "Beta account reset" below.

## Beta account reset

There is no in-app reset button (deliberate — a reset button is a footgun in a
memory product). To identify and reset a beta test account:

1. Identify the account in the Supabase dashboard (Auth → Users). Beta test
   accounts created via anonymous auth have `is_anonymous = true`.
2. To reset a user's data without deleting the account, clear their
   owner-scoped rows in the existing tables (journey, memories, companion
   conversations/turns, significant interactions, companion memories). All
   access is owner-scoped via RLS; no service role is required for an
   owner-scoped clear performed from the dashboard.
3. To fully remove a tester, delete the user from Auth; RLS ensures their rows
   are no longer accessible.

This is a manual, dashboard-side operation performed by the team, not by the
tester.

## Verification gates

Before this checkpoint was pushed, all of the following passed:

- `npx tsc --noEmit` — clean.
- `npx vitest run` — all tests pass (existing 607 + new beta-readiness tests).
- `npm run lint` — clean.
- `npm run build` — clean.
- Secret-boundary scan — no `VITE_`-prefixed provider keys, no service-role
  key in companion code, no secrets in telemetry.
- Golden Conversation Test Suite — 35 scenarios + 4 invariants (39 tests)
  still pass.

See `MANUAL_TEST_SCRIPT.md` for the human QA script.
