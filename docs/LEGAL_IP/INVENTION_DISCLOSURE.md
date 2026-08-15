# Invention Disclosure — Life in a Sound

This is a **factual technical invention disclosure**, prepared for review by a
patent professional before closed beta. **This is not legal advice.** It
describes candidate technical aspects of the project that a patent
professional may review. It does **not** assert that any aspect is patentable,
novel, or non-obvious. It contains **no legal claims** and makes no speculative
public disclosure of protection.

For every candidate below, the language used is:

> **Potentially relevant to patentability review.**

No item is described as "patentable." The determination of patentability,
novelty, non-obviousness, subject-matter eligibility, and freedom-to-oper is
expressly deferred to a qualified patent professional.

Companion documents:
- `IP_INVENTORY.md` — element-level IP inventory + ownership character.
- `DATA_FLOW_AND_PRIVACY_MAP.md` — data flow for privacy review.
- `GLOBAL_MARKET_LEGAL_CHECKLIST.md` — per-market legal questions.

---

## 1. Candidate technical aspects

Each aspect is described factually, with the repository source and a note on
why it *may* be worth professional review. "Potentially relevant to
patentability review" is not a claim of patentability.

### 1.1 Deterministic significance gating before LLM classification

A cheap, pure, deterministic substring gate (`src/lib/memory/significanceGate.ts`)
runs **before** any LLM significance classifier is invoked. It scans only USER
turns for explicit durable-statement signal phrases and returns
`shouldAnalyze`. It makes no network calls, persists nothing, and cannot create
a memory. Only turns that pass this gate reach the Orchestra classifier; a
greeting, "thanks", or short factual one-off never triggers an LLM call.

**Potentially relevant to patentability review** — specifically the use of a
deterministic pre-filter that gates an LLM classification call for durable
user-statement detection in a conversational memory system.

### 1.2 Explicit user confirmation before durable Companion Memory

A classifier (`src/lib/llm/significantInteraction.ts`,
`classifySignificantInteraction.server.ts`) returns a **CANDIDATE** only — it
never confirms. The candidate is persisted with `status='candidate'`. The user
must explicitly confirm or dismiss (`confirmSignificantInteraction.server.ts`).
Only a confirmed candidate may be promoted
(`promoteSignificantInteraction.server.ts`) into a Companion Memory. No
unconfirmed interaction becomes durable Companion Memory. The `kind` CHECK
constraint excludes `ai_fact`/`psychological_profile`/`diagnosis`/
`personality_trait`/`inferred_*`; the `source` CHECK is locked to
`user_confirmed` (migration `0009`).

**Potentially relevant to patentability review** — specifically the two-stage
candidate-then-explicit-user-confirmation flow for promoting a conversational
statement into a durable, AI-grounded memory, with DB-level exclusion of
inferred/AI categories.

### 1.3 Provenance-preserving trust hierarchy

A four-layer trust model — SOURCE/USER FACT > DERIVED/COMPUTED > AI
INTERPRETATION > TRANSIENT — is enforced one-directionally
(`docs/ARCHITECTURE/...` §17–18; `src/lib/memory/companionRetrieval.ts`).
Retrieved context items carry an explicit `TrustLevel` label so the LLM sees
provenance and may not silently choose between conflicting sources. Nothing at
a lower-trust layer may silently become a higher-truth source.

**Potentially relevant to patentability review** — specifically the trust-tier
labelling of retrieved context items supplied to an LLM, preserving provenance
and preventing silent trust promotion.

### 1.4 Bounded multi-domain retrieval

The retrieval planner (`src/lib/memory/companionRetrieval.ts`) loads a bounded
set of candidate records across multiple domains (memories, reflections,
patterns, events, chapters, companion memories, conversation turns), applies
per-domain hard budget caps, deduplicates, and returns a small serializable
context set. Media binaries are never loaded for any intent. No
embeddings/vector search are used — exact + normalized token matching only.

**Potentially relevant to patentability review** — specifically the bounded,
per-domain-budget, trust-labelled multi-domain retrieval for grounding a
conversational LLM without semantic/vector search.

### 1.5 Intent-scoped contextual retrieval

An intent → retrieval-plan mapping (`src/lib/llm/companionOrchestrator.ts`)
determines which domains are loaded for a given conversational intent;
unlisted domains are NOT loaded (ordinary chat never fetches
memories/patterns). Per-intent budgets reduce but never exceed a global cap. A
current direct user message overrides a stale Companion Memory preference for
that turn only, without deleting the standing memory.

**Potentially relevant to patentability review** — specifically intent-driven
scoping of which user-data domains are loaded to ground an LLM turn, with a
current-message-wins-over-stored-preference rule that preserves the stored
preference.

### 1.6 Deterministic capability routing (one-call execution)

Each conversational intent maps to exactly one Orchestra role call
(`src/lib/llm/companionCapabilities.ts`): a single `CapabilityPlan` (role +
prompt + temperature + maxTokens). No capability calls multiple roles. A
deterministic fallback exists where applicable; when the LLM returns null for
chat, no assistant turn is fabricated.

**Potentially relevant to patentability review** — specifically the
one-role-per-intent deterministic dispatch with no-fabrication fallback.

### 1.7 Identity continuity (anonymous-first, server-authoritative)

Identity is anonymous-first (Supabase anonymous auth, one id per browser,
RLS-owner-scoped). The server derives the authoritative userId from the
verified access token via `getCurrentUser(accessToken)`
(`src/lib/supabase/server-auth.ts`), never from a browser-supplied userId.
Anonymous → permanent migration is designed to rebind all domain objects
without data loss (architecture §20; not yet implemented).

