/**
 * Companion Retrieval — bounded candidate loaders (server-side).
 *
 * Targeted Postgres queries that load ONLY the bounded candidate set the
 * retrieval planner needs. Each loader enforces a hard DB-level `.limit()` so
 * the user's entire corpus is never fetched, regardless of size (10 / 100 /
 * 1,000 / 10,000 memories). No vector index, no graph DB, no full-text engine.
 *
 * Safety conventions mirror companion-remote.ts / memory-remote.ts:
 *   - Only the browser anon client is used (see supabase/client.ts). On the
 *     server this client works because VITE_* env vars are inlined at build.
 *   - Every query is owner-scoped (`.eq('user_id', userId)`); RLS is the
 *     final enforcement on auth.uid() = user_id.
 *   - No service-role credentials. No provider keys.
 *   - Failures are contained: return `[]` rather than throwing.
 *
 * These loaders are READ-ONLY. They never mutate. They are called by the
 * server retrieval function (retrieveCompanionContext) which verifies
 * identity + conversation ownership BEFORE calling these.
 *
 * QUERY STRATEGY:
 *   - companion_memories: active only, recent, bounded.
 *   - memories: recent bounded set (no full-table fetch); optional time /
 *     title / artist / location filters applied at the DB where cheap.
 *   - reflections: recent bounded set across the user's memories.
 *   - patterns: active only, bounded.
 *   - events / chapters: bounded recent set.
 *   - conversation turns: recent bounded set (reuse loadRecentTurns).
 *
 * Media is intentionally NOT loaded here — media binary is never sent to the
 * LLM. Only metadata may be included later, and never signed URLs.
 */
import { getSupabase } from "./client";
import { CONTEXT_BUDGET } from "@/lib/memory/companionRetrieval";
import type { CompanionMemoryRow, MemoryRow, PatternRow, ReflectionRow } from "./types";
import type {
  CompanionMemory,
  CompanionTurn,
  LifeChapter,
  LifeEvent,
  Memory,
  Pattern,
  Reflection,
} from "@/lib/memory/types";
import { loadRecentTurns } from "./companion-remote";
import { listActiveCompanionMemories } from "./companion-memory-remote";

const MEMORIES_TABLE = "memories";
const EXPERIENCES_TABLE = "music_experiences";
const BRIDGE_TABLE = "memory_music_experiences";
const REFLECTIONS_TABLE = "reflections";
const PATTERNS_TABLE = "patterns";
const PATTERN_MEMORIES_TABLE = "pattern_memories";
const EVENTS_TABLE = "life_events";
const CHAPTERS_TABLE = "life_chapters";

// Re-export the budget so callers can inspect configured limits.
export { CONTEXT_BUDGET };

// ---------------------------------------------------------------------------
// Turns + Companion Memories (reuse existing bounded loaders)
// ---------------------------------------------------------------------------

/** Recent conversation turns, bounded to the configured budget, chronological. */
export async function loadRecentTurnsForRetrieval(
  userId: string,
  conversationId: string,
): Promise<CompanionTurn[]> {
  return loadRecentTurns(userId, conversationId, CONTEXT_BUDGET.recentConversationTurns);
}

/** Active Companion Memories, bounded, newest first. */
export function loadCompanionMemoriesForRetrieval(userId: string): Promise<CompanionMemory[]> {
  return listActiveCompanionMemories(userId);
}

// ---------------------------------------------------------------------------
// Memories (bounded, with experiences)
// ---------------------------------------------------------------------------

type MemorySubset = MemoryRow;

/**
 * Load a bounded set of the user's most recent memories (newest-recorded
 * first), each with its Music Experiences attached. Never the full corpus.
 */
