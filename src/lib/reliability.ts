/**
 * Reliability / failure UX — user-safe fallback language.
 *
 * The product must never show raw "500 Internal Server Error" or stack traces
 * to a beta user. These are the canonical, human-readable messages for each
 * failure mode. Centralising them here keeps the language consistent across
 * routes and lets tests assert the exact strings without scraping JSX.
 *
 * Guarantees:
 *   - Every message is calm, non-technical, and reassures the user that their
 *     own data is safe where applicable.
 *   - Persistence failures are NEVER shown as success. A failed save surfaces
 *     a clear "could not save" message; a successful save surfaces a clear
 *     "saved" confirmation. The two never share a string.
 *   - None of these strings contain credentials, stack traces, or provider
 *     error bodies.
 */

export const ReliabilityMessage = {
  /** Companion provider unavailable / timeout / malformed output. */
  companionUnavailable:
    "I couldn't reach the Companion just now. Your message is still here — try again in a moment.",
  /** Conversation persistence failed (could not save the user turn). */
  companionPersistenceFailed:
    "I couldn't save your message. It's still in the box — please try again.",
  /** Retrieval failure (contained; conversation continues). */
  retrievalFailed: "I had trouble looking things up just now. I'll answer from what I have here.",
  /** Memory persistence failed. */
  memorySaveFailed:
    "I couldn't save your memory. Please check your connection and try again — nothing was lost.",
  /** Memory extraction (AI) failed — graceful manual fallback. */
  memoryExtractionFailed:
    "We couldn't structure your memory automatically. You can fill in the details manually below — your note is preserved.",
  /** Reflection provider failure. */
  reflectionFailed:
    "I couldn't write a reflection just now. Your memory is safe — you can try again later.",
  /** Connection suggestion/persistence failure. */
  connectionFailed: "I couldn't save that connection. Please try again in a moment.",
  /** Pattern interpretation failure. */
  patternFailed: "I couldn't interpret that pattern just now. The evidence is still saved.",
  /** Story generation failure — deterministic fallback used. */
  storyFallback:
    "The full story isn't available right now, so here's a summary from your songs instead.",
  /** Storage / media upload failure. */
  mediaUploadFailed: "I couldn't upload that file. Please try again — your other changes are safe.",
  /** Generic catch-all for an unexpected error (never shows status codes). */
  unexpected: "Something went wrong on our side. Your work is safe — please try again in a moment.",
} as const;

export type ReliabilityKey = keyof typeof ReliabilityMessage;

/**
 * Returns true if the given user-facing string is one of the canonical
 * reliability messages (i.e. NOT a raw error/status code). Used by tests to
 * confirm routes never leak technical errors.
 */
export function isUserSafeMessage(text: string): boolean {
  return Object.values(ReliabilityMessage).some((m) => text.includes(m));
}

/**
 * Returns true if a string looks like a raw technical error that must never be
 * shown to a beta user (HTTP status codes, stack traces, provider error
 * bodies, exception class names).
 */
export function looksLikeTechnicalError(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  if (/\binternal server error\b/.test(t)) return true;
  if (/\b\d{3}\b/.test(text) && /\berror\b/.test(t)) return true;
  if (/stack trace|at \/.+:\d+:\d+/.test(text)) return true;
  if (/exception|traceback|errno|econnrefused|econnreset|undefined is not/.test(t)) return true;
  if (/api[_ ]?key|token|secret|unauthorized|forbidden/.test(t)) return true;
  return false;
}
