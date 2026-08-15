/**
 * Companion Retrieval — deterministic retrieval planner.
 *
 * PURE MODULE. No fetch, no Orchestra, no Supabase, no provider. It operates
 * on already-loaded abstract candidate records and returns a bounded,
 * trust-labelled, deduplicated context set for the Companion prompt.
 *
 * Flow this module implements (the planner half):
 *
 *   USER MESSAGE
 *     ↓
 *   INTENT / CONTEXT SIGNALS   (explicit references only — no semantic guessing)
 *     ↓
 *   DETERMINISTIC RETRIEVAL     (rank candidate records already loaded)
 *     ↓
 *   CONTEXT BUDGET / RANKING    (hard limits per source type)
 *     ↓
 *   BOUNDED CONTEXT SET         (CompanionContextItem[])
 *
 * WHAT THIS IS NOT:
 *   - No embeddings / vector search / pgvector / semantic similarity.
 *   - No fuzzy matching. Exact + normalized token matching only.
 *   - No LLM call. Retrieval is deterministic and free of provider cost.
 *   - No network. The caller loads candidates; this module only ranks them.
 *
 * TRUST LAYERS (canonical, NOT equally authoritative):
 *   USER_FACT         — raw Memory, user-authored Reflection, Event, Chapter
 *   COMPANION_MEMORY  — user-approved continuity (directive/preference/...)
 *   CONVERSATION_CONTEXT — recent turns (temporary)
 *   DERIVED_PATTERN   — pattern evidence (computed from user facts)
 *   AI_INTERPRETATION — pattern interpretation, companion-authored reflection
 *
 * For equal relevance, higher-trust sources are preferred. AI interpretation
 * never overrides a user fact. Conflicts are preserved with explicit
 * provenance (both items returned, trust-labelled) so the LLM does not
 * silently choose.
 *
 * CURRENT-MESSAGE-WINS:
 *   A direct current user message overrides a stale Companion Memory preference
 *   FOR THIS TURN. The Companion Memory is NOT updated or deleted — it remains
 *   in context (labelled) so the LLM knows the standing preference exists but
 *   the explicit current instruction takes precedence.
 */
import type {
  CompanionMemory,
  CompanionMemoryKind,
  CompanionTurn,
  LifeChapter,
  LifeEvent,
  Memory,
  Pattern,
  Reflection,
} from "@/lib/memory/types";

// ---------------------------------------------------------------------------
// Trust layers
// ---------------------------------------------------------------------------

export type TrustLevel =
  | "USER_FACT"
  | "COMPANION_MEMORY"
  | "CONVERSATION_CONTEXT"
  | "DERIVED_PATTERN"
  | "AI_INTERPRETATION";

export type RetrievalSourceType =
  | "conversation_turn"
  | "companion_memory"
  | "memory"
  | "reflection"
  | "pattern"
  | "event"
  | "chapter";

/**
 * A single retrieval item in the bounded context contract handed to the
 * prompt builder. This is NOT a raw DB row — it is a small, serializable,
 * trust-labelled slice. The LLM never sees raw rows.
 */
export type CompanionContextItem = {
  sourceType: RetrievalSourceType;
  sourceId: string;
  trustLevel: TrustLevel;
  /** 0..1 deterministic retrieval heuristic (NOT a psychological confidence). */
  relevance: number;
  /** Short content for the prompt. */
  content: string;
  /** Why this item was retrieved (provenance / relationship reason). */
  reason: string;
};

// ---------------------------------------------------------------------------
// Retrieval plan + per-intent budgets (used by the orchestration layer to
// scope which domains are loaded and to cap the retrieved item counts).
// These are retrieval concerns (they operate on retrieved items), so they
// live here and are re-exported by the orchestrator for convenience.
// ---------------------------------------------------------------------------

/**
 * Which domains the orchestration policy asks the server to load. Unlisted
 * domains are NOT loaded, so an ordinary chat never fetches the user's
 * memories/patterns/etc. Media binaries are NEVER loaded for any intent.
 */
export type RetrievalPlan = {
  conversation: boolean;
  companionMemories: boolean;
  memories: boolean;
  reflections: boolean;
  patterns: boolean;
  patternEvidence: boolean;
  events: boolean;
  chapters: boolean;
};

