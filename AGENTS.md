<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Companion Memory Foundation (phase complete)

The durable Companion Memory layer sits on top of the Significant Interaction
layer. Flow: confirmed Significant Interaction → explicit promotion → a
`companion_memories` row → list/archive/restore/delete/update/provenance.

- **Migration**: `supabase/migrations/0009_companion_memories.sql` — UNIQUE on
  `significant_interaction_id` (at most one memory per source interaction),
  FK `significant_interaction_id` ON DELETE CASCADE; related-object FKs
  (`related_memory_id`/`related_event_id`/`related_chapter_id`) ON DELETE SET
  NULL. `kind` CHECK is `directive | preference | confirmed_context |
  boundary | decision` (no `ai_fact`/psychological/diagnosis categories);
  `source` CHECK is `user_confirmed` only; `status` CHECK is
  `active | archived`. RLS: four owner policies (`auth.uid() = user_id`).
- **Types**: `CompanionMemoryRow` in `src/lib/supabase/types.ts`;
  `CompanionMemory` (domain) + `CompanionMemoryProvenance` in
  `src/lib/memory/types.ts`.
- **Persistence**: `src/lib/supabase/companion-memory-remote.ts` —
  `createCompanionMemory` (dedup via `loadCompanionMemoryBySignificantInteraction`
  + unique constraint), `listCompanionMemories`/`listActiveCompanionMemories`,
  `loadCompanionMemory`, `loadCompanionMemoryBySignificantInteraction`,
  `updateCompanionMemory` (content only), `archiveCompanionMemory`,
  `restoreCompanionMemory`, `deleteCompanionMemory`,
  `loadCompanionMemoryProvenance`. All owner-scoped (userId param).
- **Promotion**: `src/lib/llm/promoteSignificantInteraction.server.ts` —
  `promoteSignificantInteractionLogic` is the ONLY creation path in v1. It
  (1) derives userId from `getCurrentUser(accessToken)` (no browser userId),
  (2) loads the Significant Interaction and verifies status === `confirmed`
  AND owner, (3) verifies ownership of any related Memory/Event/Chapter,
  (4) dedup-loads an existing Companion Memory (idempotent → `alreadyExisted`),
  (5) inserts. It NEVER mutates the source interaction/turn (no confirm/dismiss).
- **Management server fns**: `src/lib/llm/companionMemory.server.ts` —
  `listCompanionMemoriesFn`/`archiveCompanionMemoryFn`/`restoreCompanionMemoryFn`/
  `deleteCompanionMemoryFn`/`updateCompanionMemoryFn`/`loadCompanionMemoryProvenanceFn`.
- **Route integration**: `src/routes/companion.$conversationId.tsx` —
  "Remember this" composes confirm → promote; on success shows a "Remembered"
  confirmation and clears the candidate advisory. On promotion failure the
  advisory stays (NOT silently complete) so the user can retry from the
  management UI without creating a duplicate.
- **Management UI**: `src/components/identity/CompanionMemoriesPanel.tsx` wired
  into `src/routes/profile.tsx`. Lists memories (active by default; toggle
  archived), per-row Archive/Restore/Delete + user-only Edit, and a "Why?"
  affordance that opens inline provenance (source conversation + original user
  turn). Distinguishes Companion Memory from AI interpretation and conversation
  history.
- **Tests**: `src/lib/supabase/companion-memory.test.ts` (58 scenarios, no live
  LLM/network). Full suite 479/479 (16 files). Prior significance guard
  `significance.test.ts` updated to scope `companion_memories` creation to
  migration 0009 only.

### Verification gates
- tsc: 0. lint (touched files): 0. vite build: 0.
- Client bundle scan: no provider keys, no `process.env`, no `service_role`,
  no `auth.admin`, no `runRole`/`orchestra`, no promote/manage server-fn code,
  `getCurrentUser` not defined client-side.
- Scope: `src/lib/ai/`, `orchestra/`, `package.json`/lock, migrations
  0001-0008, existing remote layers, and existing server fns all untouched
  this phase.
- `stripComments` (test util) strips JS `//`, JS `/* */`, AND SQL `--`. Migration
  `comment on column` strings must NOT list forbidden category names verbatim
  (the CHECK constraint is the real enforcement; listing them in a comment
  string makes the "excludes forbidden categories" test fail).

## Companion Retrieval Foundation (phase complete)

The first **deterministic** Companion Retrieval layer. No embeddings, no
vector search, no pgvector, no semantic similarity, no graph DB, no full-text
engine, no external retrieval service. PostgreSQL/Supabase queries only.