export async function loadMemoriesForRetrieval(
  userId: string,
  options: { year?: number | null } = {},
): Promise<Memory[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    let query = client
      .from(MEMORIES_TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false })
      .limit(CONTEXT_BUDGET.memories);

    if (options.year) {
      const y = options.year;
      const startISO = `${y}-01-01T00:00:00Z`;
      const endISO = `${y}-12-31T23:59:59Z`;
      // event_time overlaps year: start <= end-of-year AND end >= start-of-year.
      query = query
        .or(`event_time_end.gte.${startISO},event_time_end.is.null`)
        .or(`event_time_start.lte.${endISO},event_time_start.is.null`);
    }

    const { data: mems, error } = await query;
    if (error || !mems) return [];

    const rows = mems as unknown as MemorySubset[];
    if (rows.length === 0) return [];

    const memoryIds = rows.map((m) => m.id);
    const { data: bridgeRows } = await client
      .from(BRIDGE_TABLE)
      .select("*")
      .in("memory_id", memoryIds)
      .eq("user_id", userId);

    type BridgeRow = {
      memory_id: string;
      music_experience_id: string;
      position: number;
      role: string | null;
    };
    const expIds = (bridgeRows ?? []).map((r: BridgeRow) => r.music_experience_id);
    let experiences: Array<{
      id: string;
      source_type: string;
      title: string | null;
      artist: string | null;
      album: string | null;
      external_ref: string | null;
      source_notes: string | null;
    }> = [];
    if (expIds.length > 0) {
      const { data: expRows } = await client.from(EXPERIENCES_TABLE).select("*").in("id", expIds);
      experiences = (expRows ?? []) as unknown as typeof experiences;
    }

    const linksByMemory = new Map<
      string,
      Array<{
        bridge: {
          memory_id: string;
          music_experience_id: string;
          position: number;
          role: string | null;
        };
        experience: (typeof experiences)[number] | null;
      }>
    >();
    for (const bridge of (bridgeRows ?? []) as BridgeRow[]) {
      const exp = experiences.find((e) => e.id === bridge.music_experience_id) ?? null;
      const arr = linksByMemory.get(bridge.memory_id) ?? [];
      arr.push({
        bridge: {
          memory_id: bridge.memory_id,
          music_experience_id: bridge.music_experience_id,
          position: bridge.position,
          role: bridge.role,
        },
        experience: exp,
      });
      linksByMemory.set(bridge.memory_id, arr);
    }

    return rows.map((m) => rowToMemory(m, linksByMemory.get(m.id) ?? []));
  } catch {
    return [];
  }
}

function rowToMemory(
  row: MemorySubset,
  links: Array<{
    bridge: {
      memory_id: string;
      music_experience_id: string;
      position: number;
      role: string | null;
    };
    experience: {
      id: string;
      source_type: string;
      title: string | null;
      artist: string | null;
      album: string | null;
      external_ref: string | null;
      source_notes: string | null;
    } | null;
  }>,
): Memory {
  return {
    id: row.id,
    userId: row.user_id,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    originalUserNote: row.original_user_note,
    userNote: row.user_note,
    feeling: row.feeling,
    lifeEvent: row.life_event,
    location: row.location,
    weather: row.weather,
    eventTime: {
      granularity: row.event_time_granularity ?? undefined,
      start: row.event_time_start,
      end: row.event_time_end,
      label: row.event_time_label,
    },
    aiContext: null,
    aiContextStaleAt: row.ai_context_stale_at ?? null,
    musicExperiences: links.map((l) => ({
      musicExperienceId: l.bridge.music_experience_id,
      position: l.bridge.position,
      role: l.bridge.role,
      experience: {
        id: l.experience?.id ?? "",
        sourceType: l.experience?.source_type as never,
        title: l.experience?.title ?? null,
        artist: l.experience?.artist ?? null,
        album: l.experience?.album ?? null,
        externalRef: l.experience?.external_ref ?? null,
        sourceNotes: l.experience?.source_notes ?? null,
      },
    })),
  };
}

// ---------------------------------------------------------------------------
// Reflections (bounded)
// ---------------------------------------------------------------------------

/**
 * Load a bounded set of the user's most recent reflections (newest first).
 * These may be user-authored (USER_FACT) or companion-authored
 * (AI_INTERPRETATION); the planner labels trust accordingly.
 */
