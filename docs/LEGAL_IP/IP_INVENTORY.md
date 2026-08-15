# IP Inventory — Life in a Sound

This is a factual inventory of intellectual-property-relevant elements of the
Life in a Sound project as observed in the repository at checkpoint `fab4f6d`.
It is prepared for professional legal review before closed beta. **This is not
legal advice.** No element is claimed to be legally protected, patentable, or
trademark-available. Each category below distinguishes the source/ownership
character of the element.

Companion documents:
- `INVENTION_DISCLOSURE.md` — candidate technical aspects for patent review.
- `DATA_FLOW_AND_PRIVACY_MAP.md` — personal-data flow and privacy questions.
- `GLOBAL_MARKET_LEGAL_CHECKLIST.md` — per-market review questions.

---

## 1. Category definitions

Every item in this inventory is tagged with one of four categories:

| Category | Meaning |
|----------|---------|
| **ORIGINAL PROJECT ELEMENT** | Designed and authored for this project; not sourced from a third-party product. Ownership/protectability is a legal question — not asserted here. |
| **THIRD-PARTY TECHNOLOGY** | A commercial service or platform operated by a third party (Cloudflare, Supabase, AI providers). The project uses it under the provider's terms; the project does not own it. |
| **OPEN-SOURCE DEPENDENCY** | A library/package consumed under its own open-source licence (see `package.json`). |
| **AI PROVIDER TECHNOLOGY** | A third-party AI model/API the project calls at runtime via the Orchestra bridge. The model, weights, and API are the provider's property. |

---

## 2. Product concept

| Element | Category | Factual description |
|---------|----------|---------------------|
| Life in a Sound — product concept | ORIGINAL PROJECT ELEMENT | A personal music-memory companion that turns songs tied to lived moments into a longitudinal, AI-narrated timeline. The 8-question "First Listen" journey is onboarding; the long-term product is lifelong memory capture + companionship. (Source: `docs/PRODUCT/PRODUCT_VISION.md`.) |
| SoundMap (internal code name) | ORIGINAL PROJECT ELEMENT | Internal code/sprint name used in the repository and docs. Not asserted as a public trademark. |
| Tagline "Your Life. One Soundtrack." | ORIGINAL PROJECT ELEMENT | Recorded in `docs/AI_HANDOFF.md`. Trademark candidate — availability search required (see Trademark Inventory). |

---

## 3. Original software implementation

| Element | Category | Source evidence |
|---------|----------|-----------------|
| Application source code (`src/**`) | ORIGINAL PROJECT ELEMENT | Authored in-repo; see Ownership section for contributor record. |
| Supabase SQL migrations (`supabase/migrations/*.sql`) | ORIGINAL PROJECT ELEMENT | 9 migrations authored in-repo, defining the domain schema + RLS policies. |
| Project documentation (`docs/**`) | ORIGINAL PROJECT ELEMENT | Authored in-repo. |

No licence file is present in the repository (verified: no `LICENSE`,
`LICENSE.md`, or `COPYING`). No `CONTRIBUTING.md` or CLA is present. Default
copyright/ownership treatment of the code is therefore a **legal question** —
see Ownership Review in `GLOBAL_MARKET_LEGAL_CHECKLIST.md`.

---

## 4. Architecture (original design)

| Element | Category | Factual description |
|---------|----------|---------------------|
| Canonical architecture (domain tree + provenance layers) | ORIGINAL PROJECT ELEMENT | `docs/ARCHITECTURE/LIFE_IN_A_SOUND_ARCHITECTURE.md` defines a domain model: Identity, Profile, Companion Profile, Music DNA, Media, Life Chapters → Life Events → Music Memories → Experiences/Reflections/Connections, Patterns, Stories; with the Companion as an orchestration layer above the tree. |
| Trust/provenance hierarchy (4 layers) | ORIGINAL PROJECT ELEMENT | SOURCE/USER FACT → DERIVED/COMPUTED → AI INTERPRETATION → TRANSIENT. One-directional: lower-trust layers may not silently become higher-truth source. |
| Deterministic-then-generative AI split | ORIGINAL PROJECT ELEMENT | Deterministic pipeline (`src/lib/ai/pipeline.ts`) is the factual source of truth; the LLM (Orchestra) is interpretation only, with deterministic fallback when unavailable. |
| Cloudflare Workers deployment model | ORIGINAL PROJECT ELEMENT (config) + THIRD-PARTY TECHNOLOGY (platform) | `wrangler.jsonc` + Nitro build target Cloudflare Workers; the platform itself is Cloudflare's. |

