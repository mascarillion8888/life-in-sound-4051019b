/**
 * Memory extraction — grounded prompt contract + candidate types.
 *
 * This is the FIRST place where the LLM Orchestra participates in the Music
 * Memory lifecycle. The flow is:
 *
 *   USER FREE-TEXT
 *       ↓
 *   ORCHESTRA / LLM EXTRACTION  (this prompt + extractMemory.server.ts)
 *       ↓
 *   STRUCTURED CANDIDATE MEMORY (ExtractedCandidate)
 *       ↓
 *   USER CONFIRMATION / EDIT
 *       ↓
 *   memory-remote.ts  →  Supabase
 *
 * The AI is an EXTRACTOR/SUGGESTER only. The user remains the source of truth.
 * The original user note is preserved separately and NEVER replaced by the AI's
 * rewritten version. Nothing in the candidate is a confirmed user fact until the
 * user confirms it.
 *
 * This module is pure string/type construction — no network, no keys, safe to
 * import from tests and from the client (it performs no I/O and contains no
 * secrets). Kept separate from orchestra.ts so the prompt contract can be
 * tested without any provider access.
 */
import type { MusicExperienceSourceType } from "@/lib/supabase/types";

/** A music experience candidate extracted from free text. */
export type CandidateMusicExperience = {
  /** Artist if explicitly mentioned in the text; null otherwise. */
  artist: string | null;
  /** Title if explicitly identifiable; null when only an artist is mentioned. */
  title: string | null;
  /** Best-guess source type from context; defaults to "streaming". */
  sourceType: MusicExperienceSourceType;
};

/** Approximate-time candidate. granularity documents precision. */
export type CandidateEventTime = {
  granularity: "exact" | "day" | "month" | "year" | "season" | "period" | "unknown";
  /** ISO lower bound if derivable; null if not. */
  start: string | null;
  /** ISO upper bound if derivable; null if not. */
  end: string | null;
  /** The user's own time wording, verbatim. */
  label: string | null;
};

/**
 * A structured candidate memory extracted by the LLM. Every field is a
 * SUGGESTION pending user confirmation — never a confirmed user fact.
 *
 * - `explicitUserFact` flags fields the LLM believes were stated explicitly by
 *   the user (vs inferred). This is advisory only; the user is still the
 *   authority.
 * - `feelingSuggestion` is always an AI INTERPRETATION, never a user fact.
 * - `originalUserNote` is the raw user text, preserved verbatim, never
 *   rewritten by the AI.
 */
export type ExtractedCandidate = {
  originalUserNote: string;
  musicExperiences: CandidateMusicExperience[];
  eventTime: CandidateEventTime | null;
  location: string | null;
  weather: string | null;
  context: string | null;
  feelingSuggestion: string | null;
  extractionNotes: string[] | null;
};

/** The raw JSON shape the LLM is asked to emit. */
export type CandidateJson = {
  music_experiences?: Array<{
    artist?: string | null;
    title?: string | null;
    source_type?: string | null;
  }>;
  event_time?: {
    granularity?: string | null;
    start?: string | null;
    end?: string | null;
    label?: string | null;
  } | null;
  location?: string | null;
  weather?: string | null;
  context?: string | null;
  feeling_suggestion?: string | null;
  extraction_notes?: string[] | null;
};

const GROUNDING_RULES = [
  "Extract ONLY what is explicitly present in the user's note. Do not invent facts.",
  "When information is ambiguous or absent, leave that field null. Do not guess.",
  "Do not infer exact dates from vague language. If the user says '2004', the granularity is 'year'. If they say 'summer', use 'season'. Never invent a day or month.",
  "Do not invent song titles or artist/title combinations. If only an artist is mentioned, set title to null. If only a title is mentioned, set artist to null.",
  "Do not invent locations. Only populate 'location' if the user explicitly named a place or setting.",
  "Do not invent weather. Only populate 'weather' if the user explicitly described it.",
  "Do not convert AI interpretation into user facts. 'feeling_suggestion' is always an interpretation, never a confirmed user fact.",
  "Preserve the original user note separately — do not rewrite or paraphrase it into any field.",
  "Output ONLY a single JSON object. No prose, no markdown, no code fences, no commentary.",
];

const VALID_GRANULARITIES = new Set([
  "exact",
  "day",
  "month",
  "year",
  "season",
  "period",
  "unknown",
]);

const VALID_SOURCE_TYPES = new Set([
  "streaming",
  "traditional",
  "family",
  "anonymous",
  "unknown_title",
  "live",
]);

/**
 * Build the grounded extraction prompt. Returns the user message string sent
 * to the Orchestra role. Contains explicit grounding rules and only the raw
 * user note.
 */
