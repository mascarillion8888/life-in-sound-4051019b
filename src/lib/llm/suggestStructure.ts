/**
 * AI structure suggestion — grounded prompt contract + types.
 *
 * The Orchestra may SUGGEST a life Event or Chapter grouping from existing
 * deterministic evidence (patterns + memories). It is advisory and NEVER
 * becomes a personal fact. The user must explicitly Accept to create an owned
 * Event/Chapter; Dismiss creates nothing.
 *
 * Flow:
 *   SELECTED EVIDENCE (patterns + memory summaries + known dates/locations/music)
 *       ↓
 *   SERVER-SIDE ORCHESTRA (suggestStructure.server.ts)
 *       ↓
 *   SUGGESTION (StructureSuggestion | null)
 *       ↓
 *   USER REVIEWS → [Accept] creates owned Event/Chapter + attaches evidence
 *                       [Dismiss] creates nothing
 *
 * The AI must NEVER: create Event/Chapter automatically, invent life events,
 * relationships, people, dates, locations, or emotions absent from supplied
 * evidence, or turn an interpretation into a fact.
 *
 * This module is pure string construction — no network, no keys, safe to import
 * from tests and from the client (no I/O, no secrets).
 */
import type { StructureSuggestion } from "@/lib/memory/types";

export type SuggestStructureInput = {
  /** Deterministic pattern summaries for grounding. */
  patterns: Array<{
    patternType: string;
    title: string;
    summary: string;
    evidenceCount: number;
  }>;
  /** Selected memory summaries — only owned evidence. */
  memories: Array<{
    memoryId: string;
    title: string;
    excerpt: string;
    eventTimeLabel: string | null;
    location: string | null;
  }>;
  /** What kind of structure to suggest. */
  kind: "event" | "chapter";
};

export type SuggestStructureOutput = {
  suggestion: StructureSuggestion | null;
};

export const STRUCTURE_PROMPT_VERSION = "life-structure-v1";

const GROUNDING_RULES = [
  "Suggest ONE life " + "event or chapter grouping grounded ONLY in the supplied evidence.",
  "Use ONLY the facts present in the supplied memories and patterns. Do not invent facts.",
  "Do not invent dates, places, people, song titles, artists, weather, or events absent from the supplied evidence.",
  "Do not diagnose. Do not infer psychology, mental health, trauma, or relationships.",
  "Do not claim certainty beyond the evidence.",
  "Frame the suggestion as a possibility, not a fact. Prefer 'These memories may belong to...'.",
  "The title must be a short period or theme label (e.g. 'University Years'), not a diagnostic statement.",
  'Output strict JSON only: {"title": string, "description": string|null, "timeLabel": string|null, "memoryIds": string[]}.',
  "memoryIds MUST be a subset of the supplied memory ids. Never invent ids.",
  'If the evidence is insufficient or unclear, output: {"title": ""}',
];

export function buildSuggestStructurePrompt(input: SuggestStructureInput): string {
  const rulesBlock = GROUNDING_RULES.map((r, i) => `${i + 1}. ${r}`).join("\n");

  const lines: string[] = [
    "You are the Companion of Life in a Sound, suggesting a possible life structure grouping from the user's recorded memories.",
    "Your suggestion is advisory only and will never be saved without the user's explicit acceptance.",
    "",
    "RULES:",
    rulesBlock,
    "",
    `SUGGEST A: ${input.kind}`,
  ];

  if (input.patterns.length > 0) {
    lines.push("PATTERNS:");
    for (const p of input.patterns) {
      lines.push(`- ${p.patternType}: ${p.title} (${p.evidenceCount} memories) — ${p.summary}`);
    }
    lines.push("");
  }

  const validIds = input.memories.map((m) => m.memoryId);
  lines.push("VALID MEMORY IDS: ${IDS}".replace("${IDS}", validIds.join(", ")));
  lines.push("EVIDENCE MEMORIES:");
  for (const m of input.memories) {
    const parts = [`- id=${m.memoryId}: ${m.title}`];
    if (m.excerpt) parts.push(`  note: ${m.excerpt}`);
    if (m.eventTimeLabel) parts.push(`  when: ${m.eventTimeLabel}`);
    if (m.location) parts.push(`  where: ${m.location}`);
    lines.push(parts.join("\n"));
  }
  lines.push("");
  lines.push("OUTPUT: strict JSON only.");

  return lines.join("\n");
}

/**
 * Parse the LLM's suggestion response. Returns null on empty/malformed output,
 * a title that is empty (insufficient evidence signal), memoryIds not among
 * the valid set, or fewer than 1 memory id. Never throws.
 */
export function parseSuggestStructureResponse(
  response: string,
  validIds: Set<string>,
): StructureSuggestion | null {
  if (typeof response !== "string") return null;
  const trimmed = response.trim();
  if (trimmed.length === 0) return null;

  // Extract the first {...} JSON object from the response.
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const jsonStr = trimmed.slice(start, end + 1);

  let payload: unknown;
  try {
    payload = JSON.parse(jsonStr);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;

  const obj = payload as {
    title?: unknown;
    description?: unknown;
    timeLabel?: unknown;
    memoryIds?: unknown;
  };
  if (typeof obj.title !== "string") return null;
  const title = obj.title.trim();
  // Empty title = insufficient evidence signal.
  if (title.length === 0) return null;

  const description =
    typeof obj.description === "string" && obj.description.trim().length > 0
      ? obj.description.trim()
      : null;
  const timeLabel =
    typeof obj.timeLabel === "string" && obj.timeLabel.trim().length > 0
      ? obj.timeLabel.trim()
      : null;

  if (!Array.isArray(obj.memoryIds)) return null;
  const ids = (obj.memoryIds as unknown[])
    .filter((id): id is string => typeof id === "string")
    .filter((id) => validIds.has(id));
  // Dedup.
  const uniqueIds = Array.from(new Set(ids));
  // A suggestion with no usable evidence memories is rejected.
  if (uniqueIds.length === 0) return null;

  return {
    kind: "event", // caller overrides based on input.kind
    title,
    description,
    timeLabel,
    memoryIds: uniqueIds,
  };
}
