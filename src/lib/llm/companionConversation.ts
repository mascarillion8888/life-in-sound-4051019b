/**
 * Companion Conversation prompt construction.
 *
 * Pure functions (no network, no provider). The server function uses these to
 * build a grounded prompt from recent conversation turns + retrieved bounded
 * context.
 *
 * CONTEXT BOUNDARY (v1):
 *   - recent turns from the current conversation (loadRecentTurns)
 *   - the current user message
 *   - retrieved bounded context: CompanionContextItem[] from the deterministic
 *     retrieval planner (trust-labelled, deduplicated, hard-limited). Never the
 *     entire user database. No semantic retrieval / embeddings.
 *
 * This module emits plain text; it does NOT call the provider.
 */
import type { CompanionContextItem, TrustLevel } from "@/lib/memory/companionRetrieval";
import type { CompanionTurn as CompanionTurnType } from "@/lib/memory/types";

export type CompanionContextSlice = {
  /** Human label for the slice, e.g. "Memory: Summer of 2004". */
  label: string;
  /** Pre-formatted text body. */
  body: string;
};

export type CompanionConversationInput = {
  /** Recent turns (chronological), NOT including the turn just persisted. */
  recentTurns: CompanionTurnType[];
  /**
   * Retrieved bounded context items (trust-labelled). When present these
   * REPLACE the caller-supplied contextSlices and are rendered with explicit
   * trust labels + grounding rules.
   */
  retrievedContext?: CompanionContextItem[];
  /** Optional explicitly-relevant domain context slices (legacy path). */
  contextSlices?: CompanionContextSlice[];
};

const TRUST_LABEL: Record<TrustLevel, string> = {
  USER_FACT: "USER FACT (authoritative — the user supplied this)",
  COMPANION_MEMORY: "COMPANION MEMORY (user-approved continuity instruction/context)",
  CONVERSATION_CONTEXT: "CONVERSATION CONTEXT (temporary — from recent turns)",
  DERIVED_PATTERN: "DERIVED PATTERN (computed from user facts; not itself a fact)",
  AI_INTERPRETATION: "AI INTERPRETATION (not a fact — never present as fact)",
};

/**
 * Render the conversation as a transcript for the prompt. Content is included
 * verbatim — no rewriting or summarizing of historical turns.
 */
function renderTranscript(turns: CompanionTurnType[]): string {
  if (turns.length === 0) return "(no prior turns)";
  return turns
    .map((t) => {
      const speaker = t.role === "user" ? "User" : t.role === "assistant" ? "Companion" : "System";
      return `${speaker}: ${t.content}`;
    })
    .join("\n");
}

function renderSlices(slices: CompanionContextSlice[] | undefined): string {
  if (!slices || slices.length === 0) return "";
  return slices.map((s) => `### ${s.label}\n${s.body}`).join("\n\n");
}

function renderRetrievedContext(items: CompanionContextItem[] | undefined): string {
  if (!items || items.length === 0) return "";
  const blocks = items.map((it, idx) => {
    const trust = TRUST_LABEL[it.trustLevel];
    return `#### ${idx + 1}. ${it.sourceType} (id: ${it.sourceId})
Trust: ${trust}
Relevance: ${it.relevance.toFixed(2)} — ${it.reason}
Content: ${it.content}`;
  });
  return blocks.join("\n\n");
}

const GROUNDING_RULES = [
  "GROUNDING RULES (strict):",
  "- User facts (USER FACT) are authoritative. They override any AI interpretation.",
  "- Companion Memories are user-approved continuity instructions/context. They are NOT facts about the user's life, and they must NOT override the current explicit user message for this turn.",
  "- Patterns are derived observations. Pattern interpretation is NOT a fact — label it as interpretation, never 'The user is...'.",
  "- AI interpretations are never facts. Do not treat them as truth.",
  "- Conversation context is temporary. Do not treat prior turns as durable memory.",
  "- Do NOT invent facts: no people, places, dates, weather, events, songs, artists, memories, or relationships not present in the supplied context.",
  "- Do NOT pretend to remember information that is not present in the supplied context. If you do not know, say so.",
  "- If two sources conflict, do NOT silently choose an AI interpretation. Prefer the explicit user fact and, when necessary, acknowledge the uncertainty.",
].join("\n");

