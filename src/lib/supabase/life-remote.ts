/**
 * Life Events + Life Chapters persistence layer.
 *
 * Coordinates Supabase for the Life Events/Chapters tables. Mirrors the safety
 * conventions of memory-remote.ts / patterns-remote.ts:
 *   - Only the browser anon client is used (see supabase/client.ts).
 *   - All rows are owned by the authenticated user and gated by RLS.
 *   - Failures are contained: functions return null / empty / error results
 *     rather than throwing into the UI.
 *   - Cross-user access fails safely (returns null/empty, leaks no existence).
 *
 * Memory-first invariants:
 *   - Memory remains the source of truth. Events/Chapters are user-owned
 *     organization/context layers and NEVER modify or delete Memories.
 *   - Attaching a Memory/Event to an Event/Chapter is atomic + ownership-verified
 *     via RPCs (attach_*_atomic) — a user can never attach another user's
 *     Memory/Event/Chapter.
 *   - Deleting an Event/Chapter removes only its relationship rows (FK cascade),
 *     never the referenced Memories/Events/Chapters.
 *   - AI may suggest structure but never silently create personal history;
 *     Events/Chapters are created only on explicit user Accept (handled in the
 *     UI/server-fn layer).
 */
import { getSupabase } from "./client";
import type {
  ChapterDetail,
  ChapterDirectMemory,
  ChapterEvent,
  EventDetail,
  EventMemory,
  LifeChapter,
  LifeChapterInput,
  LifeEvent,
  LifeEventInput,
} from "@/lib/memory/types";
import type {
  ChapterEventRow,
  ChapterMemoryRow,
  LifeChapterRow,
  LifeEventMemoryRow,
  LifeEventRow,
} from "./types";

const EVENTS_TABLE = "life_events";
const CHAPTERS_TABLE = "life_chapters";
const EVENT_MEMORIES_TABLE = "life_event_memories";
const CHAPTER_EVENTS_TABLE = "chapter_events";
const CHAPTER_MEMORIES_TABLE = "chapter_memories";
const MEMORIES_TABLE = "memories";
const BRIDGE_TABLE = "memory_music_experiences";
const EXPERIENCES_TABLE = "music_experiences";

export type LifeResult<T> = { data: T } | { error: string };

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function createEvent(
  userId: string,
  input: LifeEventInput,
): Promise<LifeResult<LifeEvent>> {
  if (!input.title || input.title.trim().length === 0) {
    return { error: "title is required" };
  }
  const client = getSupabase();
  if (!client) return { error: "supabase unavailable" };
  try {
    const row = {
      user_id: userId,
      title: input.title.trim(),
      description: input.description ?? null,
      start_at: input.startAt ?? null,
      end_at: input.endAt ?? null,
      time_precision: input.timePrecision ?? "unknown",
      time_label: input.timeLabel ?? null,
      location: input.location ?? null,
      status: input.status ?? "active",
    };
    const { data, error } = await client.from(EVENTS_TABLE).insert(row).select("*").single();
    if (error || !data) return { error: "event creation failed" };
    return { data: rowToEvent(data as unknown as LifeEventRow) };
  } catch {
    return { error: "event creation failed" };
  }
}

export async function listEvents(userId: string): Promise<LifeEvent[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from(EVENTS_TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("start_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return (data as unknown as LifeEventRow[]).map(rowToEvent);
  } catch {
    return [];
  }
}

export async function loadEvent(userId: string, eventId: string): Promise<EventDetail | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from(EVENTS_TABLE)
      .select("*")
      .eq("id", eventId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const event = rowToEvent(data as unknown as LifeEventRow);
    const memories = await loadEventMemories(userId, eventId);
    const chapters = await loadChaptersForEvent(userId, eventId);
    return { ...event, memories, chapters };
  } catch {
    return null;
  }
}