**Potentially relevant to patentability review** — specifically the
server-authoritative identity derivation from a bearer token combined with
anonymous-first, owner-scoped RLS, and a designed lossless rebind to a durable
identity.

### 1.8 Grounded generation separating user facts from derived interpretation

The LLM is constrained by grounding rules (`src/lib/llm/prompts.ts`,
`STORY_GROUNDING_RULES`, `GROUNDING_RULES`) to use only supplied facts and to
never invent people, places, dates, weather, events, songs, artists,
memories, or relationships. Interpretations are framed as interpretations, with
uncertainty language; user facts are presented as facts. Raw memories are
stored verbatim and AI output is stored separately, never overwriting the
original. Regeneration flows downhill only (FACT→INTERPRETATION→PATTERN→STORY).

**Potentially relevant to patentability review** — specifically the structural
separation of user-supplied fact from AI-derived interpretation in storage and
in prompt grounding, with one-directional regeneration.

---

## 2. Trade-secret inventory

The following implementation details are recorded as **potentially suitable
for confidential treatment** as trade secrets. They are factual design
choices; whether they qualify as trade secrets is a legal question. **No API
keys, tokens, passwords, or secrets are included here** — only non-credential
implementation detail.

| Item | Source | Factual description |
|------|--------|---------------------|
| Retrieval scoring / heuristics | `src/lib/memory/companionRetrieval.ts` | Deterministic relevance heuristic (0..1) and ranking rules for candidate context items. |
| Context budgets | `src/lib/memory/companionRetrieval.ts` | Per-domain hard caps and per-intent budget reductions. |
| Intent signals | `src/lib/llm/companionOrchestrator.ts` | How a user message is mapped to an intent / retrieval plan (explicit references only). |
| Significance gate signal patterns | `src/lib/memory/significanceGate.ts` | The curated `SIGNAL_PATTERNS` list and normalization/matching rules. |
| Routing rules (role → provider/model) | `src/lib/llm/orchestra.ts` | The `ROLE_PROVIDER` / role-to-provider mapping mirrored from the Python spec. |
| Prompt structures | `src/lib/llm/prompts.ts`, `significantInteraction.ts`, `companionCapabilities.ts`, `companionConversation.ts` | Grounding rules, system prompts, structured-output contracts. |
| Significance thresholds | `significantInteraction.ts` | Confidence handling, uncertainty handling, candidate/non-candidate decision rules. |
| Cost-control policy | `src/lib/aiUsage.ts` | The cost-governor interface and (future) budget/fallback structure. |
| Provider routing config | `src/lib/llm/orchestra.ts` | Endpoint/model/keyEnv mapping per role; provider fallback behaviour. |
| Companion Memory provenance implementation | `src/lib/llm/companionMemory.server.ts`, `companion-memory-remote.ts` | The provenance-chain reconstruction logic and promotion invariants. |

**Excluded by policy:** API keys (`GROQ_API_KEY`, `GEMINI_API_KEY`,
`MISTRAL_API_KEY`, `OPENROUTER_API_KEY`), access tokens, passwords, service
roles, and any secret value. These are never written in documentation.

---

## 3. Trademark inventory

The following names are found in the repository. For each, the status is:

> **Trademark candidate — availability search required.**

No availability is claimed. No registration is asserted. A professional
clearance search (including EU, UK, US, TR, and WIPO registers) is required
before any commercial use as a mark.

| Name | Where found | Notes |
|------|-------------|-------|
| Life in a Sound | `docs/PRODUCT/PRODUCT_VISION.md`, `docs/AI_HANDOFF.md`, throughout | Primary product name. Trademark candidate — availability search required. |
| SoundMap | `docs/AI_HANDOFF.md` (internal code name), Results/UI copy | Internal code/sprint name; appears in user-facing copy ("SoundMap poster"). Trademark candidate — availability search required. |
| Your Life. One Soundtrack. | `docs/AI_HANDOFF.md` (tagline) | Tagline. Trademark candidate — availability search required. |
| Companion / Music Companion | `docs/ARCHITECTURE/...`, `docs/PRODUCT/...` | Feature/concept name. Whether protectable as a mark is a legal question. |
| Music DNA | `docs/ARCHITECTURE/...`, `docs/AI/...`, Results UI | Feature name. Trademark candidate — availability search required. |
| First Listen | `docs/PRODUCT/PRODUCT_VISION.md`, `docs/BETA/README.md` | Onboarding concept name. Trademark candidate — availability search required. |

---

## 4. Public-disclosure risk

Patent strategy should be reviewed **before broad public disclosure** of any
potentially novel technical mechanism listed in §1. Closed beta with a small
invited group may itself have disclosure implications depending on
jurisdiction and any confidentiality agreements in place with beta testers.

- This document does **not** state specific legal deadlines (e.g. grace-period
  cut-offs). Any such determination depends on jurisdiction and filing
  strategy and must come from a qualified professional.
- **Recommend consultation with an international patent professional** before
  public launch, open-sourcing of the novel mechanisms, or any public
  technical write-up that describes the candidate aspects in §1.
- If trade-secret treatment (§2) is desired for any item, that decision should
  be made **before** public disclosure, since disclosure may forfeit trade-secret
  status.

---

## 5. What this disclosure is NOT

- Not a legal claim of patentability, novelty, or non-obviousness.
- Not a patent application. No claims are drafted.
- Not a freedom-to-oper analysis.
- Not a warranty that the listed aspects are original; prior art has not been
  searched here.
- Not a public disclosure of protection. It is an internal document prepared
  for professional review.

_End of Invention Disclosure._
