/**
 * Music Memory persistence layer.
 *
 * Coordinates Supabase (source of truth) for the four Music Memory tables.
 * Mirrors the safety conventions of journey-remote.ts:
 *   - Only the browser anon client is used (see supabase/client.ts).
 *   - All rows are owned by the authenticated user and gated by RLS.
 *   - No service-role credentials ever reach the browser.
 *   - Failures are contained: persistence functions return `null` / empty
 *     results rather than throwing into the UI.
 *
 * Atomic Memory creation is backed by the `create_memory_atomic` Postgres
 * function (migration 0002), so a Memory + all its bridge rows are inserted in
 * a single DB transaction — no half-created Memory. Cross-user Music Experience
 * references are rejected both here (pre-check) and in the DB function.
 *
 * AI/user separation:
 *   - `original_user_note` is never writable through updateMemory (DB trigger
 *     also enforces immutability).
 *   - `user_note` is the editable current text.
 *   - When user-confirmed source fields change, prior `ai_context` is marked
 *     stale (`ai_context_stale_at = now()`) rather than blindly erased, so it
 *     can be regenerated and is never presented as current truth.
 */
import { getSupabase } from "./client";
import {
  connectionKey,
  discoverDeterministicConnections,
  normalizePair,
} from "@/lib/memory/connections";
import type {
  ConnectionAdd,
  ConnectionType,
  DiscoveredConnection,
  Memory,
  MemoryCapture,
  MemoryConnection,
  MemoryUpdate,
  MusicExperience,
  RelatedMemory,
  Reflection,
  ReflectionAdd,
} from "@/lib/memory/types";
import type {
  MemoryConnectionRow,
  MemoryRow,
  MusicExperienceInsert,
  MusicExperienceRow,
  ReflectionInsert,
  ReflectionRow,
} from "./types";

const MEMORIES_TABLE = "memories";
const EXPERIENCES_TABLE = "music_experiences";
const BRIDGE_TABLE = "memory_music_experiences";
const REFLECTIONS_TABLE = "reflections";
const CREATE_MEMORY_RPC = "create_memory_atomic";