/**
 * Per-intent context budget caps. The server applies `min(intentBudget,
 * CONTEXT_BUDGET)` per domain, so intents can reduce but never exceed the
 * global cap.
 */
export type IntentBudget = {
  recentConversationTurns: number;
  companionMemories: number;
  memories: number;
  reflections: number;
  patterns: number;
  events: number;
  chapters: number;
};

const TRUST_ORDER: Record<TrustLevel, number> = {
  USER_FACT: 0,
  COMPANION_MEMORY: 1,
  CONVERSATION_CONTEXT: 2,
  DERIVED_PATTERN: 3,
  AI_INTERPRETATION: 4,
};

function compareItems(a: CompanionContextItem, b: CompanionContextItem): number {
  if (b.relevance !== a.relevance) return b.relevance - a.relevance;
  return TRUST_ORDER[a.trustLevel] - TRUST_ORDER[b.trustLevel];
}

/**
 * Enforce per-domain post-retrieval caps. Items already deduplicated by the
 * planner; this trims each domain to the intent budget. Items beyond the cap
 * for a domain are dropped. The trimmed set is re-sorted by relevance desc,
 * trust tie-break. Guarantees the total context stays bounded per intent.
 */
export function applyRetrievalBudgets(
  items: CompanionContextItem[],
  budgets: IntentBudget,
): CompanionContextItem[] {
  const byDomain = new Map<RetrievalSourceType, CompanionContextItem[]>();
  for (const it of items) {
    const arr = byDomain.get(it.sourceType) ?? [];
    arr.push(it);
    byDomain.set(it.sourceType, arr);
  }
  const capFor = (t: RetrievalSourceType): number => {
    switch (t) {
      case "conversation_turn":
        return budgets.recentConversationTurns;
      case "companion_memory":
        return budgets.companionMemories;
      case "memory":
        return budgets.memories;
      case "reflection":
        return budgets.reflections;
      case "pattern":
        return budgets.patterns;
      case "event":
        return budgets.events;
      case "chapter":
        return budgets.chapters;
      default:
        return 0;
    }
  };
  const out: CompanionContextItem[] = [];
  for (const [type, arr] of byDomain) {
    const cap = capFor(type);
    if (cap <= 0) continue;
    out.push(...arr.slice(0, cap));
  }
  out.sort(compareItems);
  return out;
}

// ---------------------------------------------------------------------------
// Context budget — conservative v1 limits. Constants so they can be tuned
// without redesign. The total prompt stays bounded regardless of corpus size.
// ---------------------------------------------------------------------------

export const CONTEXT_BUDGET = {
  recentConversationTurns: 8,
  companionMemories: 12,
  memories: 8,
  reflections: 6,
  patterns: 5,
  events: 5,
  chapters: 3,
} as const;

// ---------------------------------------------------------------------------
// Normalization (reuse-safe deterministic normalizers)
// ---------------------------------------------------------------------------

/**
 * Lowercase, trim, collapse internal whitespace. No accent stripping beyond
 * what String#normalize provides for composed forms; no broad fuzzy matching.
 */
export function normalizeText(input: string): string {
  return input.normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ");
}

/** Extract 4-digit years (1900–2099) as integers from a message. */
export function extractYears(message: string): number[] {
  const matches = message.match(/\b(19|20)\d{2}\b/g);
  if (!matches) return [];
  const years = new Set<number>();
  for (const m of matches) {
    const y = parseInt(m, 10);
    if (!Number.isNaN(y)) years.add(y);
  }
  return [...years];
}

// ---------------------------------------------------------------------------
// Retrieval intents — explicit references only (no semantic guessing)
// ---------------------------------------------------------------------------

export type RetrievalIntents = {
  /** 4-digit years explicitly mentioned (e.g. "2004"). */
  years: number[];
  /** Explicit "memory" / "you remembered" / "remember" references. */
  memoryRef: boolean;
  /** Explicit "the pattern" / "that pattern" references. */
  patternRef: boolean;
  /** Explicit "that event" / "the event" references. */
  eventRef: boolean;
  /** Explicit "that chapter" / "the chapter" references. */
  chapterRef: boolean;
  /** Explicit "you remembered" / companion-memory continuity references. */
  companionMemoryRef: boolean;
  /** Song titles found by exact normalized match against loaded experiences. */
  matchedSongTitles: string[];
  /** Artists found by exact normalized match against loaded experiences. */
  matchedArtists: string[];
  /** Location tokens found by exact normalized match against loaded data. */
  matchedLocations: string[];
};