export async function loadReflectionsForRetrieval(userId: string): Promise<Reflection[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from(REFLECTIONS_TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("reflected_at", { ascending: false })
      .limit(CONTEXT_BUDGET.reflections);
    if (error || !data) return [];
    return (data as unknown as ReflectionRow[]).map((r) => ({
      id: r.id,
      userId: r.user_id,
      memoryId: r.memory_id,
      author: r.author,
      body: r.body,
      reflectedAt: r.reflected_at,
      createdAt: r.created_at,
      sourceContext: r.source_context,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Patterns (bounded, active)
// ---------------------------------------------------------------------------

/**
 * Load a bounded set of the user's active patterns (newest first) with
 * evidence. Pattern interpretation (if present) is AI_INTERPRETATION; evidence
 * is DERIVED. The planner labels accordingly.
 */
export async function loadPatternsForRetrieval(userId: string): Promise<Pattern[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from(PATTERNS_TABLE)
      .select("*")
      .eq("user_id", userId)
      .neq("status", "dismissed")
      .order("created_at", { ascending: false })
      .limit(CONTEXT_BUDGET.patterns);
    if (error || !data) return [];

    const rows = data as unknown as PatternRow[];
    const out: Pattern[] = [];
    for (const row of rows) {
      const evidence = await loadPatternEvidenceForRetrieval(userId, row.id);
      out.push(rowToPattern(row, evidence));
    }
    return out;
  } catch {
    return [];
  }
}

async function loadPatternEvidenceForRetrieval(
  userId: string,
  patternId: string,
): Promise<{ memoryId: string; evidenceRole: string | null }[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from(PATTERN_MEMORIES_TABLE)
      .select("memory_id, evidence_role")
      .eq("pattern_id", patternId)
      .eq("user_id", userId);
    if (error || !data) return [];
    return (data as unknown as Array<{ memory_id: string; evidence_role: string | null }>).map(
      (r) => ({ memoryId: r.memory_id, evidenceRole: r.evidence_role }),
    );
  } catch {
    return [];
  }
}

function rowToPattern(
  row: PatternRow,
  evidence: { memoryId: string; evidenceRole: string | null }[],
): Pattern {
  return {
    id: row.id,
    userId: row.user_id,
    patternType: row.pattern_type,
    title: row.title,
    summary: row.summary,
    confidence: Number(row.confidence),
    observedFrom: row.observed_from,
    observedTo: row.observed_to,
    status: row.status,
    fingerprint: row.fingerprint,
    evidenceCount: row.evidence_count,
    evidence: evidence.map((e) => ({ memoryId: e.memoryId, evidenceRole: e.evidenceRole })),
    interpretation: row.interpretation,
    interpretationModel: row.interpretation_model,
    interpretationPromptVersion: row.interpretation_prompt_version,
    interpretationCreatedAt: row.interpretation_created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Events + Chapters (bounded)
// ---------------------------------------------------------------------------

export async function loadEventsForRetrieval(userId: string): Promise<LifeEvent[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from(EVENTS_TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(CONTEXT_BUDGET.events);
    if (error || !data) return [];
    return (
      data as unknown as Array<{
        id: string;
        user_id: string;
        title: string;
        description: string | null;
        start_at: string | null;
        end_at: string | null;
        time_precision: string;
        time_label: string | null;
        location: string | null;
        status: string;
        created_at: string;
        updated_at: string;
      }>
    ).map((e) => ({
      id: e.id,
      userId: e.user_id,
      title: e.title,
      description: e.description,
      startAt: e.start_at,
      endAt: e.end_at,
      timePrecision: e.time_precision as never,
      timeLabel: e.time_label,
      location: e.location,
      status: e.status as never,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    }));
  } catch {
    return [];
  }
}

export async function loadChaptersForRetrieval(userId: string): Promise<LifeChapter[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from(CHAPTERS_TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(CONTEXT_BUDGET.chapters);
    if (error || !data) return [];
    return (
      data as unknown as Array<{
        id: string;
        user_id: string;
        title: string;
        description: string | null;
        start_at: string | null;
        end_at: string | null;
        time_precision: string;
        time_label: string | null;
        status: string;
        created_at: string;
        updated_at: string;
      }>
    ).map((c) => ({
      id: c.id,
      userId: c.user_id,
      title: c.title,
      description: c.description,
      startAt: c.start_at,
      endAt: c.end_at,
      timePrecision: c.time_precision as never,
      timeLabel: c.time_label,
      status: c.status as never,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  } catch {
    return [];
  }
}
