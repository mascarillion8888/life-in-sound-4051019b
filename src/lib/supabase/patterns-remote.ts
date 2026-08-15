/**
 * Pattern Engine persistence layer.
 *
 * Coordinates Supabase for the Pattern Engine tables (patterns +
 * pattern_memories). Mirrors the safety conventions of memory-remote.ts:
 *   - Only the browser anon client is used (see supabase/client.ts).
 *   - All rows are owned by the authenticated user and gated by RLS.
 *   - Failures are contained: functions return null / empty / error results
 *     rather than throwing into the UI.
 *   - Cross-user access fails safely (returns null/empty, leaks no existence).
 *
 * AI/user separation:
 *   - Deterministic evidence lives in pattern_memories (queryable), NOT as an
 *     opaque blob. patterns.evidence_count is denormalized for display.
 *   - AI interpretation fields (interpretation, interpretation_model, etc.) are
 *     a SEPARATE layer, NULL until generated, and NEVER modify memories,
 *     reflections, music_experiences, or pattern evidence.
 *   - The deterministic discovery engine (patterns.ts) is pure and is invoked
 *     here only to gather candidates; persistence is explicit.
 */
import { getSupabase } from "./client";
import { discoverPatterns } from "@/lib/memory/patterns";
import type {
  Memory,
  Pattern,
  PatternCandidate,
  PatternEvidence,
  PatternRelatedMemory,
  Reflection,
} from "@/lib/memory/types";
import type { PatternMemoryRow, PatternRow } from "./types";
import { listMemories, listReflections, loadMemory } from "./memory-remote";

const PATTERNS_TABLE = "patterns";
const PATTERN_MEMORIES_TABLE = "pattern_memories";
const CREATE_PATTERN_RPC = "create_pattern_atomic";

export type CreatePatternResult = { patternId: string } | { error: string };

/**
 * Persist a discovered pattern candidate + its evidence atomically. The
 * `create_pattern_atomic` RPC verifies every evidence memory belongs to the
 * caller before inserting. Duplicate fingerprints are rejected by the unique
 * index; the caller gets a clear error.
 */
export async function createPattern(
  userId: string,
  candidate: PatternCandidate,
): Promise<CreatePatternResult> {
  if (candidate.evidence.length === 0) {
    return { error: "a pattern requires at least one evidence memory" };
  }

  const client = getSupabase();
  if (!client) return { error: "supabase unavailable" };

  try {
    const { data, error } = await client.rpc(CREATE_PATTERN_RPC, {
      p_user_id: userId,
      p_pattern_type: candidate.patternType,
      p_title: candidate.title,
      p_summary: candidate.summary,
      p_confidence: candidate.confidence,
      p_observed_from: candidate.observedFrom,
      p_observed_to: candidate.observedTo,
      p_status: "candidate",
      p_fingerprint: candidate.fingerprint,
      p_evidence_count: candidate.evidenceCount,
      p_evidence: candidate.evidence.map((e) => ({
        memory_id: e.memoryId,
        evidence_role: e.evidenceRole ?? "",
      })),
    });

    if (error) {
      const msg = String(error.message ?? "");
      if (msg.includes("cross-user") || msg.includes("not found")) {
        return { error: "evidence memory not accessible" };
      }
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return { error: "pattern already exists" };
      }
      return { error: "pattern creation failed" };
    }
    if (!data) return { error: "pattern creation failed" };
    return { patternId: String(data) };
  } catch {
    return { error: "pattern creation failed" };
  }
}

/**
 * List the user's patterns, optionally filtered by status. Excludes dismissed
 * by default so dismissed patterns do not reappear. Evidence is loaded per
 * pattern via listPatternEvidence.
 */