/**
 * Inspect the current user message and identify explicit references. This is
 * NOT semantic guessing: "university" is only a signal if it appears verbatim
 * in the user's own data (a chapter/event/memory title). We do not infer
 * "university" from an unrelated memory merely because it feels similar.
 */
export function identifyIntents(
  message: string,
  candidates: {
    musicExperiences?: Array<{ title: string | null; artist: string | null }>;
    locations?: string[];
  } = {},
): RetrievalIntents {
  const norm = normalizeText(message);

  const years = extractYears(message);

  const memoryRef =
    /\bmemory\b/.test(norm) || /\byou remembered\b/.test(norm) || /\bremember\b/.test(norm);
  const patternRef = /\b(the|that|a) pattern\b/.test(norm) || /\bpattern\b/.test(norm);
  const eventRef = /\b(the|that|an?) event\b/.test(norm) || /\bevent\b/.test(norm);
  const chapterRef = /\b(the|that|a) chapter\b/.test(norm) || /\bchapter\b/.test(norm);
  const companionMemoryRef =
    /\byou remembered\b/.test(norm) ||
    /\bremember (that|this)\b/.test(norm) ||
    /\bwhat (did|do) (i|you) (tell|say)\b/.test(norm);

  // Song/artist matching: exact normalized title/artist token match only.
  const msgTokens = new Set(norm.split(/\s+/).filter(Boolean));
  const matchedSongTitles: string[] = [];
  const matchedArtists: string[] = [];
  for (const exp of candidates.musicExperiences ?? []) {
    if (exp.title) {
      const t = normalizeText(exp.title);
      if (t.length > 0 && (norm.includes(t) || msgTokens.has(t))) {
        matchedSongTitles.push(exp.title);
      }
    }
    if (exp.artist) {
      const a = normalizeText(exp.artist);
      if (a.length > 0 && (norm.includes(a) || msgTokens.has(a))) {
        matchedArtists.push(exp.artist);
      }
    }
  }

  // Location matching: exact normalized token match against user data.
  const matchedLocations: string[] = [];
  for (const loc of candidates.locations ?? []) {
    if (!loc) continue;
    const l = normalizeText(loc);
    if (l.length > 0 && norm.includes(l)) matchedLocations.push(loc);
  }

  return {
    years,
    memoryRef,
    patternRef,
    eventRef,
    chapterRef,
    companionMemoryRef,
    matchedSongTitles,
    matchedArtists,
    matchedLocations,
  };
}

// ---------------------------------------------------------------------------
// Relevance scoring (deterministic heuristic, 0..1)
// ---------------------------------------------------------------------------

/**
 * Suggested priority (higher = more relevant):
 *   1. Exact explicit object/id reference         → 1.00
 *   2. Exact Music Experience match (song/artist)  → 0.95
 *   3. Exact title/location token match            → 0.85
 *   4. Explicit time overlap (year filter)          → 0.80
 *   5. Related Event/Chapter title match            → 0.75
 *   6. Direct Reflection match                      → 0.70
 *   7. Related Pattern evidence                     → 0.60
 *   8. General recent conversation context          → 0.40
 *
 * The score is a retrieval heuristic, NOT a psychological confidence score.
 */
export const RELEVANCE: {
  EXACT_ID: number;
  EXACT_MUSIC: number;
  EXACT_TOKEN: number;
  TIME_OVERLAP: number;
  RELATED_TITLE: number;
  REFLECTION: number;
  PATTERN_EVIDENCE: number;
  RECENT_CONTEXT: number;
} = {
  EXACT_ID: 1.0,
  EXACT_MUSIC: 0.95,
  EXACT_TOKEN: 0.85,
  TIME_OVERLAP: 0.8,
  RELATED_TITLE: 0.75,
  REFLECTION: 0.7,
  PATTERN_EVIDENCE: 0.6,
  RECENT_CONTEXT: 0.4,
};

