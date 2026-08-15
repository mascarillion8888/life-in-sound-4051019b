/**
 * Deterministic candidate gate — a CHEAP, pure filter that runs BEFORE the
 * Orchestra significance classifier.
 *
 * COST PRINCIPLE:
 *   Do NOT call the LLM for every conversation turn. First run this cheap
 *   deterministic gate. Only potentially significant turns reach the
 *   Orchestra. A greeting, a "thanks", a short factual one-off question, or
 *   casual small talk must NOT trigger an LLM call.
 *
 * WHAT THIS GATE DOES:
 *   It scans a USER turn for explicit phrase patterns that strongly signal a
 *   durable, user-expressed preference / boundary / directive / confirmed
 *   context / decision. It returns `{ shouldAnalyze, signals }`.
 *
 * WHAT THIS GATE DOES NOT DO:
 *   - It does NOT decide that something is a fact. It only decides whether the
 *     turn is worth SENDING to a significance classifier.
 *   - It does NOT infer significance from sentiment, emotion, or behavior.
 *   - It does NOT persist anything.
 *   - It makes NO network calls (no fetch, no Orchestra, no Supabase).
 *   - It does NOT classify assistant turns. The caller must only pass USER
 *     turns; the gate additionally returns shouldAnalyze=false for non-user
 *     turns as a defense-in-depth.
 *
 * CONSERVATISM:
 *   False negatives are acceptable (we may miss a memorable statement).
 *   False positives are acceptable only insofar as they trigger an extra
 *   classification call — they MUST NOT create persistence automatically
 *   (the classifier decides, and even a confirmed candidate needs the user).
 */
import type { CompanionTurn } from "@/lib/memory/types";

/**
 * Explicit phrase patterns that strongly signal a durable, user-expressed
 * statement. Matched case-insensitively as substrings against the normalized
 * turn content. Curated to be intentionally conservative.
 */
const SIGNAL_PATTERNS: readonly string[] = [
  "remember this",
  "remember that",
  "remember me as",
  "from now on",
  "please don't",
  "don't ever",
  "i prefer",
  "i always want",
  "i want you to know",
  "keep in mind",
  "for future conversations",
  "next time",
  "call me",
  "speak to me",
  "talk to me",
  "i don't like when",
  "i do like when",
];

/**
 * The deterministic gate result.
 */
export type SignificanceGateResult = {
  /** Whether the turn should be sent to the Orchestra significance classifier. */
  shouldAnalyze: boolean;
  /** The signal phrases that matched (empty when shouldAnalyze is false). */
  signals: string[];
};

/**
 * Normalize content for matching: lowercase + collapse whitespace. Preserves
 * the original for display; only used for substring detection.
 */
function normalize(content: string): string {
  return content.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Cheap deterministic candidate gate. Pure: no I/O, no side effects, never
 * throws. Only USER turns can be candidates; a non-user turn returns
 * shouldAnalyze=false (defense-in-depth, since the caller must also enforce
 * role === 'user' before calling).
 *
 * Very short turns (<= 3 chars after normalization) are rejected as greetings
 * / noise — they cannot carry a durable statement.
 */
export function evaluateSignificanceGate(
  turn: Pick<CompanionTurn, "role" | "content">,
): SignificanceGateResult {
  // Only USER turns may be candidates. Assistant/system turns are never
  // classified as user memory candidates.
  if (turn.role !== "user") {
    return { shouldAnalyze: false, signals: [] };
  }

  const normalized = normalize(turn.content);
  if (normalized.length <= 3) {
    return { shouldAnalyze: false, signals: [] };
  }

  const signals: string[] = [];
  for (const pattern of SIGNAL_PATTERNS) {
    if (normalized.includes(pattern)) {
      signals.push(pattern);
    }
  }

  return { shouldAnalyze: signals.length > 0, signals };
}

/** Exposed for tests/inspection. Not used at runtime by the gate logic. */
export const GATE_SIGNAL_COUNT = SIGNAL_PATTERNS.length;
