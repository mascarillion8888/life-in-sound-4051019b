# Data Flow and Privacy Map — Life in a Sound

This is a factual map of how personal data flows through Life in a Sound as
observed in the repository at checkpoint `fab4f6d`. It is prepared for
professional privacy/legal review before closed beta. **This is not legal
advice.** It does **not** claim GDPR, KVKK, or any other compliance. Where the
legal character of a stage is uncertain, it is marked **"requires legal
review."**

Companion documents:
- `IP_INVENTORY.md`
- `INVENTION_DISCLOSURE.md`
- `GLOBAL_MARKET_LEGAL_CHECKLIST.md`

---

## 1. End-to-end data flow (factual)

```
USER
  ↓
BROWSER (client app; localStorage session; anonymous Supabase access token)
  ↓
SUPABASE AUTH (anonymous auth; verifies access token server-side via getUser)
  ↓
SUPABASE DATABASE (Postgres; owner-scoped RLS; domain tables)
  ↓
SUPABASE STORAGE (private bucket 'user_media'; signed URLs only)  [media only]
  ↓
SERVER RETRIEVAL (TanStack Start server fns; deterministic planner; bounded context)
  ↓
ORCHESTRA (TS bridge; server-only; provider routing)
  ↓
AI PROVIDER (Groq / Google Gemini / Mistral / OpenRouter)
  ↓
RESPONSE (to browser; raw facts never overwritten; AI output stored separately)
```

Sources: `src/lib/supabase/server-auth.ts` (auth), `retrieveCompanionContext.server.ts`
(retrieval), `src/lib/llm/orchestra.ts` (provider calls), migrations `0001`–`0009`
(schema + RLS), `0006_media.sql` (private storage bucket).

---

## 2. Per-stage data-flow record

For each stage: data category, purpose, client/server, ownership/control
assumption (requiring legal review), retention question, deletion question,
cross-border question, AI-provider transfer question.

### Stage A — User → Browser

| Field | Value |
|-------|-------|
| Data category | User-provided content (songs, memories, reflections, notes, life events, chapters, media uploads), account identity (anonymous token), profile fields. |
| Purpose | Capture the user's music-memory timeline and Companion conversation. |
| Client/server | Client (browser). Supabase session (access token) persisted in `localStorage`. |
| Ownership/control assumption | User-authored content belongs to the user. **Requires legal review**: terms of use must state the user grants the processing necessary to provide the service. |
| Retention question | `localStorage` caches journey data as offline fallback. **Requires legal review**: is client-side caching disclosed and bounded? |
| Deletion question | User can delete content via the app; browser-data wipe deletes the anonymous session. **Requires legal review**: what happens to unclaimed anonymous timelines? |
| Cross-border question | The browser is wherever the user is. **Requires legal review**: which jurisdictions' users are accepted in beta? |
| AI-provider transfer question | Not yet — no provider call at this stage. |

### Stage B — Browser → Supabase Auth

| Field | Value |
|-------|-------|
| Data category | Anonymous auth credential (access token JWT). |
| Purpose | Establish one anonymous user id per browser; owner-scoped RLS. |
| Client/server | Server (Supabase Auth). |
| Ownership/control assumption | Auth identity is held by Supabase Auth under Supabase's terms. **Requires legal review**: is Supabase a processor or controller? DPA needed? |
| Retention question | Anonymous users retained per Supabase project settings. **Requires legal review**: anonymous-auth retention policy + unclaimed-account cleanup. |
| Deletion question | Deleting the user in Auth cascades to owner rows (FK `on delete cascade`). **Requires legal review**: is this the deletion mechanism of record? |
| Cross-border question | Supabase region is chosen at project setup. **Requires legal review**: region vs. user location. |
| AI-provider transfer question | No — auth tokens are not sent to AI providers. |

### Stage C — Supabase Database (Postgres + RLS)

| Field | Value |
|-------|-------|
| Data category | All domain data: journeys, music experiences, memories, reflections, connections, patterns, life events/chapters, media metadata, companion conversations/turns, significant interactions, companion memories. |
| Purpose | Persistent source of truth for the user's timeline. |
| Client/server | Server (Postgres). Every table has RLS enabled; policies are owner-scoped (`auth.uid() = user_id`). No service-role key is used in companion/auth code (`src/lib/supabase/server-auth.ts`). |
| Ownership/control assumption | Data is stored in Supabase Postgres. **Requires legal review**: controller/processor roles; DPA with Supabase; data-residency. |
| Retention question | No automatic retention expiry is implemented. **Requires legal review**: retention periods per category; storage-limitation principle. |
| Deletion question | Owner-scoped delete available per domain; full delete via Auth user deletion cascades. **Requires legal review**: derived data (Patterns, AI interpretations) deletion cascade; soft vs hard delete. |
| Cross-border question | Postgres region (Supabase). **Requires legal review**: cross-border transfer implications. |
| AI-provider transfer question | No — raw rows are not sent to providers; only bounded, trust-labelled context slices are (Stage E). |

### Stage D — Supabase Storage (media only)

