/**
 * Companion capability dispatch — turns an orchestration policy into a concrete
 * ONE-CALL execution plan (role + prompt + temperature + maxTokens).
 *
 * PURE MODULE. No fetch, no Orchestra, no provider. It reuses existing PURE
 * prompt builders (buildCompanionPrompt, buildReflectionPrompt) and a thin
 * story-from-context adapter. Each capability maps to exactly ONE runRole call;
 * no capability calls multiple roles. Provider/model selection stays inside the
 * existing Orchestra bridge (src/lib/llm/orchestra.ts) — this module never
 * references provider endpoints or keys.
 *
 * DO NOT make this a giant agent framework. It is a small mapping/dispatch.
 */
import type { OrchestraRole } from "@/lib/llm/orchestra";
import {
  buildCompanionPrompt,
  type CompanionConversationInput,
} from "@/lib/llm/companionConversation";
import { buildReflectionPrompt } from "@/lib/llm/reflectOnMemory";
import type { CompanionContextItem } from "@/lib/memory/companionRetrieval";
import type { CompanionTurn, Memory, Reflection } from "@/lib/memory/types";
import type { CompanionCapability, CompanionIntent } from "@/lib/llm/companionOrchestrator";

// ---------------------------------------------------------------------------
// Capability plan
// ---------------------------------------------------------------------------

/**
 * A single capability's execution plan. The server calls `runRole(plan.role,
 * plan.prompt, { temperature, maxTokens })` exactly once per turn.
 */
export type CapabilityPlan = {
  kind: CompanionCapability;
  /** The Orchestra role to call (existing roles only — no new provider roles). */
  role: OrchestraRole;
  prompt: string;
  temperature: number;
  maxTokens: number;
  /**
   * Whether a deterministic fallback is available if the LLM returns null.
   * - chat/grounded_recall/... → fallback = null (no fabrication; the user turn
   *   remains saved and the conversation surfaces no assistant turn, matching
   *   existing behaviour).
   * - story → deterministic fallback may return null here too (the full
   *   deterministic Life Story template belongs to the Results page
   *   generateStory capability, which we do not modify).
   */
  hasDeterministicFallback: boolean;
};

export type CapabilityContext = {
  /** The current user message. */
  message: string;
  /** Recent conversation turns (chronological), NOT including the new user turn. */
  recentTurns: CompanionTurn[];
  /** The bounded, trust-labelled retrieved context for this intent. */
  retrievedContext: CompanionContextItem[];
  /**
   * The single identified Memory (if any) — used by the reflection capability.
   * Null when no single memory is identified.
   */
  identifiedMemory?: Memory | null;
  /** Prior reflections for the identified memory (reflection capability). */
  priorReflections?: Reflection[];
  /** Legacy caller-supplied context slices (preserved for backward compat). */
  contextSlices?: CompanionConversationInput["contextSlices"];
};

// ---------------------------------------------------------------------------
// Story-from-context adapter (thin; does not modify src/lib/ai/*)
// ---------------------------------------------------------------------------

const STORY_GROUNDING_RULES = [
  "Use ONLY the facts present in the supplied retrieved context. Do not invent facts.",
  "Do not invent people, places, dates, weather, events, song titles, or artists absent from the supplied context.",
  "Do not claim knowledge about the user's psychology, mental health, or diagnosis.",
  "Frame interpretations as interpretations, never as facts. Use uncertainty language for anything beyond a supplied fact.",
  "Preserve provenance: a memory/event/chapter is a USER FACT (the user's own record); a pattern interpretation or companion reflection is AI INTERPRETATION; never present an interpretation as a fact.",
  "If the supplied context is empty or insufficient, say honestly that you don't have enough to tell that story yet.",
];

/**
 * Build a story-from-context prompt from the bounded retrieved context only.
 * This is a THIN adapter around the existing capability: instead of sending the
 * user's entire history, the Story Engine receives only the selected relevant
 * evidence. It does NOT modify the deterministic AI pipeline or src/lib/ai/*.
 */
