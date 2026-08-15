/**
 * Companion Opening — a calm, non-presumptuous opener for a new conversation.
 *
 * PURE MODULE. No network, no provider, no Supabase. Deterministic and
 * variation-safe: the same conversation id always yields the same opener, so
 * the UI is stable across reloads. No random biography is ever injected.
 *
 * Design rules (from the Companion Experience v1 spec):
 *   - calm, personal, context-aware
 *   - does NOT always use the same generic greeting when it can be grounded
 *   - must NOT pretend to know something not supplied
 *   - must NOT inject random biography
 *
 * Grounding: the opener can only mention the user's life in sound in the
 * abstract (the product domain). It never names a specific memory, song,
 * pattern, or date unless the caller explicitly supplies a grounded hint
 * (e.g. the user has at least one recorded memory). When no grounded hint is
 * available, the opener stays general.
 */

/**
 * Optional grounded hints for the opener. All fields default to false/empty so
 * the opener never pretends to know something it does not. The caller supplies
 * these from already-loaded, ownership-verified data only.
 */
export type CompanionOpeningHints = {
  /** The user has at least one recorded music memory. */
  hasMemories?: boolean;
  /** The user has at least one life chapter. */
  hasChapters?: boolean;
  /** The user has at least one detected pattern. */
  hasPatterns?: boolean;
};

/**
 * A small, curated set of calm openers. None assumes any specific fact about
 * the user. Variation is selected deterministically from the conversation id
 * so reloads are stable and there is no "AI random" surprise.
 *
 * These are intentionally domain-framed ("your soundtrack", "life in sound")
 * rather than generic chatbot greetings.
 */
const OPENERS_GENERAL: string[] = [
  "What would you like to revisit?",
  "What part of your soundtrack is on your mind today?",
  "We can talk about a memory, a song, a pattern, or simply whatever is on your mind.",
  "I'm here. Where would you like to begin?",
  "Take your time — what's on your mind?",
];

const OPENERS_WITH_MEMORIES: string[] = [
  "What would you like to revisit? A memory, a song, or whatever is on your mind.",
  "What part of your soundtrack is on your mind today? We can revisit a memory, or just talk.",
  "We can revisit one of your memories, look at a pattern, or simply talk. You choose.",
  "I'm here. Would you like to revisit a memory, or start somewhere else?",
];

const OPENERS_WITH_CHAPTERS: string[] = [
  "What would you like to revisit? A chapter, a memory, or whatever is on your mind.",
  "We can revisit a chapter, a memory, or just talk. Where would you like to begin?",
];

const OPENERS_WITH_PATTERNS: string[] = [
  "We can revisit a memory, talk about a pattern, or simply whatever is on your mind.",
  "What part of your soundtrack is on your mind today? A memory, a pattern, or something else.",
];

/**
 * Deterministic 32-bit hash (FNV-1a) of a string → non-negative integer. Used
 * for stable, reproducible opener selection from the conversation id.
 */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pick(list: string[], seed: string): string {
  if (list.length === 0) return OPENERS_GENERAL[0];
  return list[fnv1a(seed) % list.length];
}

/**
 * Produce a calm opening line for a conversation. Deterministic given the
 * conversation id and the grounded hints. Never injects biography.
 *
 * @param conversationId stable seed for variation (reload-safe)
 * @param hints optional, ownership-verified grounded hints (default: none)
 */
export function companionOpening(
  conversationId: string,
  hints: CompanionOpeningHints = {},
): string {
  const seed = conversationId || "default";
  const { hasMemories, hasChapters, hasPatterns } = hints;

  // Most specific grounding first: patterns imply memories; chapters imply
  // memories too. Prefer the most contextualised opener available, but always
  // fall back to a calm general opener.
  if (hasMemories && hasPatterns) return pick(OPENERS_WITH_PATTERNS, seed);
  if (hasMemories && hasChapters) return pick(OPENERS_WITH_CHAPTERS, seed);
  if (hasMemories) return pick(OPENERS_WITH_MEMORIES, seed);
  return pick(OPENERS_GENERAL, seed);
}