---

## 5. Companion model

| Element | Category | Factual description |
|---------|----------|---------------------|
| Companion as orchestration/experience layer | ORIGINAL PROJECT ELEMENT | The Companion is not a database entity; it composes across domains to retrieve, ground, narrate. (`docs/ARCHITECTURE/...` §16; `src/lib/llm/companionOrchestrator.ts`.) |
| Companion capability dispatch | ORIGINAL PROJECT ELEMENT | `src/lib/llm/companionCapabilities.ts` maps each intent to exactly one Orchestra role call (one-call execution plan). |
| Companion Conversation server | ORIGINAL PROJECT ELEMENT | `src/lib/llm/companionConversation.server.ts` — server-authoritative identity (token-verified), owner-scoped, RLS-enforced. |

---

## 6. Music Memory model

| Element | Category | Factual description |
|---------|----------|---------------------|
| Music Memory conceptual model | ORIGINAL PROJECT ELEMENT | `docs/PRODUCT/MUSIC_MEMORY.md`: a song tied to a lived moment + optional context; raw fact, user-authored, inviolable; AI never authors/alters it. |
| Music Memory schema + RLS | ORIGINAL PROJECT ELEMENT | Migration `0002_music_memory.sql` (`music_experiences`, `memories`) + owner-scoped RLS policies. |

---

## 7. Trust hierarchy / provenance

| Element | Category | Factual description |
|---------|----------|---------------------|
| Four-layer provenance | ORIGINAL PROJECT ELEMENT | USER FACT > DERIVED > AI INTERPRETATION > TRANSIENT (`docs/ARCHITECTURE/...` §17). |
| Retrieval trust labelling | ORIGINAL PROJECT ELEMENT | `src/lib/memory/companionRetrieval.ts` tags every retrieved item with a `TrustLevel` so the LLM sees provenance and may not silently choose. |
| Companion Memory provenance chain | ORIGINAL PROJECT ELEMENT | Companion Memory → Significant Interaction → Conversation Turn → Conversation (`src/lib/llm/companionMemory.server.ts`, migration `0009`). |

---

## 8. Significant interaction gate

| Element | Category | Factual description |
|---------|----------|---------------------|
| Deterministic significance gate | ORIGINAL PROJECT ELEMENT | `src/lib/memory/significanceGate.ts` — cheap pure substring gate that runs before any LLM call; only USER turns may be candidates. |
| Significance classifier contract | ORIGINAL PROJECT ELEMENT | `src/lib/llm/significantInteraction.ts` — grounded prompt + structured output; classifier returns a CANDIDATE only, never confirmed by the AI. |
| Confirm + promote flow | ORIGINAL PROJECT ELEMENT | `confirmSignificantInteraction.server.ts` (user confirms/dismisses) → `promoteSignificantInteraction.server.ts` (explicit promotion to Companion Memory). No unconfirmed interaction becomes Companion Memory. |

---

## 9. Companion Memory provenance

| Element | Category | Factual description |
|---------|----------|---------------------|
| Companion Memory table | ORIGINAL PROJECT ELEMENT | Migration `0009_companion_memories.sql`; `kind` CHECK excludes `ai_fact`/`psychological_profile`/`diagnosis`/`personality_trait`/`inferred_*`; `source` CHECK locks to `user_confirmed` (no `ai_generated` without a migration). |
| Provenance affordance ("Why do you remember this?") | ORIGINAL PROJECT ELEMENT | `loadCompanionMemoryProvenanceFn` reconstructs the full chain for user transparency. |

---

## 10. Deterministic retrieval