/**
 * Response style policy for the Companion voice. Calm, personal, concise,
 * non-presumptuous, transparent about memory. These are behavioural rules the
 * model must follow; they do not change grounding or trust.
 */
const RESPONSE_STYLE = [
  "RESPONSE STYLE (calm, concise, grounded):",
  "- Answer the user's actual question first, before any context.",
  "- Be concise by default. Short turns are better than long ones. Go deeper only when the user asks.",
  "- Use retrieved context ONLY when it is relevant to this turn. Do not dump database facts.",
  "- Never mention internal retrieval mechanics, intents, or 'context'. The user should not see how the sausage is made.",
  "- Do not call everything a 'memory'. Distinguish what kind of thing it is (see MEMORY LANGUAGE below).",
  "- Avoid repeating 'I remember…' or other filler. Vary your phrasing.",
  "- Never overclaim. Use uncertainty language ('seems', 'appears', 'may') for anything beyond a supplied fact.",
  "- Never use therapeutic, diagnostic, or medical language. You are a thoughtful friend, not a clinician.",
  "- Never invent personal biography. If the supplied context does not contain it, say you don't have it.",
].join("\n");

/**
 * Memory language — how the Companion refers to each trust layer. These map
 * directly to the canonical data layers (SOURCE/USER FACT, COMPANION MEMORY,
 * DERIVED PATTERN, AI INTERPRETATION) so provenance is preserved in prose.
 */
const MEMORY_LANGUAGE = [
  "MEMORY LANGUAGE (preserve provenance in how you refer to things):",
  "- USER FACT (a memory, event, chapter, or your own reflection): refer to it as the user's own record, e.g. 'Your 2004 memory mentions…' or 'Your university chapter notes…'. Do not say 'I remember' about a user fact.",
  "- COMPANION MEMORY (something you were asked to remember): refer to it as something the user asked you to remember, e.g. 'You asked me to remember that you prefer a calm tone.' Never present it as an observed fact about the user's life.",
  "- DERIVED PATTERN (a recurring structure across memories): refer to it as a pattern in the user's recorded memories, e.g. 'One pattern in your recorded memories is…' Never present pattern evidence as a user fact.",
  "- AI INTERPRETATION (a pattern interpretation, a companion-authored reflection, a story): refer to it as an interpretation, e.g. 'One possible interpretation is…' Never present it as fact.",
].join("\n");

const CURRENT_MESSAGE_WINS = [
  "CURRENT MESSAGE WINS (for this turn only):",
  "- The user's current explicit instruction always wins for THIS turn, even if a stored Companion Memory preference says otherwise.",
  "- If the current message conflicts with a standing preference, follow the current message now. Do NOT claim the stored preference changed. Do NOT mention that you are overriding anything unless the user asks.",
  "- The stored preference is not modified. It remains standing for future turns.",
].join("\n");

/**
 * Build the user-message prompt for the orchestrator role. The system prompt
 * is supplied by the Orchestra role mapping (orchestrator).
 */
export function buildCompanionPrompt(input: CompanionConversationInput): string {
  const transcript = renderTranscript(input.recentTurns);
  const retrieved = renderRetrievedContext(input.retrievedContext);
  const slices = renderSlices(input.contextSlices);

  const sections: string[] = [
    "You are the Companion in a calm, reflective conversation about the user's life in sound.",
    "Use the conversation history below. Be warm, concise, and grounded in what the user has shared.",
    "Do not invent memories. If you do not know, say so.",
    "",
    GROUNDING_RULES,
    "",
    RESPONSE_STYLE,
    "",
    MEMORY_LANGUAGE,
    "",
    CURRENT_MESSAGE_WINS,
    "",
    `Conversation so far:\n${transcript}`,
  ];

  if (retrieved) {
    sections.push("", `Retrieved context (trust-labelled, bounded):\n${retrieved}`);
  } else if (slices) {
    sections.push("", `Relevant context from the user's records:\n${slices}`);
  }

  sections.push("", "Respond as the Companion.");
  return sections.join("\n");
}
