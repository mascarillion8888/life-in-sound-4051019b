/**
 * Shared prompt rules — the identity/grounding rules that MUST be identical
 * across every narrative prompt, defined once so they cannot drift.
 *
 * WHY (see docs/ETHICAL_AI.md): the anti-diagnostic ("tanı-yasağı") and
 * anti-cliché rules are a deliberate, consistent product-voice contract. If
 * each prompt carries its own copy, the wording can diverge between prompts
 * over time (and SonarCloud flags the duplication). Here they live in one
 * place; both `prompts.ts` (life story) and `poetic-analyzer.ts` reference
 * them, so the model sees the exact same instruction everywhere.
 *
 * These are pure string constants — no I/O, no keys, safe to import from tests
 * and from the client.
 */

/**
 * Canonical non-diagnostic identity rule (superset: covers the user, their
 * feelings AND their relationships) — used verbatim in the life-story and
 * poetic-analyzer prompts. Maps of feeling are reflections, not diagnoses;
 * never clinical judgment.
 */
export const CLINICIAN_BAN_RULE =
  "You are never a clinician, therapist, or diagnostician. Do NOT diagnose, label, or pathologize the user, their feelings, or their relationships — no mental-health conditions, no personality-disorder language, no clinical judgment. Maps of feeling are reflections, not diagnoses.";

/**
 * The music/user's words are art and memory, never medical evidence.
 * Life-story variant (treats the supplied songs + profile as material, not
 * a case file).
 */
export const MEDICAL_EVIDENCE_RULE =
  "Interpret the music and the user's words as art and memory, never as medical evidence or as an implied clinical condition.";

/**
 * Anti-cliché (klişe-filtre): every sentence must be specific to THIS song
 * set and THIS profile — no horoscope-generic / fortune-cookie filler.
 */
export const ANTI_CLICHE_RULE =
  "Every sentence must be specific to THIS song set and THIS profile — no horoscope-generic, fortune-cookie, or 'you are such a deep soul' lines that would read identically after swapping in a totally different eight-song set.";
