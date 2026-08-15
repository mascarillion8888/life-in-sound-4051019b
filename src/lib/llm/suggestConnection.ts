/**
 * AI-suggested Memory connection — grounded prompt + candidate types.
 *
 * The AI may INSPECT the current memory and a small retrieved candidate set and
 * return a grounded connection suggestion. It must NOT:
 *   - persist the connection automatically
 *   - invent facts
 *   - claim a user relationship
 *   - rewrite memories
 *   - change source data
 *
 * Flow: USER MEMORY → CANDIDATE SET → SERVER-SIDE ORCHESTRA → SUGGESTION →
 * USER REVIEWS → [Accept] persists as source='ai_suggested' (user_linked) or
 * [Dismiss] leaves no connection.
 *
 * Pure string/type construction — no network, no keys, client-safe.
 */
import type { Memory } from "@/lib/memory/types";

export type AISuggestedConnection = {
  candidateMemoryId: string;
  reason: string;
  confidence: number;
};

export type SuggestConnectionInput = {
  memory: Pick<
    Memory,
    | "id"
    | "originalUserNote"
    | "userNote"
    | "feeling"
    | "lifeEvent"
    | "location"
    | "weather"
    | "eventTime"
    | "musicExperiences"
  >;
  candidates: Array<
    Pick<
      Memory,
      | "id"
      | "originalUserNote"
      | "userNote"
      | "feeling"
      | "lifeEvent"
      | "location"
      | "weather"
      | "eventTime"
      | "musicExperiences"
    >
  >;
};

export type SuggestConnectionOutput = {
  suggestion: AISuggestedConnection | null;
};

const GROUNDING_RULES = [
  "Compare the supplied memories and identify whether there is a grounded connection worth suggesting.",
  "Use ONLY the facts present in the supplied memories. Do not invent facts.",
  "Do not invent people, places, dates, weather, events, song titles, or artists.",
  "Do not claim knowledge of the user's psychology, mental health, or relationships.",
  "Do not present interpretation as fact. Use uncertainty language: 'seems', 'appears', 'may'.",
  "Do not perform broad user profiling or longitudinal analysis.",
  "Output a single JSON object, or the word null if no grounded connection exists. No prose, no markdown, no code fences.",
  "confidence is a number in [0,1]; below 0.4 means weak; do not exceed 0.8 for a suggestion.",
];

function summariseMemory(
  label: string,
  m: SuggestConnectionInput["memory"] | SuggestConnectionInput["candidates"][number],
): string {
  const music = m.musicExperiences
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((e, i) => {
      const parts = [e.experience.title, e.experience.artist].filter(
        (p) => p && p.trim().length > 0,
      );
      const t = parts.length > 0 ? parts.join(" — ") : "unnamed music";
      return `${i + 1}. ${t}`;
    })
    .join("\n");
  const lines: string[] = [`${label}:`, `id: ${m.id}`];
  if (m.originalUserNote) lines.push(`note: ${m.originalUserNote}`);
  if (m.location) lines.push(`location: ${m.location}`);
  if (m.weather) lines.push(`weather: ${m.weather}`);
  if (m.lifeEvent) lines.push(`context: ${m.lifeEvent}`);
  if (m.eventTime?.label) lines.push(`when: ${m.eventTime.label}`);
  if (music) lines.push(`music:\n${music}`);
  return lines.join("\n");
}

export function buildSuggestConnectionPrompt(input: SuggestConnectionInput): string {
  const rulesBlock = GROUNDING_RULES.map((r, i) => `${i + 1}. ${r}`).join("\n");
  const sourceBlock = summariseMemory("SOURCE MEMORY", input.memory);
  const candidateBlocks = input.candidates
    .map((c, i) => summariseMemory(`CANDIDATE ${i + 1}`, c))
    .join("\n\n");

  const schemaBlock = [
    '{ "candidateMemoryId": string, "reason": string, "confidence": number }',
    "or the single word: null",
  ].join("\n");

  return [
    "You are the Companion of Life in a Sound, suggesting a possible connection between memories.",
    "Your suggestion is advisory only; the user decides whether to keep it.",
    "",
    "RULES:",
    rulesBlock,
    "",
    sourceBlock,
    "",
    candidateBlocks,
    "",
    "OUTPUT SCHEMA (single JSON object, or null):",
    schemaBlock,
  ].join("\n");
}

/**
 * Safely parse the LLM's connection-suggestion response. Returns null on any
 * malformation: non-JSON, wrong shape, candidateMemoryId not among the supplied
 * candidates, or confidence out of range. Never throws.
 */
export function parseSuggestConnectionResponse(
  response: string,
  validCandidateIds: ReadonlySet<string>,
): AISuggestedConnection | null {
  if (typeof response !== "string" || response.trim().length === 0) return null;

  let text = response.trim();
  if (text.toLowerCase() === "null") return null;

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  let parsed: { candidateMemoryId?: unknown; reason?: unknown; confidence?: unknown };
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const candidateMemoryId = parsed.candidateMemoryId;
  if (typeof candidateMemoryId !== "string" || !validCandidateIds.has(candidateMemoryId)) {
    return null;
  }
  const reason = parsed.reason;
  if (typeof reason !== "string" || reason.trim().length === 0) return null;
  const confidenceNum = typeof parsed.confidence === "number" ? parsed.confidence : NaN;
  if (!Number.isFinite(confidenceNum) || confidenceNum < 0 || confidenceNum > 1) return null;

  return {
    candidateMemoryId,
    reason: reason.trim(),
    confidence: confidenceNum,
  };
}