export async function updateEvent(
  userId: string,
  eventId: string,
  input: Partial<LifeEventInput>,
): Promise<LifeEvent | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.title !== undefined) {
      if (input.title.trim().length === 0) return null;
      patch.title = input.title.trim();
    }
    if (input.description !== undefined) patch.description = input.description;
    if (input.startAt !== undefined) patch.start_at = input.startAt;
    if (input.endAt !== undefined) patch.end_at = input.endAt;
    if (input.timePrecision !== undefined) patch.time_precision = input.timePrecision;
    if (input.timeLabel !== undefined) patch.time_label = input.timeLabel;
    if (input.location !== undefined) patch.location = input.location;
    if (input.status !== undefined) patch.status = input.status;

    const { data, error } = await client
      .from(EVENTS_TABLE)
      .update(patch)
      .eq("id", eventId)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    if (error || !data) return null;
    return rowToEvent(data as unknown as LifeEventRow);
  } catch {
    return null;
  }
}

export async function deleteEvent(userId: string, eventId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client
      .from(EVENTS_TABLE)
      .delete()
      .eq("id", eventId)
      .eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}

export async function attachMemoryToEvent(
  userId: string,
  eventId: string,
  memoryId: string,
  relationshipType: string | null = null,
  position = 0,
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client.rpc("attach_memory_to_event_atomic", {
      p_user_id: userId,
      p_event_id: eventId,
      p_memory_id: memoryId,
      p_relationship_type: relationshipType,
      p_position: position,
    });
    if (error) return false;
    return true;
  } catch {
    return false;
  }
}

export async function detachMemoryFromEvent(
  userId: string,
  eventId: string,
  memoryId: string,
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client
      .from(EVENT_MEMORIES_TABLE)
      .delete()
      .eq("event_id", eventId)
      .eq("memory_id", memoryId)
      .eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

export async function createChapter(
  userId: string,
  input: LifeChapterInput,
): Promise<LifeResult<LifeChapter>> {
  if (!input.title || input.title.trim().length === 0) {
    return { error: "title is required" };
  }
  const client = getSupabase();
  if (!client) return { error: "supabase unavailable" };
  try {
    const row = {
      user_id: userId,
      title: input.title.trim(),
      description: input.description ?? null,
      start_at: input.startAt ?? null,
      end_at: input.endAt ?? null,
      time_precision: input.timePrecision ?? "unknown",
      time_label: input.timeLabel ?? null,
      status: input.status ?? "active",
    };
    const { data, error } = await client.from(CHAPTERS_TABLE).insert(row).select("*").single();
    if (error || !data) return { error: "chapter creation failed" };
    return { data: rowToChapter(data as unknown as LifeChapterRow) };
  } catch {
    return { error: "chapter creation failed" };
  }
}

export async function listChapters(userId: string): Promise<LifeChapter[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from(CHAPTERS_TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("start_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return (data as unknown as LifeChapterRow[]).map(rowToChapter);
  } catch {
    return [];
  }
}

export async function loadChapter(
  userId: string,
  chapterId: string,
): Promise<ChapterDetail | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from(CHAPTERS_TABLE)
      .select("*")
      .eq("id", chapterId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const chapter = rowToChapter(data as unknown as LifeChapterRow);
    const events = await loadChapterEvents(userId, chapterId);
    const directMemories = await loadChapterDirectMemories(userId, chapterId);
    return { ...chapter, events, directMemories };
  } catch {
    return null;
  }
}

export async function updateChapter(
  userId: string,
  chapterId: string,
  input: Partial<LifeChapterInput>,
): Promise<LifeChapter | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.title !== undefined) {
      if (input.title.trim().length === 0) return null;
      patch.title = input.title.trim();
    }
    if (input.description !== undefined) patch.description = input.description;
    if (input.startAt !== undefined) patch.start_at = input.startAt;
    if (input.endAt !== undefined) patch.end_at = input.endAt;
    if (input.timePrecision !== undefined) patch.time_precision = input.timePrecision;
    if (input.timeLabel !== undefined) patch.time_label = input.timeLabel;
    if (input.status !== undefined) patch.status = input.status;

    const { data, error } = await client
      .from(CHAPTERS_TABLE)
      .update(patch)
      .eq("id", chapterId)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    if (error || !data) return null;
    return rowToChapter(data as unknown as LifeChapterRow);
  } catch {
    return null;
  }
}