| Field | Value |
|-------|-------|
| Data category | User-uploaded images (image/jpeg, image/png, image/webp). |
| Purpose | Media attached to profile/memory/event/chapter. |
| Client/server | Server (Supabase Storage, **private** bucket `user_media`). Path is user-scoped: `<user_id>/<media_id>/<filename>`. Signed URLs only, generated after ownership check. |
| Ownership/control assumption | Media belongs to the user; stored in Supabase Storage under Supabase's terms. **Requires legal review**. |
| Retention question | Media retained until explicit deletion. **Requires legal review**: retention period; orphaned media. |
| Deletion question | Direct media deletion removes file + relationships; deleting a Memory/Event does NOT cascade-delete media (it may be referenced elsewhere). **Requires legal review**: is this sufficient for erasure requests? |
| Cross-border question | Storage region. **Requires legal review**. |
| AI-provider transfer question | **Media binaries are never sent to AI providers** for any intent (enforced in retrieval planner). Metadata only may appear in context. |

### Stage E — Server Retrieval → Orchestra

| Field | Value |
|-------|-------|
| Data category | Bounded, trust-labelled context slices (`CompanionContextItem[]`): conversation turns, companion memories, memories, reflections, patterns, events, chapters. Never media binaries; never raw DB rows. |
| Purpose | Ground the Companion LLM turn in relevant user context. |
| Client/server | Server (TanStack Start `createServerFn`). Identity is server-authoritative (verified token → userId). No provider keys in the retrieval layer. |
| Ownership/control assumption | The project controls what is selected and sent. **Requires legal review**: is sending user content to a third-party AI provider a "disclosure" / "transfer" requiring a lawful basis and user notice? |
| Retention question | Context is per-turn and not persisted as a separate store (retrieved fresh). **Requires legal review**: provider-side retention of prompts (see Stage F). |
| Deletion question | Deleting user facts removes them from future retrieval. **Requires legal review**: already-sent provider data cannot be recalled — see Stage F. |
| Cross-border question | Provider endpoints are outside the project's infrastructure. **Requires legal review**: transfer mechanism per provider/jurisdiction. |
| AI-provider transfer question | **Yes** — this is the stage where user content is transmitted to an AI provider. **Requires legal review**: lawful basis, user consent/notice, provider DPA, training-use opt-out. |

### Stage F — Orchestra → AI Provider

| Field | Value |
|-------|-------|
| Data category | Prompt (system + bounded user context + current message) and the provider's model output. Provider API key (server-only, never sent to client). |
| Purpose | Generate Companion/Story/Reflection/Significance output. |
| Client/server | Server (`src/lib/llm/orchestra.ts` calls provider OpenAI-compatible endpoints via `fetch`). Providers: Groq, Google Gemini, Mistral, OpenRouter. |
| Ownership/control assumption | The model/weights/API are the provider's property under the provider's terms. **Requires legal review**: who owns the generated output? Provider terms govern. |
| Retention question | **The project does not control provider-side retention/training policies.** **Requires legal review**: each provider's data retention, logging, and training-use terms must be reviewed; do not assume any provider's policy here. |
| Deletion question | Prompts sent to a provider cannot be deleted by the project after the fact. **Requires legal review**: erasure-request feasibility for data already processed by providers. |
| Cross-border question | Each provider processes data in its own infrastructure/regions (Groq, Google, Mistral, OpenRouter route to underlying models incl. Anthropic). **Requires legal review**: transfer mechanisms (SCCs, adequacy, etc.) per provider and destination. |
| AI-provider transfer question | **Yes** — direct transfer of user content to third-party AI providers. Central privacy/legal question for the beta. |

### Stage G — Provider → Response → Browser

| Field | Value |
|-------|-------|
| Data category | Generated text (Companion turn, Story, Reflection, candidate classification). |
| Purpose | Display to user; persist AI output **separately** from raw user facts. |
| Client/server | Server returns to browser; AI output stored in its own table/columns, never overwriting raw memory. |
| Ownership/control assumption | Generated output ownership per provider terms + project terms. **Requires legal review**. |
| Retention question | AI output stored until user deletion. **Requires legal review**: retention period for derived interpretations. |
| Deletion question | Deleting the source fact should not leave derived interpretation "pretending the fact still exists" (architecture §19). **Requires legal review**: implementation sufficiency. |
| Cross-border question | Response transits from provider region to user. **Requires legal review**. |
| AI-provider transfer question | No further transfer at this stage (response is shown to the user only). |

---

## 3. Telemetry / observability data flow (separate)

| Field | Value |
|-------|-------|
| Data category | Event names + low-risk categorical metadata (capability, provider inferred from model name, model, success, fallback, latency bucket). **Never**: raw user messages, raw memory/reflection content, photos, signed URLs, provider secrets, access tokens, full prompts, full LLM responses. A forbidden-key redaction list strips any such field. |
| Purpose | Product improvement; AI reliability observability. |
| Client/server | Internal abstraction (`src/lib/telemetry.ts`); default sink is no-op; beta may log structured events server-side for dev review. No third-party analytics SDK. |
| Ownership/control assumption | Project-controlled. **Requires legal review**: is server-side dev logging a processing activity requiring disclosure? |
| Retention question | Not specified. **Requires legal review**: retention period for telemetry logs. |
| Deletion question | Not specified. **Requires legal review**: telemetry deletion on account deletion. |
| Cross-border question | Wherever the Node server/logs reside (the operator-chosen hosting infrastructure). **Requires legal review**. |
| AI-provider transfer question | No — telemetry is internal; provider is identified by model name only, never by key. |