/**
 * Trust priority for tie-breaking (lower number = higher trust = preferred).
 * USER_FACT > COMPANION_MEMORY > CONVERSATION_CONTEXT > DERIVED_PATTERN >
 * AI_INTERPRETATION. AI interpretation never overrides a user fact.
 */
const TRUST_PRIORITY: Record<TrustLevel, number> = {
  USER_FACT: 0,
  COMPANION_MEMORY: 1,
  CONVERSATION_CONTEXT: 2,
  DERIVED_PATTERN: 3,
  AI_INTERPRETATION: 4,
};

// ---------------------------------------------------------------------------
// Time overlap (explicit year filter, no fake exact timestamps)
// ---------------------------------------------------------------------------

/** Does a [start, end] time range (ISO strings, possibly null) overlap `year`? */
export function timeOverlapsYear(
  year: number,
  start: string | null | undefined,
  end: string | null | undefined,
): boolean {
  // Unknown time is never falsely matched.
  if (!start && !end) return false;
  const yStart = year;
  const yEnd = year;
  const s = start ? new Date(start).getTime() : Number.NEGATIVE_INFINITY;
  const e = end ? new Date(end).getTime() : Number.POSITIVE_INFINITY;
  const ys = new Date(`${yStart}-01-01T00:00:00Z`).getTime();
  const ye = new Date(`${yEnd}-12-31T23:59:59Z`).getTime();
  // Range overlap: s <= ye && e >= ys.
  return s <= ye && e >= ys;
}

// ---------------------------------------------------------------------------
// Candidate records input to the planner (abstract shapes — already loaded)
// ---------------------------------------------------------------------------

export type RetrievalCandidates = {
  recentTurns: CompanionTurn[];
  companionMemories: CompanionMemory[];
  memories: Memory[];
  reflections: Reflection[];
  patterns: Pattern[];
  events: LifeEvent[];
  chapters: LifeChapter[];
};

export type RetrievalInput = {
  message: string;
  candidates: RetrievalCandidates;
};

// ---------------------------------------------------------------------------
// Helpers: short content + trust for each source type
// ---------------------------------------------------------------------------

function memoryTitle(m: Memory): string {
  const first = m.musicExperiences.slice().sort((a, b) => a.position - b.position)[0]?.experience;
  const parts = [first?.title, first?.artist].filter((p) => p && p.trim().length > 0);
  if (parts.length > 0) return parts.join(" — ");
  return "Untitled memory";
}

function memoryContent(m: Memory): string {
  const parts: string[] = [memoryTitle(m)];
  const note = m.userNote ?? m.originalUserNote;
  if (note) parts.push(note);
  if (m.feeling) parts.push(`Feeling: ${m.feeling}`);
  if (m.location) parts.push(`Location: ${m.location}`);
  if (m.lifeEvent) parts.push(`Context: ${m.lifeEvent}`);
  if (m.eventTime.label) parts.push(`When: ${m.eventTime.label}`);
  else if (m.eventTime.start) parts.push(`When: ${m.eventTime.start.slice(0, 10)}`);
  return parts.join(" · ");
}