| Element | Category | Factual description |
|---------|----------|---------------------|
| Pure retrieval planner | ORIGINAL PROJECT ELEMENT | `src/lib/memory/companionRetrieval.ts` — no embeddings/vector/pgvector; exact + normalized token matching; per-domain hard budget caps. |
| Bounded context contract | ORIGINAL PROJECT ELEMENT | `CompanionContextItem[]` — small, serializable, trust-labelled slices; the LLM never sees raw DB rows; media binaries never loaded for any intent. |

---

## 11. Contextual orchestration / intent-scoped retrieval

| Element | Category | Factual description |
|---------|----------|---------------------|
| Intent → retrieval plan | ORIGINAL PROJECT ELEMENT | `src/lib/llm/companionOrchestrator.ts` maps an intent to which domains are loaded; unlisted domains are NOT loaded (ordinary chat never fetches memories/patterns). |
| Intent budgets | ORIGINAL PROJECT ELEMENT | Per-intent caps applied as `min(intentBudget, CONTEXT_BUDGET)` per domain; intents can reduce but never exceed the global cap. |
| Current-message-wins rule | ORIGINAL PROJECT ELEMENT | A direct current user message overrides a stale Companion Memory preference for that turn only; the standing memory is not deleted. |

---

## 12. AI grounding

| Element | Category | Factual description |
|---------|----------|---------------------|
| Grounding rules (no invented biography) | ORIGINAL PROJECT ELEMENT | Enforced in prompts: the LLM must not invent people, places, dates, weather, events, songs, artists, memories, relationships (`src/lib/llm/prompts.ts`, `companionCapabilities.ts` `STORY_GROUNDING_RULES`, `significantInteraction.ts` `GROUNDING_RULES`). |
| Raw-fact vs interpretation separation | ORIGINAL PROJECT ELEMENT | AI output is stored separately from and never overwrites the user's original words. |

---

## 13. Identity continuity

| Element | Category | Factual description |
|---------|----------|---------------------|
| Anonymous-first auth | ORIGINAL PROJECT ELEMENT (design) + THIRD-PARTY TECHNOLOGY (Supabase Auth) | Supabase anonymous auth: one anonymous user id per browser; RLS owner-scoped. Durable cross-device identity is future work. |
| Server-authoritative identity | ORIGINAL PROJECT ELEMENT | `src/lib/supabase/server-auth.ts` — userId derived from verified access token, never from browser-supplied userId; no service-role key used. |
| Anonymous → permanent migration | ORIGINAL PROJECT ELEMENT (design, future) | Architecture §20: migration must rebind all domain objects without data loss. Not yet implemented. |

---

## 14. Story generation

| Element | Category | Factual description |
|---------|----------|---------------------|
| Life Story Engine | ORIGINAL PROJECT ELEMENT | `src/lib/llm/generateStory.server.ts` + `prompts.ts` — LLM-generated narrative with deterministic fallback. |
| Story provenance | ORIGINAL PROJECT ELEMENT | A Story references the Memories/Patterns/DNA it was built from; regeneration flows downhill only (FACT→INTERPRETATION→PATTERN→STORY). |

---

## 15. Patterns / Events / Chapters / Media

| Element | Category | Factual description |
|---------|----------|---------------------|
| Pattern model (evidence vs interpretation) | ORIGINAL PROJECT ELEMENT | Migration `0004_patterns.sql` + `src/lib/memory/patterns.ts`; evidence is DERIVED from user facts; interpretation is AI. |
| Life Events / Chapters | ORIGINAL PROJECT ELEMENT | Migrations `0005`; optional grouping layers, retroactively attachable. |
| Media model | ORIGINAL PROJECT ELEMENT + THIRD-PARTY TECHNOLOGY (Supabase Storage) | Migration `0006`; metadata in Postgres, binary in a **private** Supabase Storage bucket; signed URLs only; v1 MIME allowlist image/jpeg|png|webp. |

---

## 16. Telemetry / AI usage

