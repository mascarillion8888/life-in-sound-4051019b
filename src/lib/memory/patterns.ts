/**
 * Deterministic Pattern discovery — pure logic, no I/O, no DB, no network, no LLM.
 *
 * A Pattern means: "A meaningful repeat or relationship supported by multiple
 * recorded user memories." A Pattern MUST have evidence. This is NOT a
 * psychological profiler and MUST NOT invent personal facts.
 *
 * Canonical trust flow:
 *   USER FACTS → DETERMINISTIC EVIDENCE → PATTERN CANDIDATE →
 *   (OPTIONAL) ORCHESTRA INTERPRETATION → USER SEES EVIDENCE
 *
 * v1 pattern types (all deterministic, evidence-backed):
 *   1. repeated_music          — a Music Experience in >=2 distinct Memories
 *   2. repeated_location       — exact normalized location in >=2 Memories
 *   3. recurring_time_context  — explicit time/context label in >=3 Memories
 *   4. revisited_memory        — a Memory with >=2 Reflections over time
 *   5. recurring_weather_context — explicit user weather in >=3 Memories
 *   6. recurring_user_emotion  — explicit user feeling in >=3 Memories
 *
 * IMPORTANT:
 *   - AI-derived context (memories.aiContext) is NEVER used as deterministic
 *     evidence. Only user-provided fields (location, weather, feeling,
 *     eventTime.label) and factual relationships (Music Experience ids,
 *     Reflection counts) count.
 *   - Discovery returns CANDIDATES only. It NEVER persists. The caller decides.
 *   - Unknown/missing values never produce a pattern (no invention).
 */
import type {
  Memory,
  PatternCandidate,
  PatternEvidence,
  PatternType,
  Reflection,
} from "@/lib/memory/types";
import { normalizeLocation } from "@/lib/memory/connections";

// Minimum evidence thresholds per type.
const THRESHOLDS: Record<PatternType, number> = {
  repeated_music: 2,
  repeated_location: 2,
  recurring_time_context: 3,
  revisited_memory: 2, // 2+ reflections on one memory
  recurring_weather_context: 3,
  recurring_user_emotion: 3,
};

/** Canonical weather normalization. Deterministic, documented, no external APIs. */
const WEATHER_ALIASES: Record<string, string> = {
  rain: "rain",
  rainy: "rain",
  raining: "rain",
  yağmur: "rain",
  snow: "snow",
  snowy: "snow",
  snowing: "snow",
  sun: "sun",
  sunny: "sun",
  clear: "sun",
  cloud: "cloud",
  cloudy: "cloud",
  overcast: "cloud",
  fog: "fog",
  foggy: "fog",
};

/** Canonical emotion normalization. Deterministic, documented. */
const EMOTION_ALIASES: Record<string, string> = {
  nostalgia: "nostalgia",
  nostalgic: "nostalgia",
  happy: "happy",
  happiness: "happy",
  joy: "happy",
  joyful: "happy",
  sad: "sad",
  sadness: "sad",
  melancholy: "melancholy",
  melancholic: "melancholy",
  calm: "calm",
  peaceful: "calm",
  excited: "excited",
  excitement: "excited",
};

/**
 * Normalize a weather value to a canonical form. Returns null when the value
 * is empty or not a known supported alias (we do NOT guess — unknown values
 * never produce a pattern).
 */
export function normalizeWeather(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  if (key.length === 0) return null;
  return WEATHER_ALIASES[key] ?? null;
}

/**
 * Normalize a user-provided feeling/emotion value to a canonical form. Returns
 * null when the value is empty or not a known supported alias.
 */
export function normalizeEmotion(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  if (key.length === 0) return null;
  return EMOTION_ALIASES[key] ?? null;
}

/**
 * Normalize a time/context label for grouping. Lowercased + trimmed. Returns
 * null when absent. Only EXPLICIT user-provided labels are used — we never
 * infer "night" from a timestamp.
 */
export function normalizeTimeContext(memory: Memory): string | null {
  const label = memory.eventTime?.label;
  if (!label) return null;
  const key = label.trim().toLowerCase();
  if (key.length === 0) return null;
  return key;
}

/** Build a deterministic fingerprint for a pattern. */
export function patternFingerprint(type: PatternType, value: string): string {
  return `${type}:${value}`;
}

/**
 * Discover deterministic pattern candidates from the user's memories and
 * reflections. Pure: no side effects, no persistence, no network.
 *
 * @param memories    The user's memories (only user-provided fields are evidence).
 * @param reflections The user's reflections (for revisited_memory). Grouped by
 *                    memoryId internally; pass all of them.
 * @returns PatternCandidate[] — candidates that meet the minimum threshold.
 */