export async function deleteChapter(userId: string, chapterId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client
      .from(CHAPTERS_TABLE)
      .delete()
      .eq("id", chapterId)
      .eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}

export async function attachEventToChapter(
  userId: string,
  chapterId: string,
  eventId: string,
  position = 0,
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client.rpc("attach_event_to_chapter_atomic", {
      p_user_id: userId,
      p_chapter_id: chapterId,
      p_event_id: eventId,
      p_position: position,
    });
    if (error) return false;
    return true;
  } catch {
    return false;
  }
}

export async function detachEventFromChapter(
  userId: string,
  chapterId: string,
  eventId: string,
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client
      .from(CHAPTER_EVENTS_TABLE)
      .delete()
      .eq("chapter_id", chapterId)
      .eq("event_id", eventId)
      .eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}

export async function attachMemoryToChapter(
  userId: string,
  chapterId: string,
  memoryId: string,
  position = 0,
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client.rpc("attach_memory_to_chapter_atomic", {
      p_user_id: userId,
      p_chapter_id: chapterId,
      p_memory_id: memoryId,
      p_position: position,
    });
    if (error) return false;
    return true;
  } catch {
    return false;
  }
}

export async function detachMemoryFromChapter(
  userId: string,
  chapterId: string,
  memoryId: string,
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client
      .from(CHAPTER_MEMORIES_TABLE)
      .delete()
      .eq("chapter_id", chapterId)
      .eq("memory_id", memoryId)
      .eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Relationship loaders (owner-scoped)
// ---------------------------------------------------------------------------

async function loadEventMemories(userId: string, eventId: string): Promise<EventMemory[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data: linkRows } = await client
      .from(EVENT_MEMORIES_TABLE)
      .select("memory_id, relationship_type, position")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .order("position", { ascending: true });
    const links = (linkRows ?? []) as Array<{
      memory_id: string;
      relationship_type: string | null;
      position: number;
    }>;
    if (links.length === 0) return [];
    const memoryIds = links.map((l) => l.memory_id);
    const { data: memRows } = await client
      .from(MEMORIES_TABLE)
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

    const titles = await loadMemoryTitles(userId, memoryIds);

    return links.map((l) => {
      const mem = memMap.get(l.memory_id);
      const note = mem?.user_note ?? mem?.original_user_note ?? "";
      return {
        memoryId: l.memory_id,
        relationshipType: l.relationship_type,
        position: l.position,
        title: titles.get(l.memory_id) ?? "Untitled memory",
        excerpt: excerpt(note),
        eventTimeLabel: mem?.event_time_label ?? null,
      };
    });
  } catch {
    return [];
  }
}

async function loadChaptersForEvent(
  userId: string,
  eventId: string,
): Promise<Array<{ chapterId: string; title: string }>> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data: linkRows } = await client
      .from(CHAPTER_EVENTS_TABLE)
      .select("chapter_id")
      .eq("event_id", eventId)
      .eq("user_id", userId);
    const ids = (linkRows ?? []) as Array<{ chapter_id: string }>;
    if (ids.length === 0) return [];
    const chapterIds = ids.map((l) => l.chapter_id);
    const { data: chRows } = await client
      .from(CHAPTERS_TABLE)
      .select("id, title")
      .in("id", chapterIds)
      .eq("user_id", userId);
    return ((chRows ?? []) as Array<{ id: string; title: string }>).map((c) => ({
      chapterId: c.id,
      title: c.title,
    }));
  } catch {
    return [];
  }
}