export type CreateMemoryResult = { memoryId: string } | { error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A Supabase client shape narrowed to what this module uses. */
type Client = NonNullable<ReturnType<typeof getSupabase>>;

function toMemoryInsert(row: {
  userNote?: string | null;
  feeling?: string | null;
  lifeEvent?: string | null;
  location?: string | null;
  weather?: string | null;
  eventTime?: MemoryCapture["eventTime"];
  recordedAt?: string;
}) {
  return {
    user_note: row.userNote ?? null,
    original_note: row.userNote ?? null,
    feeling: row.feeling ?? null,
    life_event: row.lifeEvent ?? null,
    location: row.location ?? null,
    weather: row.weather ?? null,
    event_granularity: row.eventTime?.granularity ?? null,
    event_start: row.eventTime?.start ?? null,
    event_end: row.eventTime?.end ?? null,
    event_label: row.eventTime?.label ?? null,
    recorded_at: row.recordedAt ?? new Date().toISOString(),
  };
}

function rowToMemory(
  row: MemoryRow,
  links: Array<{
    bridge: {
      memory_id: string;
      music_experience_id: string;
      position: number;
      role: string | null;
    };
    experience: MusicExperienceRow | null;
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
    aiContext: row.ai_context,
    aiContextStaleAt: row.ai_context_stale_at,
    musicExperiences: links
      .filter((l) => l.experience !== null)
      .sort((a, b) => a.bridge.position - b.bridge.position)
      .map((l) => ({
        musicExperienceId: l.bridge.music_experience_id,
        position: l.bridge.position,
        role: l.bridge.role,
        experience: {
          id: l.experience!.id,
          sourceType: l.experience!.source_type,
          title: l.experience!.title,
          artist: l.experience!.artist,
          album: l.experience!.album,
          externalRef: l.experience!.external_ref,
          sourceNotes: l.experience!.source_notes,
        },
      })),
  };
}

function experienceToInsert(userId: string, exp: MusicExperience): MusicExperienceInsert {
  return {
    user_id: userId,
    source_type: exp.sourceType,
    title: exp.title ?? null,
    artist: exp.artist ?? null,
    album: exp.album ?? null,
    external_ref: exp.externalRef ?? null,
    source_notes: exp.sourceNotes ?? null,
  };
}

/**
 * Resolve a list of input Music Experiences into concrete owned rows.
 * - If an experience has an `id`, it is read back and verified to belong to the
 *   user. A mismatch (cross-user) aborts the whole create with an error.
 * - If an experience has no `id`, it is inserted as a new owned row.
 * Returns the resolved experience ids in input order, or null on failure.
 */
async function resolveExperiences(
  client: Client,
  userId: string,
  experiences: MusicExperience[],
): Promise<{ ids: string[]; error?: string } | null> {
  const ids: string[] = [];

  for (const exp of experiences) {
    if (exp.id) {
      const { data, error } = await client
        .from(EXPERIENCES_TABLE)
        .select("id, user_id")
        .eq("id", exp.id)
        .maybeSingle();

      if (error) return null;
      if (!data) return { ids: [], error: "music experience not found" };
      if ((data as { user_id: string }).user_id !== userId) {
        return { ids: [], error: "cross-user music experience reference" };
      }
      ids.push(exp.id);
    } else {
      const insert = experienceToInsert(userId, exp);
      const { data, error } = await client
        .from(EXPERIENCES_TABLE)
        .insert(insert)
        .select("id")
        .single();

      if (error || !data) return null;
      ids.push((data as { id: string }).id);
    }
  }

  return { ids };
}

// ---------------------------------------------------------------------------
// createMemory — atomic
// ---------------------------------------------------------------------------

/**
 * Create a Memory with one or more Music Experiences atomically.
 *
 * Contract: either the Memory + ALL bridge rows are created, or nothing is
 * created (no half-created Memory). Backed by the `create_memory_atomic` RPC,
 * which runs memory + bridge inserts in a single Postgres transaction.
 *
 * Cross-user Music Experience references are rejected (pre-check here +
 * DB-level check in the RPC).
 */
export async function createMemory(
  userId: string,
  capture: MemoryCapture,
): Promise<CreateMemoryResult> {
  if (!capture.musicExperiences || capture.musicExperiences.length === 0) {
    return { error: "a memory requires at least one music experience" };
  }

  const client = getSupabase();
  if (!client) return { error: "supabase unavailable" };

  // 1. Resolve + verify/create all Music Experiences first.
  const resolved = await resolveExperiences(client, userId, capture.musicExperiences);
  if (resolved === null) return { error: "failed to resolve music experiences" };
  if (resolved.error) return { error: resolved.error };
  if (resolved.ids.length === 0) {
    return { error: "a memory requires at least one music experience" };
  }

  // 2. Build the bridge links payload.
  const links = resolved.ids.map((expId, i) => ({
    music_experience_id: expId,
    position: i,
    role: null as string | null,
  }));

  // 3. Call the atomic RPC (single transaction: memory + all bridge rows).
  const memo = toMemoryInsert(capture);
  try {
    const { data, error } = await client.rpc(CREATE_MEMORY_RPC, {
      p_user_id: userId,
      p_recorded_at: memo.recorded_at,
      p_original_note: memo.original_note,
      p_user_note: memo.user_note,
      p_feeling: memo.feeling,
      p_life_event: memo.life_event,
      p_location: memo.location,
      p_weather: memo.weather,
      p_event_granularity: memo.event_granularity,
      p_event_start: memo.event_start,
      p_event_end: memo.event_end,
      p_event_label: memo.event_label,
      p_links: links,
    });

    if (error || !data) return { error: "atomic memory creation failed" };
    return { memoryId: String(data) };
  } catch {
    return { error: "atomic memory creation failed" };
  }
}

// ---------------------------------------------------------------------------
// loadMemory
// ---------------------------------------------------------------------------

/** Load a single Memory with its Experiences, or null if not found/not owned. */
export async function loadMemory(userId: string, memoryId: string): Promise<Memory | null> {
  const client = getSupabase();
  if (!client) return null;

  try {
    const { data: mem, error } = await client
      .from(MEMORIES_TABLE)
      .select("*")
      .eq("id", memoryId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !mem) return null;

    const { data: bridgeRows } = await client
      .from(BRIDGE_TABLE)
      .select("memory_id, music_experience_id, position, role")
      .eq("memory_id", memoryId)
      .eq("user_id", userId);

    type BridgeSubset = {
      memory_id: string;
      music_experience_id: string;
      position: number;
      role: string | null;
    };

    const expIds = (bridgeRows ?? []).map((r: BridgeSubset) => r.music_experience_id);
    let experiences: MusicExperienceRow[] = [];
    if (expIds.length > 0) {
      const { data: expRows } = await client.from(EXPERIENCES_TABLE).select("*").in("id", expIds);
      experiences = (expRows ?? []) as unknown as MusicExperienceRow[];
    }

    const links = (bridgeRows ?? []).map((bridge: BridgeSubset) => ({
      bridge: {
        memory_id: bridge.memory_id,
        music_experience_id: bridge.music_experience_id,
        position: bridge.position,
        role: bridge.role,
      },
      experience: experiences.find((e) => e.id === bridge.music_experience_id) ?? null,
    }));

    return rowToMemory(mem as unknown as MemoryRow, links);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// listMemories
// ---------------------------------------------------------------------------

/** List the user's Memories (newest-recorded first), with their Experiences. */
export async function listMemories(userId: string): Promise<Memory[]> {
  const client = getSupabase();
  if (!client) return [];

  try {
    const { data: mems, error } = await client
      .from(MEMORIES_TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: false });

    if (error || !mems) return [];

    const memoryIds = (mems as unknown as MemoryRow[]).map((m) => m.id);
    if (memoryIds.length === 0) return [];

    const { data: bridgeRows } = await client
      .from(BRIDGE_TABLE)
      .select("*")
      .in("memory_id", memoryIds)
      .eq("user_id", userId);

    type BridgeRow = {
      memory_id: string;
      music_experience_id: string;
      user_id: string;
      position: number;
      role: string | null;
    };

    const expIds = (bridgeRows ?? []).map((r: BridgeRow) => r.music_experience_id);
    let experiences: MusicExperienceRow[] = [];
    if (expIds.length > 0) {
      const { data: expRows } = await client.from(EXPERIENCES_TABLE).select("*").in("id", expIds);
      experiences = (expRows ?? []) as unknown as MusicExperienceRow[];
    }

    const linksByMemory = new Map<string, typeof links>();
    const links = (bridgeRows ?? []).map((bridge: BridgeRow) => ({
      bridge: {
        memory_id: bridge.memory_id,
        music_experience_id: bridge.music_experience_id,
        position: bridge.position,
        role: bridge.role,
      },
      experience: experiences.find((e) => e.id === bridge.music_experience_id) ?? null,
    }));
    for (const l of links) {
      const arr = linksByMemory.get(l.bridge.memory_id) ?? [];
      arr.push(l);
      linksByMemory.set(l.bridge.memory_id, arr);
    }

    return (mems as unknown as MemoryRow[]).map((m) =>
      rowToMemory(m, linksByMemory.get(m.id) ?? []),
    );
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// updateMemory
// ---------------------------------------------------------------------------

/**
 * Update a Memory's user-source fields.
 *
 * - `original_user_note` is NEVER touched (DB trigger also enforces this).
 * - `user_note` may change.
 * - AI must never write user-note fields through this function.
 * - When user-confirmed source data changes, prior `ai_context` is marked
 *   stale (`ai_context_stale_at = now()`), not erased, so it can be
 *   regenerated and is never presented as current truth.
 */
export async function updateMemory(
  userId: string,
  memoryId: string,
  update: MemoryUpdate,
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  const patch: Record<string, unknown> = {};
  if (update.userNote !== undefined) patch.user_note = update.userNote ?? null;
  if (update.feeling !== undefined) patch.feeling = update.feeling ?? null;
  if (update.lifeEvent !== undefined) patch.life_event = update.lifeEvent ?? null;
  if (update.location !== undefined) patch.location = update.location ?? null;
  if (update.weather !== undefined) patch.weather = update.weather ?? null;
  if (update.eventTime !== undefined) {
    patch.event_time_granularity = update.eventTime.granularity ?? null;
    patch.event_time_start = update.eventTime.start ?? null;
    patch.event_time_end = update.eventTime.end ?? null;
    patch.event_time_label = update.eventTime.label ?? null;
  }

  if (Object.keys(patch).length === 0) return true;

  // Any user-source change marks prior AI context stale (regenerable, not erased).
  patch.ai_context_stale_at = new Date().toISOString();

  try {
    const { error } = await client
      .from(MEMORIES_TABLE)
      .update(patch)
      .eq("id", memoryId)
      .eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// deleteMemory
// ---------------------------------------------------------------------------

/**
 * Delete a Memory: its bridge links and reflections cascade away; the Memory
 * row is deleted. Music Experiences are NOT deleted automatically (they are
 * independent, reusable, and may appear in other Memories).
 */
export async function deleteMemory(userId: string, memoryId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    // RLS + cascade: deleting the memory removes bridge rows and reflections
    // via ON DELETE CASCADE. Experiences are left intact.
    const { error } = await client
      .from(MEMORIES_TABLE)
      .delete()
      .eq("id", memoryId)
      .eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// addReflection
// ---------------------------------------------------------------------------

/** Add a reflection to a Memory. Append-only in v1 (no edit API). */
export async function addReflection(
  userId: string,
  reflection: ReflectionAdd,
): Promise<{ reflectionId: string } | { error: string }> {
  const client = getSupabase();
  if (!client) return { error: "supabase unavailable" };

  const insert: ReflectionInsert = {
    user_id: userId,
    memory_id: reflection.memoryId,
    author: reflection.author,
    body: reflection.body,
    source_context: reflection.sourceContext ?? null,
  };

  try {
    const { data, error } = await client
      .from(REFLECTIONS_TABLE)
      .insert(insert)
      .select("id")
      .single();

    if (error || !data) return { error: "reflection insert failed" };
    return { reflectionId: (data as { id: string }).id };
  } catch {
    return { error: "reflection insert failed" };
  }
}

// ---------------------------------------------------------------------------
// listReflections
// ---------------------------------------------------------------------------

/** List reflections for a Memory (newest-reflected first). */
export async function listReflections(userId: string, memoryId: string): Promise<Reflection[]> {
  const client = getSupabase();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from(REFLECTIONS_TABLE)
      .select("*")
      .eq("memory_id", memoryId)
      .eq("user_id", userId)
      .order("reflected_at", { ascending: false });

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
// Memory Connections (migration 0003)
// ---------------------------------------------------------------------------

const CONNECTIONS_TABLE = "memory_connections";
const CREATE_CONNECTION_RPC = "create_connection_atomic";

export type CreateConnectionResult = { connectionId: string } | { error: string };

/**
 * Create a connection between two owned memories. Atomic + ownership-verified
 * via the `create_connection_atomic` RPC. Rejects self-connections and
 * cross-user references at the DB level. Duplicate (same pair + type) is
 * rejected by the unique index; the caller gets a clear error.
 *
 * source = "user" for user-linked; "deterministic" for discovered facts;
 * "ai_suggested" for user-accepted AI suggestions (never auto-persisted).
 */
export async function createConnection(
  userId: string,
  add: ConnectionAdd,
): Promise<CreateConnectionResult> {
  if (!add.sourceMemoryId || !add.targetMemoryId) {
    return { error: "source and target memory ids are required" };
  }
  if (add.sourceMemoryId === add.targetMemoryId) {
    return { error: "self-connection rejected" };
  }

  const client = getSupabase();
  if (!client) return { error: "supabase unavailable" };

  const { sourceMemoryId, targetMemoryId } = normalizePair(add.sourceMemoryId, add.targetMemoryId);

  try {
    const { data, error } = await client.rpc(CREATE_CONNECTION_RPC, {
      p_user_id: userId,
      p_source_memory_id: sourceMemoryId,
      p_target_memory_id: targetMemoryId,
      p_connection_type: add.connectionType,
      p_source: add.source,
      p_confidence: add.confidence ?? 1.0,
      p_reason: add.reason ?? null,
      p_metadata: add.metadata ?? null,
    });

    if (error) {
      // Map common DB errors to friendly messages without leaking existence.
      const msg = String(error.message ?? "");
      if (msg.includes("self-connection")) return { error: "self-connection rejected" };
      if (msg.includes("cross-user") || msg.includes("not found")) {
        return { error: "memory not accessible" };
      }
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return { error: "connection already exists" };
      }
      return { error: "connection creation failed" };
    }
    if (!data) return { error: "connection creation failed" };
    return { connectionId: String(data) };
  } catch {
    return { error: "connection creation failed" };
  }
}

/**
 * Delete a connection owned by the user. RLS + the .eq("user_id") guard make
 * cross-user deletion a no-op (returns true, leaks no existence).
 */
export async function deleteConnection(userId: string, connectionId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client
      .from(CONNECTIONS_TABLE)
      .delete()
      .eq("id", connectionId)
      .eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * List all connections involving a memory (either as source or target),
 * owned by the user. Returns raw connection rows for discovery/UI joins.
 */
export async function listConnectionsForMemory(
  userId: string,
  memoryId: string,
): Promise<MemoryConnection[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    // Two queries (source or target) since the connection may be stored either
    // way; combine via an in() on memory_id against either column.
    const { data, error } = await client
      .from(CONNECTIONS_TABLE)
      .select("*")
      .eq("user_id", userId)
      .or(`source_memory_id.eq.${memoryId},target_memory_id.eq.${memoryId}`);

    if (error || !data) return [];
    return (data as unknown as MemoryConnectionRow[]).map(rowToConnection);
  } catch {
    return [];
  }
}

/**
 * Find related memories for a given memory: loads connections, then loads the
 * OTHER memory in each connection, returning display data (title, excerpt,
 * reason). Only owned memories are returned (RLS-enforced). Returns [] on any
 * failure so the UI degrades gracefully.
 */
export async function findRelatedMemories(
  userId: string,
  memoryId: string,
): Promise<RelatedMemory[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const connections = await listConnectionsForMemory(userId, memoryId);

    // De-duplicate the related memory ids (a pair may have multiple types).
    const relatedIds = Array.from(
      new Set(
        connections.map((c) =>
          c.sourceMemoryId === memoryId ? c.targetMemoryId : c.sourceMemoryId,
        ),
      ),
    );
    if (relatedIds.length === 0) return [];

    // Load the related memories (RLS: only owned rows return).
    const { data: memRows } = await client
      .from(MEMORIES_TABLE)
      .select("id, original_user_note, user_note, event_time_label")
      .in("id", relatedIds)
      .eq("user_id", userId);

    // Load bridge + experiences for titles (like listMemories does, scoped).
    const { data: bridgeRows } = await client
      .from(BRIDGE_TABLE)
      .select("memory_id, music_experience_id, position")
      .in("memory_id", relatedIds)
      .eq("user_id", userId)
      .order("position", { ascending: true });

    type BridgeSubset = {
      memory_id: string;
      music_experience_id: string;
      position: number;
    };

    const expIds = (bridgeRows ?? []).map((r: BridgeSubset) => r.music_experience_id);
    let experiences: MusicExperienceRow[] = [];
    if (expIds.length > 0) {
      const { data: expRows } = await client
        .from(EXPERIENCES_TABLE)
        .select("id, title, artist")
        .in("id", expIds);
      experiences = (expRows ?? []) as unknown as MusicExperienceRow[];
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

    type MemSubset = {
      id: string;
      original_user_note: string | null;
      user_note: string | null;
      event_time_label: string | null;
    };
    const memMap = new Map<string, MemSubset>();
    for (const m of (memRows ?? []) as MemSubset[]) memMap.set(m.id, m);

    return connections.map((c) => {
      const otherId = c.sourceMemoryId === memoryId ? c.targetMemoryId : c.sourceMemoryId;
      const mem = memMap.get(otherId);
      const note = mem?.user_note ?? mem?.original_user_note ?? "";
      return {
        memoryId: otherId,
        connectionId: c.id,
        connectionType: c.connectionType,
        connectionSource: c.source,
        reason: c.reason ?? connectionReasonLabel(c.connectionType),
        confidence: c.confidence,
        title: titleByMemory.get(otherId) ?? "Untitled memory",
        excerpt: excerpt(note),
        eventTimeLabel: mem?.event_time_label ?? null,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Discover deterministic connections for a memory against the user's other
 * memories, without persisting. Returns candidates the caller (UI/preview) can
 * choose to persist. Pure discovery logic lives in connections.ts; this method
 * gathers the inputs (the source memory + the user's other memories + the set
 * of already-persisted connection keys) so the pure function is testable in
 * isolation.
 */
export async function discoverDeterministicConnectionsForMemory(
  userId: string,
  memoryId: string,
): Promise<DiscoveredConnection[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const source = await loadMemory(userId, memoryId);
    if (!source) return [];
    const all = await listMemories(userId);
    const others = all.filter((m) => m.id !== memoryId);

    const persisted = await listConnectionsForMemory(userId, memoryId);
    const persistedKeys = new Set(
      persisted.map((c) => connectionKey(c.sourceMemoryId, c.targetMemoryId, c.connectionType)),
    );

    return discoverDeterministicConnections(source, others, persistedKeys);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Connection helpers
// ---------------------------------------------------------------------------

function rowToConnection(row: MemoryConnectionRow): MemoryConnection {
  return {
    id: row.id,
    userId: row.user_id,
    sourceMemoryId: row.source_memory_id,
    targetMemoryId: row.target_memory_id,
    connectionType: row.connection_type,
    source: row.source,
    confidence: Number(row.confidence),
    reason: row.reason,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

function connectionReasonLabel(type: ConnectionType): string {
  const labels: Record<ConnectionType, string> = {
    same_music: "Same song",
    same_location: "Same location",
    overlapping_time: "Overlapping period",
    user_linked: "Linked by you",
  };
  return labels[type];
}

function excerpt(note: string | null, max = 90): string {
  if (!note) return "";
  const trimmed = note.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}
