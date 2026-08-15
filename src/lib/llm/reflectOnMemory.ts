/**
 * Companion reflection — grounded prompt contract + types.
 *
 * The Companion ASSISTS reflection. It is NOT defining the user's memory. The
 * flow is:
 *
 *   USER MEMORY
 *       ↓
 *   RELEVANT MEMORY CONTEXT  (supplied facts only)
 *       ↓
 *   SERVER-SIDE ORCHESTRA  (reflectOnMemory.server.ts)
 *       ↓
 *   COMPANION SUGGESTION  (string | null)
 *       ↓
 *   USER REVIEWS  →  USER DECIDES WHETHER TO SAVE AS A REFLECTION
 *
 * The AI suggestion is NEVER automatically persisted. The user must explicitly
 * confirm/save it. AI interpretation is never silently converted into a User
 * Fact.
 *
 * This module is pure string construction — no network, no keys, safe to import
 * from tests and from the client (it performs no I/O and contains no secrets).
 * Kept separate from orchestra.ts so the prompt contract can be tested without
 * any provider access.
 */
import type { Memory, Reflection } from "@/lib/memory/types";

export type ReflectOnMemoryInput = {
  memory: Pick<
    Memory,
    | "originalUserNote"
    | "userNote"
    | "feeling"
    | "lifeEvent"
    | "location"
    | "weather"
    | "eventTime"
    | "musicExperiences"
    | "recordedAt"
  >;
  /** Prior reflections for context (the user's own + past companion). */
  priorReflections?: Pick<Reflection, "author" | "body" | "reflectedAt">[];
};

export type ReflectOnMemoryOutput = {
  reflection: string | null;
};

const GROUNDING_RULES = [
  "Use ONLY the facts present in the supplied Memory. Do not invent facts.",
  "Do not invent people, places, dates, weather, events, song titles, or artists.",
  "Do not claim knowledge about the user's psychology, mental health, or diagnosis.",
  "Do not produce therapy, counselling, or medical diagnosis.",
  "Do not imply you remember anything outside the supplied data.",
  "Do not present interpretation as fact. Use uncertainty language: 'seems', 'appears', 'may', 'could'.",
  "Do not state what the user 'was' or 'felt' as certainty — reflect on what the memory seems to carry.",
  "Be warm, thoughtful, and human, but never presumptuous.",
  "Write a single short reflection (2-4 sentences). No JSON, no markdown headings, no bullet lists.",
];

function summariseMemory(memory: ReflectOnMemoryInput["memory"]): string {
  const music = memory.musicExperiences
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((e, i) => {
      const title = e.experience.title;
      const artist = e.experience.artist;
      const parts = [title, artist].filter((p) => p && p.trim().length > 0);
      const label = parts.length > 0 ? parts.join(" — ") : "unnamed music";
      return `${i + 1}. ${label}`;
    })
    .join("\n");

  const lines: string[] = [];
  if (memory.originalUserNote) {
    lines.push(`Original memory (user's own words, verbatim):`);
    lines.push(memory.originalUserNote);
  }
  if (memory.userNote && memory.userNote !== memory.originalUserNote) {
    lines.push("");
    lines.push(`Current note (user's latest editable wording):`);
    lines.push(memory.userNote);
  }
  if (music) {
    lines.push("");
    lines.push(`Music (in stored order):`);
    lines.push(music);
  }
  if (memory.eventTime?.label) {
    lines.push("");
    lines.push(`When (user-supplied): ${memory.eventTime.label}`);
  }
  if (memory.location) {
    lines.push(`Location (user-supplied): ${memory.location}`);
  }
  if (memory.weather) {
    lines.push(`Weather (user-supplied): ${memory.weather}`);
  }
  if (memory.lifeEvent) {
    lines.push(`Context (user-supplied): ${memory.lifeEvent}`);
  }
  if (memory.feeling) {
    lines.push(`Feeling (user-supplied): ${memory.feeling}`);
  }
  return lines.join("\n");
}

function summarisePrior(reflections: ReflectOnMemoryInput["priorReflections"]): string {
  if (!reflections || reflections.length === 0) return "";
  const lines = reflections.map((r) => `[${r.author}] ${r.body}`);
  return ["PRIOR REFLECTIONS (chronological):", ...lines].join("\n");
}

/**
 * Build the grounded reflection prompt. Returns the user message string sent
 * to the Orchestra `summarizer` role. Contains explicit grounding rules and
 * only the supplied memory facts. The suggestion is advisory only — the user
 * decides whether to save it.
 */
export function buildReflectionPrompt(input: ReflectOnMemoryInput): string {
  const rulesBlock = GROUNDING_RULES.map((r, i) => `${i + 1}. ${r}`).join("\n");
  const memoryBlock = summariseMemory(input.memory);
  const priorBlock = summarisePrior(input.priorReflections ?? []);

  return [
    "You are the Companion of Life in a Sound, a personal music-memory companion.",
    "A user has opened one of their saved memories and asked for help reflecting on it.",
    "Your role is to ASSIST reflection — not to define the user's memory.",
    "The user remains the source of truth. Your suggestion is advisory; the user will decide whether to keep it.",
    "",
    "SUPPLIED MEMORY (facts only):",
    memoryBlock,
    priorBlock ? "" : "",
    priorBlock,
    "",
    "RULES:",
    rulesBlock,
    "",
    "TASK:",
    "Write a short, warm reflection on this memory as it reads today. Use uncertainty language. Do not assert facts that were not supplied. This is a suggestion the user may choose to save as a reflection — or not.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}