function buildStoryFromContextPrompt(
  message: string,
  recentTurns: CompanionTurn[],
  retrievedContext: CompanionContextItem[],
): string {
  const transcript = recentTurns
    .map((t) => `${t.role === "user" ? "User" : "Companion"}: ${t.content}`)
    .join("\n");

  const ctxBlock =
    retrievedContext.length === 0
      ? "(none)"
      : retrievedContext
          .map(
            (it) =>
              `- [${it.trustLevel}] ${it.sourceType} (relevance ${it.relevance.toFixed(2)}): ${it.content}`,
          )
          .join("\n");

  const rules = STORY_GROUNDING_RULES.map((r, i) => `${i + 1}. ${r}`).join("\n");

  return [
    "You are the narrative voice of the Companion in Life in a Sound.",
    "The user has asked you to tell a story from their life in sound.",
    "",
    "USER REQUEST:",
    message,
    "",
    "CONVERSATION SO FAR:",
    transcript || "(no prior turns)",
    "",
    "RETRIEVED CONTEXT (bounded, trust-labelled evidence only):",
    ctxBlock,
    "",
    "RULES:",
    rules,
    "",
    "TASK:",
    "Write a short, warm story (2-4 short paragraphs) grounded ONLY in the supplied retrieved context. Weave the supplied memories, events, chapters, and patterns together naturally. If a piece of context is an AI interpretation, present it as interpretation, not fact. If the context is insufficient, say so honestly rather than inventing.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Reflection plan (reuse the existing PURE reflection prompt builder)
// ---------------------------------------------------------------------------

function buildReflectionCapabilityPlan(ctx: CapabilityContext): CapabilityPlan {
  if (ctx.identifiedMemory) {
    // Reuse the existing PURE reflection prompt builder — same grounding rules.
    const prompt = buildReflectionPrompt({
      memory: ctx.identifiedMemory,
      priorReflections: ctx.priorReflections ?? [],
    });
    return {
      kind: "reflection",
      role: "summarizer",
      prompt,
      temperature: 0.7,
      maxTokens: 400,
      hasDeterministicFallback: false,
    };
  }
  // No single memory identified → fall back to grounded chat with the
  // retrieved memory context, so the user still gets a grounded reflection
  // prompt rather than a fabricated one.
  const prompt = buildCompanionPrompt({
    recentTurns: ctx.recentTurns,
    retrievedContext: ctx.retrievedContext.length > 0 ? ctx.retrievedContext : undefined,
    contextSlices: ctx.contextSlices,
  });
  return {
    kind: "chat",
    role: "orchestrator",
    prompt,
    temperature: 0.7,
    maxTokens: 500,
    hasDeterministicFallback: false,
  };
}

// ---------------------------------------------------------------------------
// Capability dispatch
// ---------------------------------------------------------------------------

/**
 * Map an intent to a concrete capability plan. Pure: no I/O.
 *
 * Guarantees:
 *   - Exactly ONE runRole call per turn (no capability calls multiple roles).
 *   - chat/grounded_recall/companion_memory_recall/pattern_exploration/
 *     event_chapter_recall/memory_creation all use the existing grounded
 *     Companion prompt (orchestrator role) with the bounded retrieved context.
 *   - reflection uses the existing reflection prompt (summarizer) when a single
 *     memory is identified; otherwise grounded chat.
 *   - story uses the thin story-from-context adapter (summarizer) with the
 *     bounded retrieved context only — never the whole history.
 */
export function planCapability(intent: CompanionIntent, ctx: CapabilityContext): CapabilityPlan {
  switch (intent) {
    case "chat":
    case "unknown": {
      // Conversation only — no retrieved context for ordinary chat.
      const prompt = buildCompanionPrompt({
        recentTurns: ctx.recentTurns,
        contextSlices: ctx.contextSlices,
      });
      return {
        kind: "chat",
        role: "orchestrator",
        prompt,
        temperature: 0.7,
        maxTokens: 500,
        hasDeterministicFallback: false,
      };
    }

    case "memory_recall":
    case "companion_memory_recall":
    case "pattern_exploration":
    case "event_chapter_recall":
    case "memory_creation": {
      // Grounded recall: existing grounded Companion prompt with the bounded
      // trust-labelled retrieved context. Pattern interpretations already in
      // the retrieved context are surfaced for free (no regeneration).
      const prompt = buildCompanionPrompt({
        recentTurns: ctx.recentTurns,
        retrievedContext: ctx.retrievedContext.length > 0 ? ctx.retrievedContext : undefined,
        contextSlices: ctx.contextSlices,
      });
      return {
        kind:
          intent === "companion_memory_recall"
            ? "companion_memory_recall"
            : intent === "pattern_exploration"
              ? "pattern_exploration"
              : intent === "event_chapter_recall"
                ? "event_chapter_recall"
                : intent === "memory_creation"
                  ? "memory_creation"
                  : "grounded_recall",
        role: "orchestrator",
        prompt,
        temperature: 0.7,
        maxTokens: 500,
        hasDeterministicFallback: false,
      };
    }

    case "reflection": {
      return buildReflectionCapabilityPlan(ctx);
    }

    case "story_request": {
      const prompt = buildStoryFromContextPrompt(
        ctx.message,
        ctx.recentTurns,
        ctx.retrievedContext,
      );
      return {
        kind: "story",
        role: "summarizer",
        prompt,
        temperature: 0.7,
        maxTokens: 900,
        hasDeterministicFallback: false,
      };
    }
  }
}