### Flow
USER MESSAGE → INTENT/CONTEXT SIGNALS → DETERMINISTIC RETRIEVAL →
CONTEXT BUDGET/RANKING → ORCHESTRATOR → RESPONSE. The LLM receives a bounded,
trust-labelled context set, never the whole database.

### Files
- **Pure planner**: `src/lib/memory/companionRetrieval.ts` — `planRetrieval`,
  `identifyIntents`, `extractYears`, `timeOverlapsYear`, `normalizeText`,
  `detectCompanionMemoryOverride`, `CONTEXT_BUDGET`, `RELEVANCE`,
  `CompanionContextItem`, `TrustLevel`, `RetrievalIntents`. PURE: no fetch, no
  Orchestra, no Supabase. Operates on already-loaded abstract records. Returns
  bounded, trust-labelled, deduplicated `CompanionContextItem[]`.
- **Bounded loaders**: `src/lib/supabase/companion-retrieval-remote.ts` —
  `loadRecentTurnsForRetrieval`, `loadCompanionMemoriesForRetrieval`,
  `loadMemoriesForRetrieval` (with optional year filter),
  `loadReflectionsForRetrieval`, `loadPatternsForRetrieval`,
  `loadEventsForRetrieval`, `loadChaptersForRetrieval`. Each applies a hard
  DB-level `.limit()` so the user's entire corpus is never fetched (scales to
  10/100/1k/10k memories). Owner-scoped; RLS is final enforcement.
- **Server retrieval fn**: `src/lib/llm/retrieveCompanionContext.server.ts` —
  `retrieveCompanionContextLogic` (injectable `getCurrentUserImpl` for tests) +
  `retrieveCompanionContext` (createServerFn). Derives userId from the verified
  access token (no browser userId as authority), verifies conversation
  ownership, loads bounded candidates, runs the pure planner. Never calls the
  provider. On any failure returns `{ items: [], ok: false }` — no fabricated
  context.
- **Prompt integration**: `src/lib/llm/companionConversation.ts` —
  `buildCompanionPrompt` now accepts `retrievedContext: CompanionContextItem[]`
  and emits explicit GROUNDING RULES (user facts authoritative; Companion
  Memories are continuity instructions that must NOT override the current
  explicit message for this turn; pattern interpretation is not a fact; AI
  interpretations never facts; conversation context temporary; do not invent
  biography; do not pretend to remember; on conflict prefer user facts +
  acknowledge uncertainty). Each item is rendered with its trust label +
  relevance + reason.
- **Flow integration**: `src/lib/llm/companionConversation.server.ts` —
  `companionConversationLogic` calls `retrieveCompanionContextLogic` between
  loading recent turns and building the prompt. Retrieval is deterministic
  (no extra LLM call). On retrieval failure it falls back to recent turns only.

### Trust layers (canonical, NOT equally authoritative)
USER_FACT (memory, user reflection, event, chapter) > COMPANION_MEMORY >
CONVERSATION_CONTEXT > DERIVED_PATTERN (pattern evidence) > AI_INTERPRETATION
(companion reflection, pattern interpretation). At equal relevance, higher
trust sorts first. AI interpretation never overrides a user fact. Conflicts
are preserved with explicit provenance (both items returned, labelled).