export function discoverPatterns(
  memories: Memory[],
  reflections: Reflection[],
): PatternCandidate[] {
  const candidates: PatternCandidate[] = [];

  candidates.push(...discoverRepeatedMusic(memories));
  candidates.push(...discoverRepeatedLocation(memories));
  candidates.push(...discoverRecurringTimeContext(memories));
  candidates.push(...discoverRevisitedMemory(memories, reflections));
  candidates.push(...discoverRecurringWeather(memories));
  candidates.push(...discoverRecurringEmotion(memories));

  return candidates;
}

// ---------------------------------------------------------------------------
// 1. repeated_music — a Music Experience appearing in >=2 distinct Memories.
//    Does NOT count the same Memory twice (dedup by memoryId within a music id).
// ---------------------------------------------------------------------------
function discoverRepeatedMusic(memories: Memory[]): PatternCandidate[] {
  // musicExperienceId -> Set of distinct memoryIds.
  const musicToMemories = new Map<string, Set<string>>();

  for (const m of memories) {
    for (const link of m.musicExperiences) {
      const id = link.musicExperienceId;
      let set = musicToMemories.get(id);
      if (!set) {
        set = new Set();
        musicToMemories.set(id, set);
      }
      // Dedup: a Memory appears once per music id even if the bridge has it
      // multiple times (defensive against duplicate bridge rows).
      set.add(m.id);
    }
  }

  const out: PatternCandidate[] = [];
  for (const [musicId, memSet] of musicToMemories) {
    if (memSet.size < THRESHOLDS.repeated_music) continue;
    const memoryIds = Array.from(memSet);
    out.push(
      buildCandidate({
        patternType: "repeated_music",
        value: musicId,
        memoryIds,
        title: "A song that follows you",
        summary: `Appears in ${memSet.size} of your memories.`,
        evidenceRole: "Contains this music experience",
        memories,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. repeated_location — exact normalized location in >=2 distinct Memories.
//    No fuzzy geography. "Istanbul" == "istanbul" == "ISTANBUL"; "Taksim" != "Istanbul".
// ---------------------------------------------------------------------------
function discoverRepeatedLocation(memories: Memory[]): PatternCandidate[] {
  const locToMemories = new Map<string, Set<string>>();

  for (const m of memories) {
    const loc = normalizeLocation(m.location);
    if (!loc) continue;
    let set = locToMemories.get(loc);
    if (!set) {
      set = new Set();
      locToMemories.set(loc, set);
    }
    set.add(m.id);
  }

  const out: PatternCandidate[] = [];
  for (const [loc, memSet] of locToMemories) {
    if (memSet.size < THRESHOLDS.repeated_location) continue;
    const memoryIds = Array.from(memSet);
    out.push(
      buildCandidate({
        patternType: "repeated_location",
        value: loc,
        memoryIds,
        title: "A place that recurs",
        summary: `${memSet.size} of your memories share this location.`,
        evidenceRole: "Shares this location",
        memories,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. recurring_time_context — explicit eventTime.label in >=3 Memories.
//    Only explicit user-provided labels. Unknown time never produces a pattern.
// ---------------------------------------------------------------------------
function discoverRecurringTimeContext(memories: Memory[]): PatternCandidate[] {
  const ctxToMemories = new Map<string, Set<string>>();

  for (const m of memories) {
    const ctx = normalizeTimeContext(m);
    if (!ctx) continue;
    let set = ctxToMemories.get(ctx);
    if (!set) {
      set = new Set();
      ctxToMemories.set(ctx, set);
    }
    set.add(m.id);
  }

  const out: PatternCandidate[] = [];
  for (const [ctx, memSet] of ctxToMemories) {
    if (memSet.size < THRESHOLDS.recurring_time_context) continue;
    const memoryIds = Array.from(memSet);
    out.push(
      buildCandidate({
        patternType: "recurring_time_context",
        value: ctx,
        memoryIds,
        title: "A time that recurs",
        summary: `"${ctx}" appears in ${memSet.size} of your memories.`,
        evidenceRole: "Carries this time context",
        memories,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. revisited_memory — a Memory with >=2 Reflections separated by time.
//    Evidence is the single memory + its reflection count/dates. We do NOT
//    infer emotional change.
// ---------------------------------------------------------------------------
function discoverRevisitedMemory(
  memories: Memory[],
  reflections: Reflection[],
): PatternCandidate[] {
  // Group reflections by memoryId.
  const refsByMemory = new Map<string, Reflection[]>();
  for (const r of reflections) {
    const arr = refsByMemory.get(r.memoryId) ?? [];
    arr.push(r);
    refsByMemory.set(r.memoryId, arr);
  }

  const out: PatternCandidate[] = [];
  for (const [memoryId, refs] of refsByMemory) {
    if (refs.length < THRESHOLDS.revisited_memory) continue;
    // Confirm the memory exists and is owned (it's in the memories list).
    const mem = memories.find((m) => m.id === memoryId);
    if (!mem) continue;

    // Evidence is the single memory; the reflection count is documented in the
    // summary and evidence role.
    out.push({
      patternType: "revisited_memory",
      title: "A memory you keep returning to",
      summary: `${refs.length} reflections across time.`,
      confidence: 1.0,
      fingerprint: patternFingerprint("revisited_memory", memoryId),
      evidenceCount: 1,
      observedFrom: minDate(refs.map((r) => r.reflectedAt)),
      observedTo: maxDate(refs.map((r) => r.reflectedAt)),
      evidence: [
        {
          memoryId,
          evidenceRole: `${refs.length} reflections`,
        },
      ],
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 5. recurring_weather_context — explicit user weather in >=3 Memories.
//    Normalizes only documented exact aliases. No external weather APIs, no
//    inference from dates/locations.
// ---------------------------------------------------------------------------
function discoverRecurringWeather(memories: Memory[]): PatternCandidate[] {
  const wToMemories = new Map<string, Set<string>>();

  for (const m of memories) {
    const w = normalizeWeather(m.weather);
    if (!w) continue;
    let set = wToMemories.get(w);
    if (!set) {
      set = new Set();
      wToMemories.set(w, set);
    }
    set.add(m.id);
  }

  const out: PatternCandidate[] = [];
  for (const [w, memSet] of wToMemories) {
    if (memSet.size < THRESHOLDS.recurring_weather_context) continue;
    const memoryIds = Array.from(memSet);
    out.push(
      buildCandidate({
        patternType: "recurring_weather_context",
        value: w,
        memoryIds,
        title: "Weather that recurs",
        summary: `"${w}" appears in ${memSet.size} of your memories.`,
        evidenceRole: "Carries this weather",
        memories,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// 6. recurring_user_emotion — explicit user feeling in >=3 Memories.
//    Uses ONLY user-provided feeling. AI-derived feelings (aiContext) are
//    NEVER used as deterministic evidence.
// ---------------------------------------------------------------------------
function discoverRecurringEmotion(memories: Memory[]): PatternCandidate[] {
  const eToMemories = new Map<string, Set<string>>();

  for (const m of memories) {
    // Explicitly use m.feeling (user-provided), never m.aiContext.
    const e = normalizeEmotion(m.feeling);
    if (!e) continue;
    let set = eToMemories.get(e);
    if (!set) {
      set = new Set();
      eToMemories.set(e, set);
    }
    set.add(m.id);
  }

  const out: PatternCandidate[] = [];
  for (const [e, memSet] of eToMemories) {
    if (memSet.size < THRESHOLDS.recurring_user_emotion) continue;
    const memoryIds = Array.from(memSet);
    out.push(
      buildCandidate({
        patternType: "recurring_user_emotion",
        value: e,
        memoryIds,
        title: "A feeling that recurs",
        summary: `"${e}" appears in ${memSet.size} of your memories.`,
        evidenceRole: "Carries this feeling",
        memories,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCandidate(args: {
  patternType: PatternType;
  value: string;
  memoryIds: string[];
  title: string;
  summary: string;
  evidenceRole: string;
  memories: Memory[];
}): PatternCandidate {
  const evidence: PatternEvidence[] = args.memoryIds.map((id) => ({
    memoryId: id,
    evidenceRole: args.evidenceRole,
  }));

  const dates = args.memoryIds
    .map((id) => args.memories.find((m) => m.id === id))
    .filter((m): m is Memory => Boolean(m))
    .map((m) => m.recordedAt);

  return {
    patternType: args.patternType,
    title: args.title,
    summary: args.summary,
    confidence: 1.0,
    fingerprint: patternFingerprint(args.patternType, args.value),
    evidenceCount: args.memoryIds.length,
    observedFrom: minDate(dates),
    observedTo: maxDate(dates),
    evidence,
  };
}

function minDate(dates: Array<string | null | undefined>): string | null {
  const valid = dates.filter((d): d is string => Boolean(d));
  if (valid.length === 0) return null;
  return valid.slice().sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
}

function maxDate(dates: Array<string | null | undefined>): string | null {
  const valid = dates.filter((d): d is string => Boolean(d));
  if (valid.length === 0) return null;
  return valid.slice().sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}