async function loadChapterEvents(userId: string, chapterId: string): Promise<ChapterEvent[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data: linkRows } = await client
      .from(CHAPTER_EVENTS_TABLE)
      .select("event_id, position")
      .eq("chapter_id", chapterId)
      .eq("user_id", userId)
      .order("position", { ascending: true });
    const links = (linkRows ?? []) as Array<{ event_id: string; position: number }>;
    if (links.length === 0) return [];
    const eventIds = links.map((l) => l.event_id);
    const { data: evRows } = await client
      .from(EVENTS_TABLE)
      .select("id, title, time_label, location")
      .in("id", eventIds)
      .eq("user_id", userId);
    type EvSubset = {
      id: string;
      title: string;
      time_label: string | null;
      location: string | null;
    };
    const evMap = new Map<string, EvSubset>();
    for (const e of (evRows ?? []) as EvSubset[]) evMap.set(e.id, e);

    // Count memories per event for display.
    const { data: countRows } = await client
      .from(EVENT_MEMORIES_TABLE)
      .select("event_id, memory_id")
      .in("event_id", eventIds)
      .eq("user_id", userId);
    const counts = new Map<string, number>();
    for (const r of (countRows ?? []) as Array<{ event_id: string; memory_id: string }>) {
      counts.set(r.event_id, (counts.get(r.event_id) ?? 0) + 1);
    }

    return links.map((l) => {
      const e = evMap.get(l.event_id);
      return {
        eventId: l.event_id,
        title: e?.title ?? "Untitled event",
        timeLabel: e?.time_label ?? null,
        location: e?.location ?? null,
        position: l.position,
        memoryCount: counts.get(l.event_id) ?? 0,
      };
    });
  } catch {
    return [];
  }
}

async function loadChapterDirectMemories(
  userId: string,
  chapterId: string,
): Promise<ChapterDirectMemory[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data: linkRows } = await client
      .from(CHAPTER_MEMORIES_TABLE)
      .select("memory_id, position")
      .eq("chapter_id", chapterId)
      .eq("user_id", userId)
      .order("position", { ascending: true });
    const links = (linkRows ?? []) as Array<{ memory_id: string; position: number }>;
    if (links.length === 0) return [];
    const memoryIds = links.map((l) => l.memory_id);
    const { data: memRows } = await client
      .from(MEMORIES_TABLE)
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

    const titles = await loadMemoryTitles(userId, memoryIds);

    return links.map((l) => {
      const mem = memMap.get(l.memory_id);
      const note = mem?.user_note ?? mem?.original_user_note ?? "";
      return {
        memoryId: l.memory_id,
        position: l.position,
        title: titles.get(l.memory_id) ?? "Untitled memory",
        excerpt: excerpt(note),
        eventTimeLabel: mem?.event_time_label ?? null,
      };
    });
  } catch {
    return [];
  }
}

/** Build memoryId -> display title from the lowest-position music experience. */
async function loadMemoryTitles(userId: string, memoryIds: string[]): Promise<Map<string, string>> {
  const client = getSupabase();
  const out = new Map<string, string>();
  if (!client || memoryIds.length === 0) return out;
  try {
    const { data: bridgeRows } = await client
      .from(BRIDGE_TABLE)
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
        .from(EXPERIENCES_TABLE)
        .select("id, title, artist")
        .in("id", expIds);
      experiences = (expRows ?? []) as Array<{
        id: string;
        title: string | null;
        artist: string | null;
      }>;
    }

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
      out.set(mid, label);
    }
    return out;
  } catch {
    return out;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToEvent(row: LifeEventRow): LifeEvent {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    startAt: row.start_at,
    endAt: row.end_at,
    timePrecision: row.time_precision,
    timeLabel: row.time_label,
    location: row.location,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToChapter(row: LifeChapterRow): LifeChapter {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    startAt: row.start_at,
    endAt: row.end_at,
    timePrecision: row.time_precision,
    timeLabel: row.time_label,
    status: row.status,
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

// Re-export row types for convenience.
export type { ChapterEventRow, ChapterMemoryRow, LifeChapterRow, LifeEventMemoryRow, LifeEventRow };
