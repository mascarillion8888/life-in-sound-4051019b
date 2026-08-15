/**
 * Companion Contextual Orchestration — deterministic intent policy.
 *
 * PURE MODULE. No fetch, no Orchestra, no Supabase, no provider. It receives a
 * normalized request description and produces an orchestration policy that
 * decides:
 *   - WHAT kind of request this is (intent)
 *   - WHICH existing capability should handle it
 *   - WHICH retrieval domains are needed (bounded; load only what is relevant)
 *   - whether the existing Significant Interaction gate should still run
 *   - the deterministic priority
 *
 * This is a THIN orchestration policy over the existing system. It is NOT a new
 * multi-agent platform. It does not execute anything; the server function
 * (companionConversation.server.ts) consumes the policy to drive retrieval and
 * capability dispatch.
 *
 * LAYER SEPARATION (do not collapse):
 *   companionOrchestrator.ts  → decides WHAT we need.
 *   companionRetrieval.ts     → decides WHICH records satisfy the plan.
 *   Orchestra / LLM            → decides HOW to formulate the response.
 *
 * CONSERVATISM:
 *   Intent classification is keyword/regex-based and deliberately conservative.
 *   It does NOT infer sensitive personal facts, classify on sentiment alone,
 *   or guess. When ambiguous, it falls back to safe chat.
 *
 * COST CONTROL:
 *   Classification is deterministic — it NEVER calls the LLM to classify intent.
 *
 * CURRENT-MESSAGE-WINS:
 *   The current user message is always the highest-priority instruction for the
 *   current turn. If it conflicts with a stored Companion Memory, the current
 *   message wins for THIS turn. The stored Companion Memory is NOT updated or
 *   deleted. The policy exposes `currentUserInstruction = "highest_priority"`.
 */
import type { CompanionContextItem, TrustLevel } from "@/lib/memory/companionRetrieval";
import {
  applyRetrievalBudgets,
  type IntentBudget,
  type RetrievalPlan,
} from "@/lib/memory/companionRetrieval";

// Re-export so callers can import budget/plan utilities from the orchestrator
// module if convenient, while the canonical definitions stay in the retrieval
// module (where they belong — they operate on retrieved items).
export { applyRetrievalBudgets, type IntentBudget, type RetrievalPlan };

// ---------------------------------------------------------------------------
// Intent + capability
// ---------------------------------------------------------------------------

export type CompanionIntent =
  | "chat"
  | "memory_recall"
  | "companion_memory_recall"
  | "pattern_exploration"
  | "event_chapter_recall"
  | "story_request"
  | "memory_creation"
  | "reflection"
  | "unknown";

/**
 * Existing capability each intent maps to. No new provider roles are created.
 * The capability dispatcher (companionCapabilities.ts) turns this into a
 * concrete runRole call + prompt.
 */
export type CompanionCapability =
  | "chat"
  | "grounded_recall"
  | "companion_memory_recall"
  | "pattern_exploration"
  | "event_chapter_recall"
  | "story"
  | "memory_creation"
  | "reflection";

export type OrchestrationPriority = "high" | "medium" | "low";

/**
 * The bounded retrieval plan: which domains to load. The server loads ONLY
 * these domains (owner-scoped, bounded). Unlisted domains are NOT loaded, so a
 * chat message never fetches the user's memories/patterns/etc. Media binaries
 * are NEVER loaded for any intent.
 */

export type CompanionOrchestratorPolicy = {
  intent: CompanionIntent;
  capability: CompanionCapability;
  retrievalPlan: RetrievalPlan;
  /** Per-intent budget caps (≤ global defaults). */
  budgets: IntentBudget;
  /** Whether the existing Significant Interaction gate should still run. */
  shouldAnalyzeSignificance: boolean;
  priority: OrchestrationPriority;
  /** Human-readable reason the intent was chosen (for diagnostics/tests). */
  reason: string;
  /**
   * The current user message is always the highest-priority instruction for
   * this turn; it overrides any stored Companion Memory preference for this
   * turn only. The stored memory is NOT updated.
   */
  currentUserInstruction: "highest_priority";
  /**
   * Optional reference to a single identified record (e.g. a memory id) when
   * the message clearly points at one. Reflection/story capabilities may use
   * it. null when no single record is identified.
   */
  identifiedMemoryId: string | null;
};