---

## 4. Personal data categories inventory

Distinguished by origin. Legal sensitivity is **not** classified conclusively;
each is marked **"requires legal review"** where character is uncertain.

| Category | Origin | Example | Notes |
|----------|--------|---------|-------|
| Account identity | SYSTEM | anonymous user id, access token (JWT) | Supabase anonymous auth. Requires legal review. |
| User profile | USER-PROVIDED | display name, pronouns, companion preferences | User-authored facts. Requires legal review. |
| Journey answers | USER-PROVIDED | 8 song titles | Stored in `journeys`. Requires legal review. |
| Music metadata | USER-PROVIDED | song title, artist, source type | Free-text labels the user supplies. Requires legal review. |
| Memory content | USER-PROVIDED | song + context (date/time, location, weather, life event, feeling, note) | Central personal data. Requires legal review. |
| Reflections | USER-PROVIDED or DERIVED | later thoughts about a memory | User-authored or Companion-authored (labelled). Requires legal review. |
| Life events | USER-PROVIDED | a move, a loss, a beginning | Requires legal review. |
| Life chapters | USER-PROVIDED | a year, a season, a phase | Requires legal review. |
| Media metadata + binary | USER-PROVIDED | image (jpeg/png/webp) + metadata | Private bucket, signed URLs. Requires legal review. |
| Connections | USER-PROVIDED or TRANSIENT (suggested) | links between memories/events/media | Suggested-but-unconfirmed are TRANSIENT. Requires legal review. |
| Companion conversations | USER-PROVIDED + DERIVED | conversation turns (user + assistant) | Requires legal review. |
| Significant interactions | DERIVED (candidate) → USER-PROVIDED (confirmed) | candidate classification then user-confirmed | Requires legal review. |
| Companion Memories | DERIVED (from confirmed interactions) | durable user-approved continuity | kind excludes inferred/AI categories. Requires legal review. |
| Patterns / derived interpretations | DERIVED | recurring structures across memories; evidence + interpretation | Requires legal review. |
| Music DNA | DERIVED | archetype, emotions, traits, music profile, poetic summary, poster model | Deterministic from journey. Requires legal review. |
| Stories | DERIVED (AI INTERPRETATION) | Life Story narrative | Generated; separate from facts. Requires legal review. |
| Telemetry | TELEMETRY | event names + categorical metadata | No raw content. Requires legal review. |
| AI usage metadata | TELEMETRY | capability, provider, model, success, fallback, latency bucket | No keys; no token counts in v1. Requires legal review. |

---

## 5. Special-category / sensitive-data questions

Some user content may, depending on context, constitute special-category
personal data (e.g. health, religious/philosophical beliefs, sex life, trade
union membership) under regimes such as GDPR Art. 9 or KVKK "special quality
personal data." Examples that may arise: a memory tied to a breakup, a loss, a
mental-health-related life event; a reflection about trauma.

- The product **does not ask** users to categorize content as sensitive, and
  imposes no special handling for potentially sensitive memories beyond the
  general owner-scoped RLS + private storage.
- **Requires legal review**: whether the product processes special-category
  data in practice; what lawful basis / safeguards (e.g. explicit consent,
  DPIA) would be required per market; whether a DPIA is needed before beta.

---

## 6. Children / minors

- The product has no age gate and no children-specific handling.
- **Requires legal review**: age restrictions per market; parental consent
  requirements; whether the emotional/personal nature of content triggers
  heightened obligations for minors.

---

## 7. Retention, deletion, export — open questions

- No automatic retention expiry is implemented for any category.
- No data-export feature exists.
- Deletion is owner-scoped per domain + Auth cascade; derived-data cascade
  sufficiency is a legal question.
- Unclaimed anonymous timelines have no defined retention policy.
- **Requires legal review** for each: retention periods, right to erasure
  implementation, data portability/export, unclaimed-account cleanup.

---

## 8. Cross-border transfer summary

Personal data leaves the project's direct control at:
- Supabase (Auth + Postgres + Storage) — region chosen at project setup.
- The operator-chosen hosting infrastructure (wherever the Node/Docker
  container runs) + logs.
- AI providers (Groq, Google Gemini, Mistral, OpenRouter → underlying models)
  — each provider's own regions.

**Requires legal review**: transfer mechanisms (adequacy decisions, Standard
Contractual Clauses, TR transfer agreements, UK IDTA/Addendum) per destination
and per market.

---

## 9. What this map is NOT

- Not a DPIA, ROPA, or compliance assertion.
- Not a statement of provider policies — provider retention/training/transfer
  terms must be read from each provider's current official documentation.
- Not legal advice.

_End of Data Flow and Privacy Map._