export async function listPatterns(userId: string, includeDismissed = false): Promise<Pattern[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    let query = client
      .from(PATTERNS_TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!includeDismissed) {
      query = query.neq("status", "dismissed");
    }
    const { data, error } = await query;
    if (error || !data) return [];

    const rows = data as unknown as PatternRow[];
    const out: Pattern[] = [];
    for (const row of rows) {
      const evidence = await listPatternEvidence(userId, row.id);
      out.push(rowToPattern(row, evidence));
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Load a single pattern (owned by the user) with its evidence. Returns null on
 * not-found / cross-user (safe, leaks no existence).
 */
export async function loadPattern(userId: string, patternId: string): Promise<Pattern | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from(PATTERNS_TABLE)
      .select("*")
      .eq("id", patternId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as unknown as PatternRow;
    const evidence = await listPatternEvidence(userId, patternId);
    return rowToPattern(row, evidence);
  } catch {
    return null;
  }
}

/**
 * Dismiss a pattern (set status='dismissed'). Does NOT delete the pattern or
 * its evidence — dismissal is not deletion. Dismissed patterns do not
 * repeatedly reappear (excluded from default listPatterns).
 */
export async function dismissPattern(userId: string, patternId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client
      .from(PATTERNS_TABLE)
      .update({ status: "dismissed", updated_at: new Date().toISOString() })
      .eq("id", patternId)
      .eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Delete a pattern (and its evidence via cascade). Deleting a pattern NEVER
 * deletes the underlying memories — pattern_memories cascades to itself, not
 * back to memories.
 */
export async function deletePattern(userId: string, patternId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client
      .from(PATTERNS_TABLE)
      .delete()
      .eq("id", patternId)
      .eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * List evidence (pattern_memories rows) for a pattern. Owned by the user.
 */
export async function listPatternEvidence(
  userId: string,
  patternId: string,
): Promise<PatternEvidence[]> {
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
      (r) => ({
        memoryId: r.memory_id,
        evidenceRole: r.evidence_role,
      }),
    );
  } catch {
    return [];
  }
}

/**
 * Load the related (evidence) memories for a pattern with display data. Only
 * owned memories are returned (RLS-enforced). Used by the Pattern UI to show
 * "Based on N of your memories" and let the user open them.
 */
export async function loadPatternRelatedMemories(
  userId: string,
  patternId: string,
): Promise<PatternRelatedMemory[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const evidence = await listPatternEvidence(userId, patternId);
    if (evidence.length === 0) return [];

    const memoryIds = evidence.map((e) => e.memoryId);

    // Load owned memories (RLS + .eq user_id).
    const { data: memRows } = await client
      .from("memories")
      .select("id, original_user_note, user_note, event_time_label")
      .in("id", memoryIds)
      .eq("user_id", userId);
    type MemSubset = {
      id: string;
      original_user_note: string | null;
      user_note: string | null;
      event_time_label: string | null;
    };
    const memMap = new Map<string, MemSubset>();
    for (const m of (memRows ?? []) as MemSubset[]) memMap.set(m.id, m);

    // Load bridge + experiences for titles.
    const { data: bridgeRows } = await client
      .from("memory_music_experiences")
      .select("memory_id, music_experience_id, position")
      .in("memory_id", memoryIds)
      .eq("user_id", userId)
      .order("position", { ascending: true });
    type BridgeSubset = {
      memory_id: string;
      music_experience_id: string;
      position: number;
    };
    const expIds = (bridgeRows ?? []).map((r: BridgeSubset) => r.music_experience_id);
    let experiences: Array<{ id: string; title: string | null; artist: string | null }> = [];
    if (expIds.length > 0) {
      const { data: expRows } = await client
        .from("music_experiences")
        .select("id, title, artist")
        .in("id", expIds);
      experiences = (expRows ?? []) as Array<{
        id: string;
        title: string | null;
        artist: string | null;
      }>;
    }

    // Build per-memory title from the lowest-position experience.
    const titleByMemory = new Map<string, string>();
    const byMemory = new Map<string, BridgeSubset[]>();
    for (const b of (bridgeRows ?? []) as BridgeSubset[]) {
      const arr = byMemory.get(b.memory_id) ?? [];
      arr.push(b);
      byMemory.set(b.memory_id, arr);
    }
    for (const [mid, bridges] of byMemory) {
      const first = bridges.sort((a, b) => a.position - b.position)[0];
      const exp = experiences.find((e) => e.id === first?.music_experience_id);
      const label =
        [exp?.title, exp?.artist].filter((p) => p && p.trim().length > 0).join(" — ") ||
        "Untitled memory";
      titleByMemory.set(mid, label);
    }

    return evidence.map((e) => {
      const mem = memMap.get(e.memoryId);
      const note = mem?.user_note ?? mem?.original_user_note ?? "";
      return {
        memoryId: e.memoryId,
        evidenceRole: e.evidenceRole,
        title: titleByMemory.get(e.memoryId) ?? "Untitled memory",
        excerpt: excerpt(note),
        eventTimeLabel: mem?.event_time_label ?? null,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Discover deterministic pattern candidates for the user (preview). Does NOT
 * persist. Gathers the user's memories + reflections, runs the pure discovery
 * engine, and returns candidates. The caller (UI) decides whether to persist.
 *
 * Optionally filters out candidates whose fingerprint already matches a
 * persisted pattern, so the UI doesn't re-offer existing patterns.
 */
export async function discoverPatternCandidates(userId: string): Promise<PatternCandidate[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const memories = await listMemories(userId);
    // Load reflections for all memories (for revisited_memory).
    const reflectionLists = await Promise.all(memories.map((m) => listReflections(userId, m.id)));
    const reflections: Reflection[] = reflectionLists.flat();

    const candidates = discoverPatterns(memories, reflections);

    // Filter out fingerprints that already exist as non-dismissed patterns.
    const existing = await listPatterns(userId, false);
    const existingFingerprints = new Set(existing.map((p) => p.fingerprint));
    return candidates.filter((c) => !existingFingerprints.has(c.fingerprint));
  } catch {
    return [];
  }
}

/**
 * Persist the AI interpretation for a pattern. Writes ONLY to the
 * interpretation_* fields. Never touches memories, reflections, music
 * experiences, or pattern evidence. Owned by the user (RLS + .eq user_id).
 */
export async function savePatternInterpretation(
  userId: string,
  patternId: string,
  interpretation: string,
  model: string,
  promptVersion: string,
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client
      .from(PATTERNS_TABLE)
      .update({
        interpretation,
        interpretation_model: model,
        interpretation_prompt_version: promptVersion,
        interpretation_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", patternId)
      .eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToPattern(row: PatternRow, evidence: PatternEvidence[]): Pattern {
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
    evidence,
    interpretation: row.interpretation,
    interpretationModel: row.interpretation_model,
    interpretationPromptVersion: row.interpretation_prompt_version,
    interpretationCreatedAt: row.interpretation_created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function excerpt(note: string | null, max = 90): string {
  if (!note) return "";
  const trimmed = note.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

// Re-export the pure discovery engine + memory loader for convenience so UI
// code can import from one place. (No logic duplication.)
export { discoverPatterns, loadMemory };