// ---------------------------------------------------------------------------
// Normalization (reuse the safe deterministic normalizer semantics)
// ---------------------------------------------------------------------------

function normalize(message: string): string {
  return message.normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Intent classification (conservative, ordered)
// ---------------------------------------------------------------------------

/**
 * Order matters: more specific intents are checked before broader ones.
 * memory_creation (explicit "remember this") is highest priority because it
 * must route to the existing significance flow. Then companion_memory_recall,
 * story_request, pattern_exploration, event_chapter_recall, memory_recall,
 * reflection. Ordinary chat is the fallback.
 *
 * Classification is intentionally conservative: it uses explicit phrase
 * patterns, never sentiment, and never infers sensitive personal facts.
 */
function classifyIntent(message: string): { intent: CompanionIntent; reason: string } {
  const m = normalize(message);

  // memory_creation — explicit durable preference/boundary/remember wording.
  // This routes to the existing Significant Interaction flow. Also catches an
  // explicit current speaking-style instruction (e.g. "talk casually with me
  // today") so a standing preference can be honoured/overridden for this turn.
  if (
    /\b(remember this|remember that|save this|i want you to remember|keep this in mind|don't forget|from now on|please remember)\b/.test(
      m,
    ) ||
    /\bi (prefer|always want|don't like|do like|need you to)\b/.test(m) ||
    /\b(talk|speak|reply|respond|write)\b[^\n]{0,40}\b(casually|casual|formally|formal|warmly|warm|coldly|cold|plainly|plain|simply|simple|shorter|longer)\b/.test(
      m,
    )
  ) {
    return { intent: "memory_creation", reason: "explicit remember/preference wording" };
  }

  // companion_memory_recall — what does the Companion remember about how to
  // speak / what the user asked to remember.
  if (
    /\b(what did you remember about me|what do you remember about me|what do you remember about my|what did i ask you|what did i tell you|what did i ask you to remember|how should you talk to me|how should you speak to me|what (preferences|boundaries) do you remember|what do you know about how i)\b/.test(
      m,
    )
  ) {
    return {
      intent: "companion_memory_recall",
      reason: "explicit companion-memory continuity question",
    };
  }

  // story_request — turn this into a story / tell the story.
  if (
    /\b(tell me the story|tell the story|turn this into a story|into a story|write my story|make this (poetic|a story)|tell it like a story|story of my|narrate)\b/.test(
      m,
    )
  ) {
    return { intent: "story_request", reason: "explicit story/narrative request" };
  }

  // pattern_exploration.
  if (
    /\b(pattern|patterns|i noticed something|why did you show me|what repeats|what repeats in my memories|recurring)\b/.test(
      m,
    )
  ) {
    return { intent: "pattern_exploration", reason: "explicit pattern reference" };
  }

  // event_chapter_recall — period of life / chapter / event title.
  if (
    /\b(chapter|chapters|event|events|university years|that period of my life|that era|that time of my life|phase of my life)\b/.test(
      m,
    )
  ) {
    return {
      intent: "event_chapter_recall",
      reason: "explicit event/chapter/period reference",
    };
  }

  // memory_recall — explicit memory / do you remember + song/year.
  if (
    /\b(do you remember|remember my memory|that memory|that song from|my memory of)\b/.test(m) ||
    (/\bmemory\b/.test(m) && /\b(19|20)\d{2}\b/.test(m))
  ) {
    return { intent: "memory_recall", reason: "explicit memory recall" };
  }

  // reflection — help me reflect on this memory / help me understand it.
  if (
    /\b(help me reflect|reflect on this|what do you think about this memory|help me understand this memory|help me understand this|help me understand)\b/.test(
      m,
    )
  ) {
    return { intent: "reflection", reason: "explicit reflection request" };
  }

  // chat — ordinary conversational messages, greetings, casual discussion.
  return { intent: "chat", reason: "ordinary conversational message" };
}

// ---------------------------------------------------------------------------
// Capability map (intent → existing capability)
// ---------------------------------------------------------------------------

const CAPABILITY_MAP: Record<CompanionIntent, CompanionCapability> = {
  chat: "chat",
  memory_recall: "grounded_recall",
  companion_memory_recall: "companion_memory_recall",
  pattern_exploration: "pattern_exploration",
  event_chapter_recall: "event_chapter_recall",
  story_request: "story",
  memory_creation: "memory_creation",
  reflection: "reflection",
  unknown: "chat",
};

// ---------------------------------------------------------------------------
// Priority map
// ---------------------------------------------------------------------------

const PRIORITY_MAP: Record<CompanionIntent, OrchestrationPriority> = {
  memory_recall: "high",
  companion_memory_recall: "high",
  story_request: "high",
  memory_creation: "high",
  pattern_exploration: "medium",
  event_chapter_recall: "medium",
  reflection: "medium",
  chat: "low",
  unknown: "low",
};

// ---------------------------------------------------------------------------
// Retrieval plans per intent (load ONLY these domains)
// ---------------------------------------------------------------------------

function retrievalPlanFor(intent: CompanionIntent): RetrievalPlan {
  switch (intent) {
    case "chat":
    case "unknown":
      // Conversation only — no stored history fetched for ordinary chat.
      return {
        conversation: true,
        companionMemories: false,
        memories: false,
        reflections: false,
        patterns: false,
        patternEvidence: false,
        events: false,
        chapters: false,
      };
    case "memory_recall":
      return {
        conversation: true,
        companionMemories: true,
        memories: true,
        reflections: true,
        patterns: false,
        patternEvidence: false,
        events: true,
        chapters: true,
      };
    case "companion_memory_recall":
      // Active Companion Memories of directive/preference/boundary only. The
      // server filters by kind; unrelated memories are not exposed.
      return {
        conversation: true,
        companionMemories: true,
        memories: false,
        reflections: false,
        patterns: false,
        patternEvidence: false,
        events: false,
        chapters: false,
      };
    case "pattern_exploration":
      return {
        conversation: true,
        companionMemories: false,
        memories: true,
        reflections: false,
        patterns: true,
        patternEvidence: true,
        events: false,
        chapters: false,
      };
    case "event_chapter_recall":
      return {
        conversation: true,
        companionMemories: false,
        memories: true,
        reflections: false,
        patterns: false,
        patternEvidence: false,
        events: true,
        chapters: true,
      };
    case "story_request":
      // Use existing bounded limits but only for explicitly relevant targets.
      return {
        conversation: true,
        companionMemories: true,
        memories: true,
        reflections: true,
        patterns: true,
        patternEvidence: false,
        events: true,
        chapters: true,
      };
    case "memory_creation":
      // Normal Companion response; the existing significance gate handles the
      // candidate. Retrieval: conversation + companion memories (standing
      // preferences) only — no need to fetch memories/patterns.
      return {
        conversation: true,
        companionMemories: true,
        memories: false,
        reflections: false,
        patterns: false,
        patternEvidence: false,
        events: false,
        chapters: false,
      };
    case "reflection":
      return {
        conversation: true,
        companionMemories: true,
        memories: true,
        reflections: true,
        patterns: false,
        patternEvidence: false,
        events: false,
        chapters: false,
      };
  }
}

// ---------------------------------------------------------------------------
// Budget caps per intent (never exceed global defaults)
// ---------------------------------------------------------------------------

/**
 * The global default budgets (mirrored from companionRetrieval.CONTEXT_BUDGET).
 * The server applies `min(intentBudget, globalDefault)` per domain, so intents
 * can reduce but never exceed the global cap.
 */
export const GLOBAL_DEFAULT_BUDGETS: IntentBudget = {
  recentConversationTurns: 8,
  companionMemories: 12,
  memories: 8,
  reflections: 6,
  patterns: 5,
  events: 5,
  chapters: 3,
};

function budgetFor(intent: CompanionIntent): IntentBudget {
  switch (intent) {
    case "chat":
    case "unknown":
      return {
        recentConversationTurns: 8,
        companionMemories: 0,
        memories: 0,
        reflections: 0,
        patterns: 0,
        events: 0,
        chapters: 0,
      };
    case "companion_memory_recall":
      return {
        recentConversationTurns: 8,
        companionMemories: 12,
        memories: 0,
        reflections: 0,
        patterns: 0,
        events: 0,
        chapters: 0,
      };
    case "memory_recall":
      return {
        recentConversationTurns: 8,
        companionMemories: 6,
        memories: 8,
        reflections: 6,
        patterns: 0,
        events: 5,
        chapters: 3,
      };
    case "pattern_exploration":
      return {
        recentConversationTurns: 8,
        companionMemories: 0,
        memories: 8,
        reflections: 0,
        patterns: 5,
        events: 0,
        chapters: 0,
      };
    case "event_chapter_recall":
      return {
        recentConversationTurns: 8,
        companionMemories: 0,
        memories: 8,
        reflections: 0,
        patterns: 0,
        events: 5,
        chapters: 3,
      };
    case "story_request":
      // Use existing bounded limits for explicitly relevant targets.
      return {
        recentConversationTurns: 8,
        companionMemories: 6,
        memories: 8,
        reflections: 6,
        patterns: 5,
        events: 5,
        chapters: 3,
      };
    case "memory_creation":
      return {
        recentConversationTurns: 8,
        companionMemories: 6,
        memories: 0,
        reflections: 0,
        patterns: 0,
        events: 0,
        chapters: 0,
      };
    case "reflection":
      return {
        recentConversationTurns: 8,
        companionMemories: 6,
        memories: 8,
        reflections: 6,
        patterns: 0,
        events: 0,
        chapters: 0,
      };
  }
}

/**
 * Resolve the effective per-domain budget for an intent: the minimum of the
 * intent cap and the global default. Domains not in the retrieval plan get 0.
 */
export function resolveBudgets(intent: CompanionIntent, plan: RetrievalPlan): IntentBudget {
  const cap = budgetFor(intent);
  const g = GLOBAL_DEFAULT_BUDGETS;
  return {
    recentConversationTurns: plan.conversation
      ? Math.min(cap.recentConversationTurns, g.recentConversationTurns)
      : 0,
    companionMemories: plan.companionMemories
      ? Math.min(cap.companionMemories, g.companionMemories)
      : 0,
    memories: plan.memories ? Math.min(cap.memories, g.memories) : 0,
    reflections: plan.reflections ? Math.min(cap.reflections, g.reflections) : 0,
    patterns: plan.patterns ? Math.min(cap.patterns, g.patterns) : 0,
    events: plan.events ? Math.min(cap.events, g.events) : 0,
    chapters: plan.chapters ? Math.min(cap.chapters, g.chapters) : 0,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Produce the orchestration policy for a user message. Pure: no I/O.
 *
 * If an explicit current user instruction conflicts with a stored Companion
 * Memory, the CURRENT user message wins for this turn (exposed via
 * `currentUserInstruction = "highest_priority"`). The stored memory is not
 * updated.
 */
export function orchestrate(message: string): CompanionOrchestratorPolicy {
  const { intent, reason } = classifyIntent(message);
  const capability = CAPABILITY_MAP[intent];
  const retrievalPlan = retrievalPlanFor(intent);
  const budgets = resolveBudgets(intent, retrievalPlan);
  const priority = PRIORITY_MAP[intent];

  return {
    intent,
    capability,
    retrievalPlan,
    budgets,
    // The existing Significant Interaction gate always runs after the turn for
    // memory_creation intents (and is harmless to run otherwise — it is a cheap
    // deterministic gate). We keep it enabled for every intent so the existing
    // flow is preserved.
    shouldAnalyzeSignificance: true,
    priority,
    reason,
    currentUserInstruction: "highest_priority",
    identifiedMemoryId: null,
  };
}