| Element | Category | Factual description |
|---------|----------|---------------------|
| Internal telemetry abstraction | ORIGINAL PROJECT ELEMENT | `src/lib/telemetry.ts` — no third-party SDK; event names + low-risk categorical metadata only; forbidden-key redaction list as defence in depth. |
| AI usage observability | ORIGINAL PROJECT ELEMENT | `src/lib/aiUsage.ts` + telemetry hook in `companionConversation.server.ts`; records capability/provider/model/success/fallback/latency bucket; never the API key; token counts omitted in v1. |
| Cost governor (interface only) | ORIGINAL PROJECT ELEMENT | `canUseAi` always allows in v1 (unmetered beta); structured for future budgets. |

---

## 17. Third-party technologies (not owned by the project)

| Element | Category | Factual description |
|---------|----------|---------------------|
| Cloudflare Workers | THIRD-PARTY TECHNOLOGY | Hosting/runtime platform. The Worker runs on Cloudflare's infrastructure under Cloudflare's terms. |
| Supabase (Postgres + Auth + Storage) | THIRD-PARTY TECHNOLOGY | Data layer. Database, anonymous auth, and private storage bucket are Supabase services under Supabase's terms. |
| Groq | AI PROVIDER TECHNOLOGY | LLM provider; called via `https://api.groq.com/openai/v1/chat/completions`. Model `llama-3.3-70b-versatile`. |
| Google Gemini | AI PROVIDER TECHNOLOGY | LLM provider; called via `https://generativelanguage.googleapis.com/...`. Models `gemini-3-flash-preview`, `gemini-3.1-flash-lite`. |
| Mistral | AI PROVIDER TECHNOLOGY | LLM provider; called via `https://api.mistral.ai/v1/chat/completions`. Model `mistral-large-latest`. |
| OpenRouter | AI PROVIDER TECHNOLOGY | LLM provider; called via `https://openrouter.ai/api/v1/chat/completions`. Model `anthropic/claude-sonnet-4.6`. |
| Python `orchestra/` reference | ORIGINAL PROJECT ELEMENT (spec) | Canonical role/provider spec kept as reference; NOT executed at runtime (Cloudflare Workers cannot run Python). The TS bridge mirrors it. |

The project does **not** claim ownership of any third-party platform, model,
weights, or API. Use of each provider is governed by that provider's terms —
see the AI-provider data-processing review question in the Global Market
Checklist.

---

## 18. Open-source dependencies (selected, from `package.json`)

Full list in `package.json`. Notable categories:

| Dependency | Category | Notes |
|------------|----------|-------|
| React 19, ReactDOM | OPEN-SOURCE (MIT) | UI runtime. |
| TanStack Start / Router / Query | OPEN-SOURCE (MIT) | SSR + routing + data. |
| Vite 8, Nitro 3 (beta) | OPEN-SOURCE | Build + server runtime. |
| Tailwind CSS v4 | OPEN-SOURCE (MIT) | Styling. |
| Radix UI primitives | OPEN-SOURCE (MIT) | Accessible components. |
| `@supabase/supabase-js` | OPEN-SOURCE (MIT) | Supabase client SDK. |
| `@lovable.dev/vite-tanstack-config` | OPEN-SOURCE / third-party config | Lovable build config plugin. |
| wrangler 4 | OPEN-SOURCE | Cloudflare CLI (devDep). |
| Vitest, TypeScript, ESLint, Prettier | OPEN-SOURCE | Tooling. |

Each dependency carries its own licence. A full licence/compatibility audit of
all transitive dependencies is a legal-review question — not performed here.

---

## 19. Items explicitly NOT claimed

- No claim that any element is legally protected, patentable, or
  trademark-available.
- No claim of ownership over Cloudflare, Supabase, Groq, Google Gemini,
  Mistral, OpenRouter, or any model/weights/API.
- No claim that the Python `orchestra/` spec or LiteLLM patterns are the
  project's invention (LiteLLM is a third-party open-source project; the
  in-repo `orchestra/` mirrors its role/provider pattern).
- No claim that default copyright protects the code absent a licence file —
  that is a legal question.

_End of IP Inventory._
