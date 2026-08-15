/**
 * Pattern interpretation — grounded prompt contract + types.
 *
 * The Orchestra turns deterministic evidence into a careful human-readable
 * interpretation. It is advisory and NEVER becomes a user fact.
 *
 * Flow:
 *   PATTERN (deterministic evidence)
 *       ↓
 *   SERVER-SIDE ORCHESTRA (interpretPattern.server.ts)
 *       ↓
 *   INTERPRETATION (string | null)
 *       ↓
 *   USER REVIEWS → interpretation stored ONLY in patterns.interpretation
 *
 * The AI must NEVER modify memories, reflections, music_experiences, or
 * pattern evidence. Its output lands only in the interpretation_* fields.
 *
 * This module is pure string construction — no network, no keys, safe to
 * import from tests and from the client (no I/O, no secrets).
 */
import type { Pattern, PatternRelatedMemory } from "@/lib/memory/types";

export type InterpretPatternInput = {
  pattern: Pick<
    Pattern,
    "patternType" | "title" | "summary" | "evidenceCount" | "observedFrom" | "observedTo"
  >;
  /** Related memory excerpts — only evidence memories, owned by the user. */
  relatedMemories: Pick<PatternRelatedMemory, "title" | "excerpt" | "eventTimeLabel">[];
};

export type InterpretPatternOutput = {
  interpretation: string | null;
};

export const INTERPRETATION_PROMPT_VERSION = "pattern-interpret-v1";

const GROUNDING_RULES = [
  "Turn the supplied deterministic evidence into a careful, human-readable interpretation.",
  "Use ONLY the facts present in the supplied evidence. Do not invent facts.",
  "Do not invent dates, places, people, song titles, artists, weather, or events absent from the supplied evidence.",
  "Do not diagnose. Do not infer psychology, mental health, trauma, or relationships.",
  "Do not claim certainty beyond the evidence.",
  "Never say 'this proves that you are...'.",
  "Prefer: 'Your recorded memories show...', 'One possible interpretation is...', 'This may suggest...'.",
  "Explicitly frame the output as an interpretation, not a fact.",
  "Keep it concise: 2-3 sentences.",
  "Write a single short paragraph. No JSON, no markdown headings, no bullet lists.",
];

export function buildInterpretPatternPrompt(input: InterpretPatternInput): string {
  const rulesBlock = GROUNDING_RULES.map((r, i) => `${i + 1}. ${r}`).join("\n");

  const lines: string[] = [
    "You are the Companion of Life in a Sound, offering a careful interpretation of a pattern in the user's recorded memories.",
    "Your interpretation is advisory only.",
    "",
    "RULES:",
    rulesBlock,
    "",
    "PATTERN:",
    `type: ${input.pattern.patternType}`,
    `title: ${input.pattern.title}`,
    `deterministic summary: ${input.pattern.summary}`,
    `evidence count: ${input.pattern.evidenceCount}`,
  ];
  if (input.pattern.observedFrom || input.pattern.observedTo) {
    lines.push(
      `observed range: ${input.pattern.observedFrom ?? "?"} to ${input.pattern.observedTo ?? "?"}`,
    );
  }
  lines.push("");

  const memBlocks = input.relatedMemories
    .map((m, i) => {
      const parts = [`MEMORY ${i + 1}:`, `title: ${m.title}`];
      if (m.excerpt) parts.push(`excerpt: ${m.excerpt}`);
      if (m.eventTimeLabel) parts.push(`when: ${m.eventTimeLabel}`);
      return parts.join("\n");
    })
    .join("\n\n");

  if (memBlocks) {
    lines.push("EVIDENCE MEMORIES:");
    lines.push(memBlocks);
  }

  lines.push("");
  lines.push("OUTPUT: a single short paragraph (2-3 sentences) interpreting the pattern.");

  return lines.join("\n");
}

/**
 * Parse the LLM's interpretation response. Returns null on empty/malformed
 * output. The interpretation is free-form prose, so we only require a
 * non-empty trimmed string of reasonable length. Never throws.
 */
export function parseInterpretPatternResponse(response: string): string | null {
  if (typeof response !== "string" || response.trim().length === 0) return null;
  const trimmed = response.trim();
  // Guard against the model echoing JSON or code fences instead of prose.
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return null;
  if (trimmed.startsWith("```")) return null;
  // Reasonable length cap.
  if (trimmed.length > 1000) return trimmed.slice(0, 1000).trimEnd();
  return trimmed;
}