export function buildExtractionPrompt(rawUserNote: string): string {
  const rulesBlock = GROUNDING_RULES.map((r, i) => `${i + 1}. ${r}`).join("\n");
  const schemaBlock = [
    "{",
    '  "music_experiences": [ { "artist": string|null, "title": string|null, "source_type": "streaming|traditional|family|anonymous|unknown_title|live" } ],',
    '  "event_time": { "granularity": "exact|day|month|year|season|period|unknown", "start": ISO8601|null, "end": ISO8601|null, "label": string|null } | null,',
    '  "location": string|null,',
    '  "weather": string|null,',
    '  "context": string|null,',
    '  "feeling_suggestion": string|null,',
    '  "extraction_notes": string[]|null',
    "}",
  ].join("\n");

  return [
    "You are the extraction layer of Life in a Sound, a personal music-memory companion.",
    "",
    "A user has written a free-text note about a moment when music mattered to them.",
    "Your job is to extract a STRUCTURED candidate memory from their note, so the user can review and confirm it.",
    "",
    "RAW USER NOTE:",
    rawUserNote,
    "",
    "RULES:",
    rulesBlock,
    "",
    "OUTPUT SCHEMA (single JSON object, nothing else):",
    schemaBlock,
  ].join("\n");
}

/**
 * Safely parse the LLM's JSON response into an ExtractedCandidate.
 *
 * Returns null on any malformation: non-JSON, wrong shape, missing required
 * structure, or values outside the allowed contracts. Never throws. The raw
 * user note is re-attached from the trusted input (never trusted from the LLM)
 * so the original note is always preserved exactly.
 */
export function parseExtractionResponse(
  response: string,
  trustedOriginalNote: string,
): ExtractedCandidate | null {
  if (typeof response !== "string" || response.trim().length === 0) return null;

  // The LLM may wrap JSON in code fences despite instructions; strip them.
  let text = response.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  // Find the outermost JSON object to tolerate stray prose around it.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const jsonSlice = text.slice(start, end + 1);

  let parsed: CandidateJson;
  try {
    parsed = JSON.parse(jsonSlice) as CandidateJson;
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  // Music experiences — at least one must be derivable, but title/artist may
  // both be null only if a source_type indicates unnamed music. Otherwise the
  // candidate is not useful.
  const rawExps = Array.isArray(parsed.music_experiences) ? parsed.music_experiences : [];
  const musicExperiences: CandidateMusicExperience[] = [];
  for (const e of rawExps) {
    if (typeof e !== "object" || e === null) continue;
    const artist = typeof e.artist === "string" && e.artist.trim() ? e.artist.trim() : null;
    const title = typeof e.title === "string" && e.title.trim() ? e.title.trim() : null;
    const sourceTypeStr = typeof e.source_type === "string" ? e.source_type : "streaming";
    const sourceType = (
      VALID_SOURCE_TYPES.has(sourceTypeStr) ? sourceTypeStr : "streaming"
    ) as MusicExperienceSourceType;
    // Skip entries with neither title nor artist unless the source type admits
    // unnamed music.
    const allowsUnnamed =
      sourceType === "anonymous" || sourceType === "unknown_title" || sourceType === "traditional";
    if (!title && !artist && !allowsUnnamed) continue;
    musicExperiences.push({ artist, title, sourceType });
  }

  // If no usable music experience could be extracted, the candidate is null —
  // the user will use the manual fallback.
  if (musicExperiences.length === 0) return null;

  // Event time.
  let eventTime: CandidateEventTime | null = null;
  if (parsed.event_time && typeof parsed.event_time === "object") {
    const et = parsed.event_time;
    const granularityStr = typeof et.granularity === "string" ? et.granularity : "unknown";
    const granularity = (
      VALID_GRANULARITIES.has(granularityStr) ? granularityStr : "unknown"
    ) as CandidateEventTime["granularity"];
    const start = typeof et.start === "string" && et.start.trim() ? et.start.trim() : null;
    const end = typeof et.end === "string" && et.end.trim() ? et.end.trim() : null;
    const label = typeof et.label === "string" && et.label.trim() ? et.label.trim() : null;
    eventTime = { granularity, start, end, label };
  }

  const location =
    typeof parsed.location === "string" && parsed.location.trim() ? parsed.location.trim() : null;
  const weather =
    typeof parsed.weather === "string" && parsed.weather.trim() ? parsed.weather.trim() : null;
  const context =
    typeof parsed.context === "string" && parsed.context.trim() ? parsed.context.trim() : null;
  const feelingSuggestion =
    typeof parsed.feeling_suggestion === "string" && parsed.feeling_suggestion.trim()
      ? parsed.feeling_suggestion.trim()
      : null;
  const extractionNotes =
    Array.isArray(parsed.extraction_notes) &&
    parsed.extraction_notes.every((n) => typeof n === "string")
      ? (parsed.extraction_notes as string[])
      : null;

  return {
    originalUserNote: trustedOriginalNote,
    musicExperiences,
    eventTime,
    location,
    weather,
    context,
    feelingSuggestion,
    extractionNotes,
  };
}