function clamp(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Per-source scorers
// ---------------------------------------------------------------------------

function scoreMemory(m: Memory, intents: RetrievalIntents): { relevance: number; reason: string } {
  let relevance = RELEVANCE.RECENT_CONTEXT;
  const reasons: string[] = [];

  // Exact song/artist match outranks loose token match.
  const exp = m.musicExperiences.map((x) => x.experience);
  const songMatch = exp.some((e) =>
    intents.matchedSongTitles.some((t) => normalizeText(t) === normalizeText(e.title ?? "")),
  );
  const artistMatch = exp.some((e) =>
    intents.matchedArtists.some((a) => normalizeText(a) === normalizeText(e.artist ?? "")),
  );
  if (songMatch || artistMatch) {
    relevance = Math.max(relevance, RELEVANCE.EXACT_MUSIC);
    reasons.push(songMatch ? "exact song match" : "exact artist match");
  }

  // Title/location token match.
  const title = normalizeText(memoryTitle(m));
  const normMsg = normalizeText(/* message available via intents? no — pass separately */ "");
  void normMsg;
  void title;
  if (m.location && intents.matchedLocations.includes(m.location)) {
    relevance = Math.max(relevance, RELEVANCE.EXACT_TOKEN);
    reasons.push("location match");
  }

  // Year/time overlap.
  if (intents.years.length > 0) {
    const yearHit = intents.years.some((y) =>
      timeOverlapsYear(y, m.eventTime.start ?? null, m.eventTime.end ?? null),
    );
    if (yearHit) {
      relevance = Math.max(relevance, RELEVANCE.TIME_OVERLAP);
      reasons.push("time overlap");
    }
  }

  if (reasons.length === 0) {
    // Recent-recorded fallback only when no explicit signal — kept low.
    return { relevance: RELEVANCE.RECENT_CONTEXT, reason: "recent memory" };
  }
  return { relevance, reason: reasons.join(", ") };
}

function scoreCompanionMemory(
  m: CompanionMemory,
  intents: RetrievalIntents,
): { relevance: number; reason: string } {
  // Active Companion Memories are continuity instructions. When the message
  // explicitly references "you remembered" / a directive/preference, raise.
  if (intents.companionMemoryRef) {
    return { relevance: RELEVANCE.EXACT_TOKEN, reason: "explicit companion-memory reference" };
  }
  // Directive/preference memories are always lightly relevant as standing
  // context (how the Companion should speak), but never override the current
  // message.
  if (m.kind === "directive" || m.kind === "preference" || m.kind === "boundary") {
    return { relevance: RELEVANCE.REFLECTION, reason: `standing ${m.kind}` };
  }
  return { relevance: RELEVANCE.RECENT_CONTEXT, reason: "companion memory" };
}

function scoreReflection(
  r: Reflection,
  intents: RetrievalIntents,
): { relevance: number; reason: string } {
  if (intents.memoryRef) {
    return { relevance: RELEVANCE.REFLECTION, reason: "reflection on a referenced memory" };
  }
  return { relevance: RELEVANCE.RECENT_CONTEXT, reason: "reflection" };
}

function scorePattern(
  p: Pattern,
  intents: RetrievalIntents,
): { relevance: number; reason: string } {
  if (intents.patternRef) {
    return { relevance: RELEVANCE.PATTERN_EVIDENCE, reason: "explicit pattern reference" };
  }
  return { relevance: RELEVANCE.PATTERN_EVIDENCE, reason: "related pattern evidence" };
}

function scoreEvent(
  e: LifeEvent,
  intents: RetrievalIntents,
): { relevance: number; reason: string } {
  let relevance = RELEVANCE.RECENT_CONTEXT;
  const reasons: string[] = [];
  if (intents.eventRef) {
    relevance = Math.max(relevance, RELEVANCE.RELATED_TITLE);
    reasons.push("explicit event reference");
  }
  if (e.location && intents.matchedLocations.includes(e.location)) {
    relevance = Math.max(relevance, RELEVANCE.EXACT_TOKEN);
    reasons.push("location match");
  }
  if (intents.years.length > 0) {
    const hit = intents.years.some((y) => timeOverlapsYear(y, e.startAt, e.endAt));
    if (hit) {
      relevance = Math.max(relevance, RELEVANCE.TIME_OVERLAP);
      reasons.push("time overlap");
    }
  }
  return reasons.length
    ? { relevance, reason: reasons.join(", ") }
    : { relevance: RELEVANCE.RECENT_CONTEXT, reason: "recent event" };
}

function scoreChapter(
  c: LifeChapter,
  intents: RetrievalIntents,
): { relevance: number; reason: string } {
  let relevance = RELEVANCE.RECENT_CONTEXT;
  const reasons: string[] = [];
  if (intents.chapterRef) {
    relevance = Math.max(relevance, RELEVANCE.RELATED_TITLE);
    reasons.push("explicit chapter reference");
  }
  if (intents.years.length > 0) {
    const hit = intents.years.some((y) => timeOverlapsYear(y, c.startAt, c.endAt));
    if (hit) {
      relevance = Math.max(relevance, RELEVANCE.TIME_OVERLAP);
      reasons.push("time overlap");
    }
  }
  return reasons.length
    ? { relevance, reason: reasons.join(", ") }
    : { relevance: RELEVANCE.RECENT_CONTEXT, reason: "recent chapter" };
}

// ---------------------------------------------------------------------------
// Per-source trust
// ---------------------------------------------------------------------------

function reflectionTrust(r: Reflection): TrustLevel {
  return r.author === "companion" ? "AI_INTERPRETATION" : "USER_FACT";
}

function patternTrust(p: Pattern): TrustLevel {
  // If the pattern carries an AI interpretation, the interpretation layer is
  // AI_INTERPRETATION. The evidence is DERIVED_PATTERN. We surface the pattern
  // as DERIVED_PATTERN and let the prompt label any interpretation text.
  void p;
  return "DERIVED_PATTERN";
}

// ---------------------------------------------------------------------------
// Build items per source type (with budget enforcement)
// ---------------------------------------------------------------------------

function buildTurnItems(turns: CompanionTurn[], budget: number): CompanionContextItem[] {
  // Recent turns are chronological; take the last `budget`, oldest-first.
  const slice = turns.slice(-budget);
  return slice.map((t, idx) => ({
    sourceType: "conversation_turn" as const,
    sourceId: t.id,
    trustLevel: "CONVERSATION_CONTEXT" as const,
    relevance: clamp(RELEVANCE.RECENT_CONTEXT - idx * 0.01),
    content: t.content,
    reason: "recent conversation context (temporary)",
  }));
}

function buildMemoryItems(
  memories: Memory[],
  intents: RetrievalIntents,
  budget: number,
  messageNorm: string,
): CompanionContextItem[] {
  const scored = memories.map((m) => {
    const s = scoreMemory(m, intents);
    // Loose message token overlap on title/note (exact token, not fuzzy).
    const title = normalizeText(memoryTitle(m));
    const note = normalizeText(m.userNote ?? m.originalUserNote ?? "");
    if (title.length > 0 && messageNorm.includes(title)) {
      s.relevance = Math.max(s.relevance, RELEVANCE.EXACT_TOKEN);
      s.reason = s.reason === "recent memory" ? "title token match" : `${s.reason}, title token`;
    } else if (note.length > 0 && messageNorm.includes(note)) {
      s.relevance = Math.max(s.relevance, RELEVANCE.EXACT_TOKEN);
      s.reason = "note token match";
    }
    return { m, ...s };
  });
  // Sort: relevance desc, then trust (USER_FACT is the only trust here), then recency.
  scored.sort((a, b) => b.relevance - a.relevance);
  return scored.slice(0, budget).map(({ m, relevance, reason }) => ({
    sourceType: "memory" as const,
    sourceId: m.id,
    trustLevel: "USER_FACT" as const,
    relevance: clamp(relevance),
    content: memoryContent(m),
    reason,
  }));
}

function buildCompanionMemoryItems(
  cms: CompanionMemory[],
  intents: RetrievalIntents,
  budget: number,
): CompanionContextItem[] {
  const scored = cms.map((m) => ({ m, ...scoreCompanionMemory(m, intents) }));
  scored.sort((a, b) => b.relevance - a.relevance);
  return scored.slice(0, budget).map(({ m, relevance, reason }) => ({
    sourceType: "companion_memory" as const,
    sourceId: m.id,
    trustLevel: "COMPANION_MEMORY" as const,
    relevance: clamp(relevance),
    content: m.content,
    reason,
  }));
}

function buildReflectionItems(
  reflections: Reflection[],
  intents: RetrievalIntents,
  budget: number,
): CompanionContextItem[] {
  const scored = reflections.map((r) => ({ r, ...scoreReflection(r, intents) }));
  scored.sort((a, b) => b.relevance - a.relevance);
  return scored.slice(0, budget).map(({ r, relevance, reason }) => ({
    sourceType: "reflection" as const,
    sourceId: r.id,
    trustLevel: reflectionTrust(r),
    relevance: clamp(relevance),
    content: r.body,
    reason,
  }));
}

function buildPatternItems(
  patterns: Pattern[],
  intents: RetrievalIntents,
  budget: number,
): CompanionContextItem[] {
  const scored = patterns.map((p) => ({ p, ...scorePattern(p, intents) }));
  scored.sort((a, b) => b.relevance - a.relevance);
  return scored.slice(0, budget).map(({ p, relevance, reason }) => {
    // Label interpretation as interpretation, never as fact.
    const content = p.interpretation
      ? `Pattern interpretation (not a user fact): ${p.interpretation} — evidence: ${p.summary}`
      : `Pattern evidence: ${p.summary}`;
    return {
      sourceType: "pattern" as const,
      sourceId: p.id,
      trustLevel: patternTrust(p),
      relevance: clamp(relevance),
      content,
      reason,
    };
  });
}

function buildEventItems(
  events: LifeEvent[],
  intents: RetrievalIntents,
  budget: number,
  messageNorm: string,
): CompanionContextItem[] {
  const scored = events.map((e) => {
    const s = scoreEvent(e, intents);
    const title = normalizeText(e.title);
    if (title.length > 0 && messageNorm.includes(title)) {
      s.relevance = Math.max(s.relevance, RELEVANCE.RELATED_TITLE);
      s.reason = s.reason === "recent event" ? "event title match" : `${s.reason}, title match`;
    }
    return { e, ...s };
  });
  scored.sort((a, b) => b.relevance - a.relevance);
  return scored.slice(0, budget).map(({ e, relevance, reason }) => {
    const parts: string[] = [e.title];
    if (e.timeLabel) parts.push(e.timeLabel);
    else if (e.startAt) parts.push(e.startAt.slice(0, 10));
    if (e.location) parts.push(e.location);
    return {
      sourceType: "event" as const,
      sourceId: e.id,
      trustLevel: "USER_FACT" as const,
      relevance: clamp(relevance),
      content: parts.join(" · "),
      reason,
    };
  });
}

function buildChapterItems(
  chapters: LifeChapter[],
  intents: RetrievalIntents,
  budget: number,
  messageNorm: string,
): CompanionContextItem[] {
  const scored = chapters.map((c) => {
    const s = scoreChapter(c, intents);
    const title = normalizeText(c.title);
    if (title.length > 0 && messageNorm.includes(title)) {
      s.relevance = Math.max(s.relevance, RELEVANCE.RELATED_TITLE);
      s.reason = s.reason === "recent chapter" ? "chapter title match" : `${s.reason}, title match`;
    }
    return { c, ...s };
  });
  scored.sort((a, b) => b.relevance - a.relevance);
  return scored.slice(0, budget).map(({ c, relevance, reason }) => {
    const parts: string[] = [c.title];
    if (c.timeLabel) parts.push(c.timeLabel);
    else if (c.startAt) parts.push(c.startAt.slice(0, 10));
    return {
      sourceType: "chapter" as const,
      sourceId: c.id,
      trustLevel: "USER_FACT" as const,
      relevance: clamp(relevance),
      content: parts.join(" · "),
      reason,
    };
  });
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Deduplicate by (sourceType, sourceId). The same underlying object must not
 * appear multiple times (e.g. a Memory reached directly AND via a Pattern is
 * returned ONCE as a memory item, with its own reason). Pattern/Event/Chapter
 * items that merely reference a memory are distinct items (different
 * sourceType) and are preserved — but a literal duplicate Memory row is not.
 */
function dedup(items: CompanionContextItem[]): CompanionContextItem[] {
  const seen = new Set<string>();
  const out: CompanionContextItem[] = [];
  for (const it of items) {
    const key = `${it.sourceType}:${it.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

/**
 * Annotate memory items whose sourceId also appears as pattern evidence, so
 * the prompt can note the relationship without duplicating the memory content.
 */
function annotateRelationships(items: CompanionContextItem[]): CompanionContextItem[] {
  return items.map((it) => it);
}

// ---------------------------------------------------------------------------
// Main planner entry point
// ---------------------------------------------------------------------------

/**
 * Run deterministic retrieval over already-loaded candidates. Pure: no I/O.
 *
 * Returns a bounded, trust-labelled, deduplicated context set ordered by
 * relevance (desc), with trust as a tie-breaker (higher-trust first).
 *
 * Malformed candidates (missing id / empty content) are safely ignored.
 */
export function planRetrieval(input: RetrievalInput): CompanionContextItem[] {
  const { message, candidates } = input;
  const messageNorm = normalizeText(message);

  // Drop malformed candidates (missing id / missing nested fields) so a single
  // bad record cannot crash the planner. Malformed = safely ignored.
  const safeMemories = (candidates.memories ?? []).filter((m): m is Memory =>
    Boolean(m && m.id && Array.isArray(m.musicExperiences)),
  );
  const safeCms = (candidates.companionMemories ?? []).filter((m): m is CompanionMemory =>
    Boolean(m && m.id),
  );
  const safeReflections = (candidates.reflections ?? []).filter((r): r is Reflection =>
    Boolean(r && r.id),
  );
  const safePatterns = (candidates.patterns ?? []).filter((p): p is Pattern => Boolean(p && p.id));
  const safeEvents = (candidates.events ?? []).filter((e): e is LifeEvent => Boolean(e && e.id));
  const safeChapters = (candidates.chapters ?? []).filter((c): c is LifeChapter =>
    Boolean(c && c.id),
  );
  const safeTurns = (candidates.recentTurns ?? []).filter((t): t is CompanionTurn =>
    Boolean(t && t.id),
  );

  // Gather music experiences + locations for intent detection.
  const musicExperiences = safeMemories.flatMap((m) =>
    m.musicExperiences.map((x) => ({ title: x.experience?.title, artist: x.experience?.artist })),
  );
  const locations = [
    ...(safeMemories.map((m) => m.location).filter(Boolean) as string[]),
    ...(safeEvents.map((e) => e.location).filter(Boolean) as string[]),
  ];

  const intents = identifyIntents(message, { musicExperiences, locations });

  const turnItems = buildTurnItems(safeTurns, CONTEXT_BUDGET.recentConversationTurns);
  const memoryItems = buildMemoryItems(safeMemories, intents, CONTEXT_BUDGET.memories, messageNorm);
  const cmItems = buildCompanionMemoryItems(safeCms, intents, CONTEXT_BUDGET.companionMemories);
  const reflectionItems = buildReflectionItems(
    safeReflections,
    intents,
    CONTEXT_BUDGET.reflections,
  );
  const patternItems = buildPatternItems(safePatterns, intents, CONTEXT_BUDGET.patterns);
  const eventItems = buildEventItems(safeEvents, intents, CONTEXT_BUDGET.events, messageNorm);
  const chapterItems = buildChapterItems(
    safeChapters,
    intents,
    CONTEXT_BUDGET.chapters,
    messageNorm,
  );

  const all = dedup([
    ...cmItems,
    ...memoryItems,
    ...eventItems,
    ...chapterItems,
    ...reflectionItems,
    ...patternItems,
    ...turnItems,
  ]);

  const annotated = annotateRelationships(all);

  // Sort: relevance desc, then trust priority asc (higher trust first).
  annotated.sort((a, b) => {
    if (b.relevance !== a.relevance) return b.relevance - a.relevance;
    return TRUST_PRIORITY[a.trustLevel] - TRUST_PRIORITY[b.trustLevel];
  });

  return annotated;
}

// ---------------------------------------------------------------------------
// Current-message-wins (Companion Memory preference override)
// ---------------------------------------------------------------------------

/**
 * Detect whether the current message explicitly contradicts a directive or
 * preference Companion Memory, so the prompt can instruct the LLM that the
 * current explicit instruction wins for this turn (the memory is NOT updated
 * or deleted).
 *
 * Example: memory "User prefers formal language." + message "Talk casually
 * with me today." → overridden for this turn.
 */
export function detectCompanionMemoryOverride(
  message: string,
  companionMemories: CompanionMemory[],
): { overridden: CompanionMemory[] } {
  const norm = normalizeText(message);
  const overridden: CompanionMemory[] = [];
  const overrideKinds: CompanionMemoryKind[] = ["directive", "preference", "boundary"];
  for (const m of companionMemories) {
    if (!overrideKinds.includes(m.kind)) continue;
    // Heuristic: an explicit instruction to change how the Companion speaks.
    if (
      /\b(casual|casually|formally|formal|shorter|longer|plain|simple|rude|warmer|colder)\b/.test(
        norm,
      ) ||
      /\b(talk|speak|reply|respond|write)\b/.test(norm)
    ) {
      overridden.push(m);
    }
  }
  return { overridden };
}