### Retrieval principle
Explicit references only — no semantic guessing. Detects 4-digit years, exact
normalized song title/artist (against loaded Music Experiences), exact
location tokens, and keywords ("memory"/"you remembered"/"the pattern"/"that
event"/"that chapter"). Does NOT infer "university" from an unrelated memory.
Unknown time (null event_time) is never falsely matched to a year.

### Context budget (v1 conservative, tunable constants)
recent conversation turns 8 · companion memories 12 · memories 8 ·
reflections 6 · patterns 5 · events 5 · chapters 3. Total stays bounded
regardless of corpus size.

### Current-message-wins
A direct current user message overrides a stale Companion Memory
directive/preference FOR THIS TURN. The Companion Memory is NOT updated or
deleted — it remains in context (labelled) so the LLM knows the standing
preference exists. `detectCompanionMemoryOverride` surfaces this.

### Tests
`src/lib/supabase/companion-retrieval.test.ts` — 41 scenarios (the spec's 35
+ utility coverage). No live LLM, no network. Fake Supabase covers all
retrieval source tables; `runRole`/`fetch` spies confirm no provider/network
calls. Full suite 520/520 (17 files).

### Verification gates (this phase)
- tsc: 0. lint (touched files): 0. vite build: 0.
- Client bundle scan: no provider keys, no `process.env`, no `service_role`,
  no `auth.admin`, no `runRole`/`orchestra`, no retrieval server-fn code in
  the browser bundle. Retrieval server fn is `createServerFn` (server-only).
- Scope: `src/lib/ai/`, `orchestra/`, `orchestra.ts`, `package.json`/lock,
  migrations 0001-0009, Memory/Pattern/Event/Chapter/Media remote layers, and
  existing server fns all untouched this phase. No new indexes/migrations
  required (bounded SELECTs + existing indexes suffice for v1).
- Orchestra role used: `orchestrator` (unchanged from prior phase). No role
  mapping modified. No extra LLM call added for ordinary conversation
  (retrieval is deterministic and free of provider cost).

### Deferred (explicitly NOT in v1)
vector/embedding search, pgvector, semantic similarity, full-text search
engine, graph DB, external retrieval service, multi-agent retrieval, new AI
provider, Python Orchestra changes, retrieval debug UI for users, media
binary in prompts (metadata only, later; never signed URLs for the LLM).

## Companion Contextual Orchestration v1 (phase complete)

A deterministic orchestration layer sits on top of the Retrieval Foundation.
It decides WHICH existing capability handles a turn and WHICH domains to load,
so an ordinary chat no longer fetches the user's memories/patterns/etc. and a
chapter request never loads Media binaries.

### Key files
- `src/lib/llm/companionOrchestrator.ts` — PURE policy module. `orchestrate(msg)`
  → `{ intent, capability, retrievalPlan, budgets, priority, reason,
  currentUserInstruction }`. No LLM, no network, no Supabase, no Orchestra
  import. Re-exports `RetrievalPlan`/`IntentBudget`/`applyRetrievalBudgets`
  (canonical defs live in `companionRetrieval.ts`).
- `src/lib/llm/companionCapabilities.ts` — capability dispatch. `planCapability(
  intent, ctx)` → one `{ role, prompt, temperature, maxTokens }` plan. Exactly
  ONE runRole call per turn. Imports `OrchestraRole` as a TYPE only (erased at
  runtime); never calls the provider. Reuses existing PURE prompt builders
  (`buildCompanionPrompt`, `buildReflectionPrompt`) + a thin story-from-context
  adapter. Does NOT modify `src/lib/ai/*`.
- `src/lib/llm/retrieveCompanionContext.server.ts` — ADDITIVE
  `retrieveCompanionContextForIntentLogic` loads ONLY the policy's requested
  domains (bounded, owner-scoped), runs the pure planner, applies per-intent
  budgets. Existing whole-domain `retrieveCompanionContextLogic` unchanged.
- `src/lib/llm/companionConversation.server.ts` — integrated: orchestrate →
  intent-scoped retrieval → capability dispatch → single runRole call.

### Intent → capability mapping
- chat/unknown → `orchestrator` (grounded Companion prompt, conversation only)
- memory_recall/companion_memory_recall/pattern_exploration/
  event_chapter_recall/memory_creation → `orchestrator` (grounded, bounded
  retrieved context)
- reflection → `summarizer` (reuses reflection prompt) when a single memory is
  identified; else grounded chat fallback
- story_request → `summarizer` (story-from-context adapter, bounded context only)

### Budgets
`GLOBAL_DEFAULT_BUDGETS` (≤ CONTEXT_BUDGET). `resolveBudgets(intent, plan)`
zeros domains not in the plan. `applyRetrievalBudgets(items, budgets)` trims
per-domain post-retrieval. Intents can reduce but never exceed global caps.

### Tests
`src/lib/llm/companion-orchestrator.test.ts` — 48 scenarios (intent routing,
override+priority, retrieval routing+budget, cost control, purity+fallback,
identity+ownership, secret boundary, existing flows preserved,
anon/auth/sign-out, scope, capability dispatch prompt content, budget edge
cases). No live LLM, no network. Fake Supabase covers all tables incl.
`pattern_memories` + `.neq`. `runRole`/`fetch` spies confirm no provider calls.
Full suite 568/568 (18 files).

### Verification gates (this phase)
- tsc: 0. lint (touched files): 0. vite build: 0.
- Client bundle scan: no provider keys, no `service_role`, no `auth.admin`,
  no `runRole` runtime call in client-reachable code. Orchestration policy
  module is strictly pure; capability module is type-only re: Orchestra.
- Scope: `src/lib/ai/*`, `orchestra.ts` role set, `package.json`/lock,
  migrations 0001-0009, and existing remote layers all untouched this phase.
  No new tables/indexes/migrations.
- Orchestra roles used: `orchestrator` + `summarizer` (both pre-existing; no
  role mapping modified). No new provider. No extra LLM call for ordinary chat
  (intent classification is deterministic; retrieval is deterministic).
- `RetrievalPlan`/`IntentBudget`/`applyRetrievalBudgets` relocated to
  `companionRetrieval.ts` (retrieval concerns) and re-exported by the
  orchestrator, so the retrieval server module imports no "orchestra" symbol.

### Deferred (explicitly NOT in v1)
multi-role capability fan-out (each capability is one call), live LLM intent
classification, automatic Companion Memory creation (still user-confirmed),
story regeneration of deterministic Life Story template, media binaries in
prompts, new AI provider, Python Orchestra changes.

## Companion Experience v1 + Golden Conversation Test Suite

Phase adds the Companion *voice* contract (response style + memory language +
current-message-wins) and a Golden Conversation Test Suite that pins the
end-to-end behavioral contract. Reuses the existing orchestration/retrieval/
capability architecture; no new tables, providers, roles, or vector search.

### Response style policy + memory language
`buildCompanionPrompt` (`src/lib/llm/companionConversation.ts`) now emits four
explicit prompt sections: GROUNDING RULES (unchanged), RESPONSE STYLE (calm,
concise, answer-first, no DB dump, no "I remember" filler, no therapeutic
language, uncertainty for non-facts), MEMORY LANGUAGE (provenance-preserving
phrasing per trust layer — USER FACT / COMPANION MEMORY / DERIVED PATTERN /
AI INTERPRETATION), and CURRENT MESSAGE WINS (current instruction wins for
this turn only; stored preference unchanged). The story adapter
(`companionCapabilities.ts`) gains a matching provenance rule. Pure modules;
no I/O.

### Companion opening
`src/lib/llm/companionOpening.ts` — pure, deterministic (FNV-1a seed from the
conversation id → stable across reloads), calm, non-presumptuous. Curated
domain-framed openers; grounded hints (`hasMemories`/`hasChapters`/
`hasPatterns`) select a more contextual opener when available, but the opener
never injects biography or pretends to know something not supplied. Shown in
the empty-conversation state in `/companion/$conversationId`.

### Lightweight content-free observability
`companionConversation.server.ts` now produces a `CompanionTelemetry` on the
internal `LogicResult` (intent, capability, retrievalDomains, retrievalCount,
trustLevels, providerCalls, significanceGate). It is content-free (no
conversation text, no PII) and is NOT serialized by `toResponse` — it never
reaches the browser. It exists for the Golden suite's structural assertions
and future dev instrumentation.

### Route polish
`/companion/$conversationId` — empty conversation shows the calm opener;
archived conversation shows a read-only banner + disabled input (no Archive
button, no send). `/companion` list unchanged (already decent). UI-only.

### Golden Conversation Test Suite
`src/lib/llm/companion-golden.test.ts` — 35 numbered scenarios (A–L) + 4
cross-cutting invariants = 39 tests. Deterministic: mocks `runRole` +
`getCurrentUser`, runs the REAL `orchestrate` / intent-scoped retrieval /
capability dispatch / prompt builders / `companionConversationLogic`.
Fake Supabase (stateful, owner-scoped, all tables incl.
`significant_interactions`). Scenarios: ordinary chat (1-3), companion memory
recall (4-6), music memory recall (7-10), event/chapter (11-13), pattern
(14-16), story (17-19), reflection (20-21), significant interaction (22-24),
current-message override (25), trust hierarchy (26-27), privacy/ownership
(28-30), failure/resilience (31-35). Invariants: cost (1 call/chat), opening
determinism, closed intent union, retrieval budget caps. Asserts the
behavioral contract (intent → retrieval sources/counts ≤ budget → trust
levels → AI-interpretation labelling → no auto-memory → provider calls →
persistence integrity → cross-user isolation), NOT exact prose.

### Classifier improvements (intent routing)
`companionOrchestrator.classifyIntent` broadened conservatively to recognize:
- companion-memory recall: "what did I ask you", "what did I tell you",
  "what do you remember about my …"
- story: "into a story" (e.g. "turn my university years into a story")
- reflection: "help me understand …"
- memory_creation: an explicit current speaking-style instruction
  ("talk/speak/… casually/formally/…") so a standing preference can be
  honoured/overridden for this turn
All additive; existing 568 tests still pass.

### Verification gates (this phase)
- tsc: 0. eslint (touched files): 0. vite build: 0.
- Full suite 607/607 (19 files): 568 prior + 39 golden.
- Client bundle (`.output/public`) scan: no provider keys, no `service_role`,
  no `companionConversationLogic`/`telemetry` (server-only) leaked.
- Scope: `src/lib/ai/*`, `orchestra.ts` role set, `package.json`/lock,
  migrations, Python `orchestra/` all untouched. No new tables/migrations,
  no new provider/role, no vector/embeddings/pgvector, no service-role in
  browser. One Orchestra call per turn (classification is deterministic).

## Closed Beta Readiness + Product Validation v1

Phase goal: prepare the app for closed beta — onboarding clarity, first-value
path, privacy-safe instrumentation, AI usage observability, cost governor
interface, reliability UX, structured feedback. No history rewrite; built on
top of checkpoint `ad2493f`.

### New core libs (all pure/deterministic, no new deps)
- `src/lib/telemetry.ts` — privacy-safe instrumentation abstraction
  (injectable `TelemetrySink`, default no-op). Forbidden-key redaction strips
  raw content/credentials/tokens. Provider-neutral `AiUsageEvent` contract +
  `inferProviderFromModel` + `trackAiUsage`. Closed `PRODUCT_EVENTS` set.
- `src/lib/aiUsage.ts` — cost governor interface. `canUseAi` ALWAYS allows in
  v1 (beta-unmetered); `recordAiUsage` forwards content-free events. Structured
  for future budgets/fallback without touching call sites. No billing API.
- `src/lib/reliability.ts` — canonical user-safe failure messages. Never raw
  500/stack traces/credential strings. Persistence failure ≠ success.
- `src/lib/onboarding.ts` — onboarding completion contract (pure), first-value
  CTA, session-safe flags (seen/first-memory), anonymous-compatible.
- `src/lib/feedback.ts` — structured feedback (closed-set ratings only,
  no raw content). Recorded via telemetry sink; no new table.

### Route changes (minimal, additive)
- `results.tsx` — "This was your first listen" first-value CTA section
  (→ /memory, → /companion) + onboarding_completed telemetry + markOnboardingSeen.
- `memory.tsx` — SavedPhase now links to saved Memory Detail (/memory/$memoryId),
  shows "Did this feel meaningful?" feedback prompt, memory_created telemetry,
  first-memory flag, reliability messages for save/extraction failures.
- `companion.$conversationId.tsx` — companion_turn telemetry (ok/failed),
  companion_memory_confirmed telemetry, "Was this helpful?" feedback prompt,
  reliability message for provider failure.
- `index.tsx` — subtle "Beta" pill + app_opened telemetry.
- `journey.tsx` — onboarding_started telemetry.

### Telemetry hook in orchestration (behavior unchanged)
`companionConversation.server.ts` adds a content-free `aiUsage` field to
`CompanionTelemetry` (capability, provider inferred from model, model, success,
fallback, latency bucket) by timing the existing `runRoleImpl` call. Success/
failure paths identical; `orchestra.ts` untouched (uses existing `listRoles()`
export). Token counts omitted in v1 (bridge doesn't expose usage; contract has
optional fields for future). Golden suite (39) still green.

### Docs
- `docs/BETA/README.md` — beta readiness state, constraints, beta account
  reset (dashboard-side, no in-app reset button), persistence note (no new
  table for feedback).
- `docs/BETA/MANUAL_TEST_SCRIPT.md` — human QA script (onboarding, first
  memory, companion, reliability failure paths, privacy sanity, anonymous-first).

### Constraints respected
No new domain tables, no vector/embeddings/pgvector, no new LLM provider, no
service-role in companion code, `src/lib/ai/*` and `orchestra.ts` untouched,
no new third-party analytics dep, no billing/quotas, no in-app reset button.

### Verification gates (this phase)
- tsc: 0. eslint: 0 errors (6 pre-existing shadcn warnings). vite build: 0.
- Full suite 641/641 (20 files): 607 prior + 34 new beta-readiness tests.
- Secret scan: no `VITE_`-prefixed provider keys, no service-role in
  companion code, no secrets/tokens in telemetry (only the forbidden-key
  redaction list mentions them by name).
- Golden/companion/memory suites: 199/199.


