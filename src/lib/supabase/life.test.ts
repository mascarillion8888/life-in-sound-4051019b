import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the Life Events + Life Chapters persistence layer.
 *
 * Scenarios covered (events 1-10, chapters 11-23, time 24-27, relationships
 * 28-30, security 37, plus AI-suggestion boundary 31-36).
 *
 * No real LLM calls. The Supabase client is a stateful fake; orchestra is mocked.
 */

// ---------------------------------------------------------------------------
// Module-level stubs so a single vi.mock factory can serve per-test fakes.
// ---------------------------------------------------------------------------
let runRoleImpl:
  ((role: string, msg: string, opts?: Record<string, unknown>) => Promise<string | null>) | null =
  null;

vi.mock("@/lib/llm/orchestra", () => ({
  runRole: (role: string, msg: string, opts?: Record<string, unknown>) =>
    runRoleImpl ? runRoleImpl(role, msg, opts) : Promise.resolve(null),
}));

type FakeEvent = {
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
};
type FakeChapter = {
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
};
type FakeEventMemory = {
  id: string;
  user_id: string;
  event_id: string;
  memory_id: string;
  relationship_type: string | null;
  position: number;
  created_at: string;
};
type FakeChapterEvent = {
  id: string;
  user_id: string;
  chapter_id: string;
  event_id: string;
  position: number;
  created_at: string;
};
type FakeChapterMemory = {
  id: string;
  user_id: string;
  chapter_id: string;
  memory_id: string;
  position: number;
  created_at: string;
};
type FakeMem = {
  id: string;
  user_id: string;
  original_user_note: string | null;
  user_note: string | null;
  event_time_label: string | null;
  experiences: Array<{ id: string; title: string | null; artist: string | null; position: number }>;
};

const store: {
  memories: Map<string, FakeMem>;
  events: FakeEvent[];
  chapters: FakeChapter[];
  eventMemories: FakeEventMemory[];
  chapterEvents: FakeChapterEvent[];
  chapterMemories: FakeChapterMemory[];
  nextId: number;
} = {
  memories: new Map(),
  events: [],
  chapters: [],
  eventMemories: [],
  chapterEvents: [],
  chapterMemories: [],
  nextId: 1,
};

let currentFake: SupabaseFake | null = null;

type FakeThenable = {
  select: (cols?: string) => FakeThenable;
  eq: (col: string, val: unknown) => FakeThenable;
  neq: (col: string, val: unknown) => FakeThenable;
  in: (col: string, vals: unknown[]) => FakeThenable;
  order: () => FakeThenable;
  single: () => Promise<{ data: unknown; error: unknown }>;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  then: (resolve: (v: unknown) => unknown) => unknown;
  insert: (row: Record<string, unknown>) => FakeThenable;
  update: (patch: Record<string, unknown>) => FakeThenable;
  delete: () => FakeThenable;
};

type SupabaseFake = {
  from: (table: string) => FakeThenable;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

vi.mock("./client", () => ({
  getSupabase: () => currentFake,
}));

vi.mock("./memory-remote", () => ({
  listMemories: async (userId: string) => {
    return Array.from(store.memories.values())
      .filter((m) => m.user_id === userId)
      .map((m) => ({
        id: m.id,
        userId: m.user_id,
        recordedAt: "2024-01-01T00:00:00Z",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
        originalUserNote: m.original_user_note,
        userNote: m.user_note,
        feeling: null,
        lifeEvent: null,
        location: null,
        weather: null,
        eventTime: { label: m.event_time_label },
        aiContext: null,
        aiContextStaleAt: null,
        musicExperiences: m.experiences.map((e) => ({
          musicExperienceId: e.id,
          position: e.position,
          role: null,
          experience: {
            id: e.id,
            sourceType: "streaming" as const,
            title: e.title,
            artist: e.artist,
            album: null,
            externalRef: null,
            sourceNotes: null,
          },
        })),
      }));
  },
  loadMemory: async (userId: string, memoryId: string) => {
    const m = store.memories.get(memoryId);
    if (!m || m.user_id !== userId) return null;
    return {
      id: m.id,
      userId: m.user_id,
      recordedAt: "2024-01-01T00:00:00Z",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      originalUserNote: m.original_user_note,
      userNote: m.user_note,
      feeling: null,
      lifeEvent: null,
      location: null,
      weather: null,
      eventTime: { label: m.event_time_label },
      aiContext: null,
      aiContextStaleAt: null,
      musicExperiences: m.experiences.map((e) => ({
        musicExperienceId: e.id,
        position: e.position,
        role: null,
        experience: {
          id: e.id,
          sourceType: "streaming" as const,
          title: e.title,
          artist: e.artist,
          album: null,
          externalRef: null,
          sourceNotes: null,
        },
      })),
    };
  },
}));

vi.mock("./patterns-remote", () => ({
  listPatterns: async () => [],
}));

import {
  attachEventToChapter,
  attachMemoryToChapter,
  attachMemoryToEvent,
  createChapter,
  createEvent,
  deleteChapter,
  deleteEvent,
  detachEventFromChapter,
  detachMemoryFromChapter,
  detachMemoryFromEvent,
  listChapters,
  listEvents,
  loadChapter,
  loadEvent,
  updateChapter,
  updateEvent,
} from "./life-remote";
import { suggestStructureLogic } from "@/lib/llm/suggestStructure.server";
import { parseSuggestStructureResponse } from "@/lib/llm/suggestStructure";

function makeFake(): SupabaseFake {
  const f: SupabaseFake = {
    from: (table: string) => {
      const eqs: Array<[string, unknown]> = [];
      const neqs: Array<[string, unknown]> = [];
      let pendingInsert: Record<string, unknown> | null = null;
      let pendingUpdate: Record<string, unknown> | null = null;
      let isDelete = false;
      const thenable: FakeThenable = {
        select: () => thenable,
        eq: (col, val) => {
          eqs.push([col, val]);
          return thenable;
        },
        neq: (col, val) => {
          neqs.push([col, val]);
          return thenable;
        },
        in: () => thenable,
        order: () => thenable,
        single: async () => {
          if (pendingInsert) {
            const row = insertRow(table, pendingInsert);
            return { data: row, error: null };
          }
          return { data: null, error: null };
        },
        maybeSingle: async () => {
          // single-row select by id + user_id, or update-returning.
          if (pendingUpdate) {
            const updated = applyUpdateSingle(table, eqs, pendingUpdate);
            return { data: updated, error: null };
          }
          if (table === "life_events") {
            const idEq = eqs.find(([c]) => c === "id");
            const userEq = eqs.find(([c]) => c === "user_id");
            const row = store.events.find(
              (e) => e.id === String(idEq?.[1]) && e.user_id === String(userEq?.[1]),
            );
            return { data: row ?? null, error: null };
          }
          if (table === "life_chapters") {
            const idEq = eqs.find(([c]) => c === "id");
            const userEq = eqs.find(([c]) => c === "user_id");
            const row = store.chapters.find(
              (c) => c.id === String(idEq?.[1]) && c.user_id === String(userEq?.[1]),
            );
            return { data: row ?? null, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve) => {
          if (isDelete) {
            applyDelete(table, eqs);
            return resolve({ data: null, error: null });
          }
          if (pendingUpdate) {
            applyUpdate(table, eqs, pendingUpdate);
            return resolve({ data: [pendingUpdate], error: null });
          }
          return resolve({ data: selectList(table, eqs, neqs), error: null });
        },
        insert: (row) => {
          pendingInsert = row;
          return thenable;
        },
        update: (patch) => {
          pendingUpdate = patch;
          return thenable;
        },
        delete: () => {
          isDelete = true;
          return thenable;
        },
      };
      return thenable;
    },
    rpc: async (name, args) => {
      const p = args ?? {};
      const userId = String(p.p_user_id);

      if (name === "attach_memory_to_event_atomic") {
        const eventId = String(p.p_event_id);
        const memoryId = String(p.p_memory_id);
        const ev = store.events.find((e) => e.id === eventId);
        if (!ev) return { data: null, error: { message: "event not found" } };
        if (ev.user_id !== userId) return { data: null, error: { message: "cross-user event" } };
        const m = store.memories.get(memoryId);
        if (!m) return { data: null, error: { message: "memory not found" } };
        if (m.user_id !== userId) return { data: null, error: { message: "cross-user memory" } };
        // Dedup.
        if (
          store.eventMemories.some((em) => em.event_id === eventId && em.memory_id === memoryId)
        ) {
          return { data: "ok", error: null };
        }
        store.eventMemories.push({
          id: `em-${store.nextId++}`,
          user_id: userId,
          event_id: eventId,
          memory_id: memoryId,
          relationship_type: (p.p_relationship_type as string | null) ?? null,
          position: (p.p_position as number) ?? 0,
          created_at: new Date().toISOString(),
        });
        return { data: "ok", error: null };
      }

      if (name === "attach_event_to_chapter_atomic") {
        const chapterId = String(p.p_chapter_id);
        const eventId = String(p.p_event_id);
        const ch = store.chapters.find((c) => c.id === chapterId);
        if (!ch) return { data: null, error: { message: "chapter not found" } };
        if (ch.user_id !== userId) return { data: null, error: { message: "cross-user chapter" } };
        const ev = store.events.find((e) => e.id === eventId);
        if (!ev) return { data: null, error: { message: "event not found" } };
        if (ev.user_id !== userId) return { data: null, error: { message: "cross-user event" } };
        if (
          store.chapterEvents.some((ce) => ce.chapter_id === chapterId && ce.event_id === eventId)
        ) {
          return { data: "ok", error: null };
        }
        store.chapterEvents.push({
          id: `ce-${store.nextId++}`,
          user_id: userId,
          chapter_id: chapterId,
          event_id: eventId,
          position: (p.p_position as number) ?? 0,
          created_at: new Date().toISOString(),
        });
        return { data: "ok", error: null };
      }

      if (name === "attach_memory_to_chapter_atomic") {
        const chapterId = String(p.p_chapter_id);
        const memoryId = String(p.p_memory_id);
        const ch = store.chapters.find((c) => c.id === chapterId);
        if (!ch) return { data: null, error: { message: "chapter not found" } };
        if (ch.user_id !== userId) return { data: null, error: { message: "cross-user chapter" } };
        const m = store.memories.get(memoryId);
        if (!m) return { data: null, error: { message: "memory not found" } };
        if (m.user_id !== userId) return { data: null, error: { message: "cross-user memory" } };
        if (
          store.chapterMemories.some(
            (cm) => cm.chapter_id === chapterId && cm.memory_id === memoryId,
          )
        ) {
          return { data: "ok", error: null };
        }
        store.chapterMemories.push({
          id: `cm-${store.nextId++}`,
          user_id: userId,
          chapter_id: chapterId,
          memory_id: memoryId,
          position: (p.p_position as number) ?? 0,
          created_at: new Date().toISOString(),
        });
        return { data: "ok", error: null };
      }

      return { data: null, error: { message: "unknown rpc" } };
    },
  };
  return f;
}

function selectList(
  table: string,
  eqs: Array<[string, unknown]>,
  neqs: Array<[string, unknown]>,
): unknown[] {
  const userEq = eqs.find(([c]) => c === "user_id");
  const uid = userEq ? String(userEq[1]) : null;
  if (table === "life_events") {
    const rows = store.events.filter((e) => !uid || e.user_id === uid);
    return applyNeq(rows, neqs);
  }
  if (table === "life_chapters") {
    const rows = store.chapters.filter((c) => !uid || c.user_id === uid);
    return applyNeq(rows, neqs);
  }
  if (table === "life_event_memories") {
    const eventEq = eqs.find(([c]) => c === "event_id");
    const rows = store.eventMemories.filter(
      (em) => (!uid || em.user_id === uid) && (!eventEq || em.event_id === String(eventEq[1])),
    );
    return rows;
  }
  if (table === "chapter_events") {
    const chapterEq = eqs.find(([c]) => c === "chapter_id");
    const eventEq = eqs.find(([c]) => c === "event_id");
    const rows = store.chapterEvents.filter(
      (ce) =>
        (!uid || ce.user_id === uid) &&
        (!chapterEq || ce.chapter_id === String(chapterEq[1])) &&
        (!eventEq || ce.event_id === String(eventEq[1])),
    );
    return rows;
  }
  if (table === "chapter_memories") {
    const chapterEq = eqs.find(([c]) => c === "chapter_id");
    const rows = store.chapterMemories.filter(
      (cm) =>
        (!uid || cm.user_id === uid) && (!chapterEq || cm.chapter_id === String(chapterEq[1])),
    );
    return rows;
  }
  if (table === "memories") {
    const inIds = eqs.find(([c]) => c === "id");
    const rows = Array.from(store.memories.values()).filter((m) => !uid || m.user_id === uid);
    return rows;
  }
  if (table === "memory_music_experiences") {
    const rows: Array<{ memory_id: string; music_experience_id: string; position: number }> = [];
    for (const m of store.memories.values()) {
      if (uid && m.user_id !== uid) continue;
      for (const e of m.experiences) {
        rows.push({ memory_id: m.id, music_experience_id: e.id, position: e.position });
      }
    }
    return rows;
  }
  if (table === "music_experiences") {
    const rows: Array<{ id: string; title: string | null; artist: string | null }> = [];
    for (const m of store.memories.values()) {
      for (const e of m.experiences) rows.push({ id: e.id, title: e.title, artist: e.artist });
    }
    return rows;
  }
  return [];
}

function applyNeq<T extends Record<string, unknown>>(
  rows: T[],
  neqs: Array<[string, unknown]>,
): T[] {
  for (const [col, val] of neqs) {
    rows = rows.filter((r) => r[col] !== val);
  }
  return rows;
}

function applyUpdate(table: string, eqs: Array<[string, unknown]>, patch: Record<string, unknown>) {
  const idEq = eqs.find(([c]) => c === "id");
  const userEq = eqs.find(([c]) => c === "user_id");
  if (table === "life_events" && idEq && userEq) {
    store.events = store.events.map((e) =>
      e.id === String(idEq[1]) && e.user_id === String(userEq[1]) ? { ...e, ...patch } : e,
    );
  }
  if (table === "life_chapters" && idEq && userEq) {
    store.chapters = store.chapters.map((c) =>
      c.id === String(idEq[1]) && c.user_id === String(userEq[1]) ? { ...c, ...patch } : c,
    );
  }
}

function applyUpdateSingle(
  table: string,
  eqs: Array<[string, unknown]>,
  patch: Record<string, unknown>,
): Record<string, unknown> | null {
  const idEq = eqs.find(([c]) => c === "id");
  const userEq = eqs.find(([c]) => c === "user_id");
  if (!idEq || !userEq) return null;
  if (table === "life_events") {
    const row = store.events.find(
      (e) => e.id === String(idEq[1]) && e.user_id === String(userEq[1]),
    );
    if (!row) return null;
    Object.assign(row, patch);
    return row as unknown as Record<string, unknown>;
  }
  if (table === "life_chapters") {
    const row = store.chapters.find(
      (c) => c.id === String(idEq[1]) && c.user_id === String(userEq[1]),
    );
    if (!row) return null;
    Object.assign(row, patch);
    return row as unknown as Record<string, unknown>;
  }
  return null;
}

function insertRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const id = `id-${store.nextId++}`;
  const now = new Date().toISOString();
  if (table === "life_events") {
    const full: FakeEvent = {
      id,
      user_id: String(row.user_id),
      title: String(row.title),
      description: (row.description as string | null) ?? null,
      start_at: (row.start_at as string | null) ?? null,
      end_at: (row.end_at as string | null) ?? null,
      time_precision: (row.time_precision as string) ?? "unknown",
      time_label: (row.time_label as string | null) ?? null,
      location: (row.location as string | null) ?? null,
      status: (row.status as string) ?? "active",
      created_at: now,
      updated_at: now,
    };
    store.events.push(full);
    return full as unknown as Record<string, unknown>;
  }
  if (table === "life_chapters") {
    const full: FakeChapter = {
      id,
      user_id: String(row.user_id),
      title: String(row.title),
      description: (row.description as string | null) ?? null,
      start_at: (row.start_at as string | null) ?? null,
      end_at: (row.end_at as string | null) ?? null,
      time_precision: (row.time_precision as string) ?? "unknown",
      time_label: (row.time_label as string | null) ?? null,
      status: (row.status as string) ?? "active",
      created_at: now,
      updated_at: now,
    };
    store.chapters.push(full);
    return full as unknown as Record<string, unknown>;
  }
  return row;
}

function applyDelete(table: string, eqs: Array<[string, unknown]>) {
  const idEq = eqs.find(([c]) => c === "id");
  const userEq = eqs.find(([c]) => c === "user_id");
  if (table === "life_events" && idEq && userEq) {
    const id = String(idEq[1]);
    store.events = store.events.filter((e) => !(e.id === id && e.user_id === String(userEq[1])));
    store.eventMemories = store.eventMemories.filter((em) => em.event_id !== id);
    store.chapterEvents = store.chapterEvents.filter((ce) => ce.event_id !== id);
  }
  if (table === "life_chapters" && idEq && userEq) {
    const id = String(idEq[1]);
    store.chapters = store.chapters.filter(
      (c) => !(c.id === id && c.user_id === String(userEq[1])),
    );
    store.chapterEvents = store.chapterEvents.filter((ce) => ce.chapter_id !== id);
    store.chapterMemories = store.chapterMemories.filter((cm) => cm.chapter_id !== id);
  }
  if (table === "life_event_memories") {
    const eventEq = eqs.find(([c]) => c === "event_id");
    const memEq = eqs.find(([c]) => c === "memory_id");
    const userEq2 = eqs.find(([c]) => c === "user_id");
    store.eventMemories = store.eventMemories.filter(
      (em) =>
        !(
          em.event_id === String(eventEq?.[1]) &&
          em.memory_id === String(memEq?.[1]) &&
          em.user_id === String(userEq2?.[1])
        ),
    );
  }
  if (table === "chapter_events") {
    const chapterEq = eqs.find(([c]) => c === "chapter_id");
    const eventEq = eqs.find(([c]) => c === "event_id");
    store.chapterEvents = store.chapterEvents.filter(
      (ce) => !(ce.chapter_id === String(chapterEq?.[1]) && ce.event_id === String(eventEq?.[1])),
    );
  }
  if (table === "chapter_memories") {
    const chapterEq = eqs.find(([c]) => c === "chapter_id");
    const memEq = eqs.find(([c]) => c === "memory_id");
    store.chapterMemories = store.chapterMemories.filter(
      (cm) => !(cm.chapter_id === String(chapterEq?.[1]) && cm.memory_id === String(memEq?.[1])),
    );
  }
}

beforeEach(() => {
  store.memories.clear();
  store.events = [];
  store.chapters = [];
  store.eventMemories = [];
  store.chapterEvents = [];
  store.chapterMemories = [];
  store.nextId = 1;
  currentFake = makeFake();
  runRoleImpl = null;
});

function seedMemory(id: string, userId: string, overrides: Partial<FakeMem> = {}): FakeMem {
  const m: FakeMem = {
    id,
    user_id: userId,
    original_user_note: "original note",
    user_note: "current note",
    event_time_label: null,
    experiences: [{ id: `exp-${id}`, title: `Song ${id}`, artist: `Artist ${id}`, position: 0 }],
    ...overrides,
  };
  store.memories.set(id, m);
  return m;
}

// ===========================================================================
// EVENTS
// ===========================================================================

describe("1. create owned Event", () => {
  it("creates an event owned by the user", async () => {
    const r = await createEvent("user-1", { title: "Moving to Istanbul" });
    expect("data" in r).toBe(true);
    if ("data" in r) expect(r.data.userId).toBe("user-1");
    expect(store.events).toHaveLength(1);
  });

  it("rejects an event with no title", async () => {
    const r = await createEvent("user-1", { title: "  " });
    expect("error" in r).toBe(true);
    expect(store.events).toHaveLength(0);
  });
});

describe("2. list only owned Events", () => {
  it("lists only the caller's events", async () => {
    await createEvent("user-1", { title: "A" });
    await createEvent("user-2", { title: "B" });
    const u1 = await listEvents("user-1");
    const u2 = await listEvents("user-2");
    expect(u1).toHaveLength(1);
    expect(u2).toHaveLength(1);
    expect(u1[0].title).toBe("A");
  });
});

describe("3. load owned Event", () => {
  it("loads an owned event with memories + chapters", async () => {
    seedMemory("m1", "user-1");
    const r = await createEvent("user-1", { title: "E" });
    if (!("data" in r)) throw new Error("fail");
    const ev = await loadEvent("user-1", r.data.id);
    expect(ev).not.toBeNull();
    expect(ev!.title).toBe("E");
    expect(ev!.memories).toEqual([]);
    expect(ev!.chapters).toEqual([]);
  });
});

describe("4. cross-user Event inaccessible", () => {
  it("returns null for another user's event", async () => {
    const r = await createEvent("user-1", { title: "E" });
    if (!("data" in r)) throw new Error("fail");
    const ev = await loadEvent("user-2", r.data.id);
    expect(ev).toBeNull();
  });
});

describe("5. update Event", () => {
  it("updates an owned event", async () => {
    const r = await createEvent("user-1", { title: "E" });
    if (!("data" in r)) throw new Error("fail");
    const updated = await updateEvent("user-1", r.data.id, { title: "E2", location: "Istanbul" });
    expect(updated?.title).toBe("E2");
    expect(updated?.location).toBe("Istanbul");
  });

  it("does not update another user's event", async () => {
    const r = await createEvent("user-1", { title: "E" });
    if (!("data" in r)) throw new Error("fail");
    const updated = await updateEvent("user-2", r.data.id, { title: "Hacked" });
    expect(updated).toBeNull();
    expect(store.events[0].title).toBe("E");
  });
});

describe("6. delete Event", () => {
  it("deletes an owned event", async () => {
    const r = await createEvent("user-1", { title: "E" });
    if (!("data" in r)) throw new Error("fail");
    const ok = await deleteEvent("user-1", r.data.id);
    expect(ok).toBe(true);
    expect(store.events).toHaveLength(0);
  });
});

describe("7. attach owned Memory to Event", () => {
  it("attaches an owned memory to an owned event", async () => {
    seedMemory("m1", "user-1");
    const r = await createEvent("user-1", { title: "E" });
    if (!("data" in r)) throw new Error("fail");
    const ok = await attachMemoryToEvent("user-1", r.data.id, "m1");
    expect(ok).toBe(true);
    expect(store.eventMemories).toHaveLength(1);
  });
});

describe("8. cross-user Memory rejected", () => {
  it("rejects attaching another user's memory", async () => {
    seedMemory("m1", "user-2");
    const r = await createEvent("user-1", { title: "E" });
    if (!("data" in r)) throw new Error("fail");
    const ok = await attachMemoryToEvent("user-1", r.data.id, "m1");
    expect(ok).toBe(false);
    expect(store.eventMemories).toHaveLength(0);
  });

  it("rejects attaching to another user's event", async () => {
    seedMemory("m1", "user-1");
    const r = await createEvent("user-2", { title: "E" });
    if (!("data" in r)) throw new Error("fail");
    const ok = await attachMemoryToEvent("user-1", r.data.id, "m1");
    expect(ok).toBe(false);
  });
});

describe("9. detach Memory from Event", () => {
  it("detaches an attached memory", async () => {
    seedMemory("m1", "user-1");
    const r = await createEvent("user-1", { title: "E" });
    if (!("data" in r)) throw new Error("fail");
    await attachMemoryToEvent("user-1", r.data.id, "m1");
    const ok = await detachMemoryFromEvent("user-1", r.data.id, "m1");
    expect(ok).toBe(true);
    expect(store.eventMemories).toHaveLength(0);
  });
});

describe("10. deleting Event does not delete Memory", () => {
  it("event deletion removes links but keeps the memory", async () => {
    seedMemory("m1", "user-1");
    const r = await createEvent("user-1", { title: "E" });
    if (!("data" in r)) throw new Error("fail");
    await attachMemoryToEvent("user-1", r.data.id, "m1");
    await deleteEvent("user-1", r.data.id);
    expect(store.events).toHaveLength(0);
    expect(store.eventMemories).toHaveLength(0);
    expect(store.memories.has("m1")).toBe(true);
  });
});

// ===========================================================================
// CHAPTERS
// ===========================================================================

describe("11. create owned Chapter", () => {
  it("creates a chapter owned by the user", async () => {
    const r = await createChapter("user-1", { title: "University Years" });
    expect("data" in r).toBe(true);
    expect(store.chapters).toHaveLength(1);
  });
});

describe("12. list only owned Chapters", () => {
  it("lists only the caller's chapters", async () => {
    await createChapter("user-1", { title: "A" });
    await createChapter("user-2", { title: "B" });
    expect(await listChapters("user-1")).toHaveLength(1);
    expect(await listChapters("user-2")).toHaveLength(1);
  });
});

describe("13. load owned Chapter", () => {
  it("loads an owned chapter with events + direct memories", async () => {
    const r = await createChapter("user-1", { title: "C" });
    if (!("data" in r)) throw new Error("fail");
    const ch = await loadChapter("user-1", r.data.id);
    expect(ch).not.toBeNull();
    expect(ch!.events).toEqual([]);
    expect(ch!.directMemories).toEqual([]);
  });
});

describe("14. update Chapter", () => {
  it("updates an owned chapter", async () => {
    const r = await createChapter("user-1", { title: "C" });
    if (!("data" in r)) throw new Error("fail");
    const updated = await updateChapter("user-1", r.data.id, { title: "C2", description: "d" });
    expect(updated?.title).toBe("C2");
    expect(updated?.description).toBe("d");
  });
});

describe("15. delete Chapter", () => {
  it("deletes an owned chapter", async () => {
    const r = await createChapter("user-1", { title: "C" });
    if (!("data" in r)) throw new Error("fail");
    const ok = await deleteChapter("user-1", r.data.id);
    expect(ok).toBe(true);
    expect(store.chapters).toHaveLength(0);
  });
});

describe("16. attach Event to Chapter", () => {
  it("attaches an owned event to an owned chapter", async () => {
    const er = await createEvent("user-1", { title: "E" });
    const cr = await createChapter("user-1", { title: "C" });
    if (!("data" in er) || !("data" in cr)) throw new Error("fail");
    const ok = await attachEventToChapter("user-1", cr.data.id, er.data.id);
    expect(ok).toBe(true);
    expect(store.chapterEvents).toHaveLength(1);
  });
});

describe("17. attach direct Memory to Chapter", () => {
  it("attaches an owned memory directly to a chapter", async () => {
    seedMemory("m1", "user-1");
    const cr = await createChapter("user-1", { title: "C" });
    if (!("data" in cr)) throw new Error("fail");
    const ok = await attachMemoryToChapter("user-1", cr.data.id, "m1");
    expect(ok).toBe(true);
    expect(store.chapterMemories).toHaveLength(1);
  });
});

describe("18. cross-user Event rejected", () => {
  it("rejects attaching another user's event to a chapter", async () => {
    const er = await createEvent("user-2", { title: "E" });
    const cr = await createChapter("user-1", { title: "C" });
    if (!("data" in er) || !("data" in cr)) throw new Error("fail");
    const ok = await attachEventToChapter("user-1", cr.data.id, er.data.id);
    expect(ok).toBe(false);
    expect(store.chapterEvents).toHaveLength(0);
  });
});

describe("19. cross-user Memory rejected (chapter)", () => {
  it("rejects attaching another user's memory to a chapter", async () => {
    seedMemory("m1", "user-2");
    const cr = await createChapter("user-1", { title: "C" });
    if (!("data" in cr)) throw new Error("fail");
    const ok = await attachMemoryToChapter("user-1", cr.data.id, "m1");
    expect(ok).toBe(false);
    expect(store.chapterMemories).toHaveLength(0);
  });
});

describe("20. detach Event", () => {
  it("detaches an event from a chapter", async () => {
    const er = await createEvent("user-1", { title: "E" });
    const cr = await createChapter("user-1", { title: "C" });
    if (!("data" in er) || !("data" in cr)) throw new Error("fail");
    await attachEventToChapter("user-1", cr.data.id, er.data.id);
    const ok = await detachEventFromChapter("user-1", cr.data.id, er.data.id);
    expect(ok).toBe(true);
    expect(store.chapterEvents).toHaveLength(0);
  });
});

describe("21. detach Memory (chapter)", () => {
  it("detaches a direct memory from a chapter", async () => {
    seedMemory("m1", "user-1");
    const cr = await createChapter("user-1", { title: "C" });
    if (!("data" in cr)) throw new Error("fail");
    await attachMemoryToChapter("user-1", cr.data.id, "m1");
    const ok = await detachMemoryFromChapter("user-1", cr.data.id, "m1");
    expect(ok).toBe(true);
    expect(store.chapterMemories).toHaveLength(0);
  });
});

describe("22. deleting Chapter does not delete Memory", () => {
  it("chapter deletion removes links but keeps the memory", async () => {
    seedMemory("m1", "user-1");
    const cr = await createChapter("user-1", { title: "C" });
    if (!("data" in cr)) throw new Error("fail");
    await attachMemoryToChapter("user-1", cr.data.id, "m1");
    await deleteChapter("user-1", cr.data.id);
    expect(store.chapters).toHaveLength(0);
    expect(store.chapterMemories).toHaveLength(0);
    expect(store.memories.has("m1")).toBe(true);
  });
});

describe("23. deleting Chapter does not delete Event", () => {
  it("chapter deletion removes the link but keeps the event", async () => {
    const er = await createEvent("user-1", { title: "E" });
    const cr = await createChapter("user-1", { title: "C" });
    if (!("data" in er) || !("data" in cr)) throw new Error("fail");
    await attachEventToChapter("user-1", cr.data.id, er.data.id);
    await deleteChapter("user-1", cr.data.id);
    expect(store.chapters).toHaveLength(0);
    expect(store.chapterEvents).toHaveLength(0);
    expect(store.events).toHaveLength(1);
  });
});

// ===========================================================================
// TIME MODEL
// ===========================================================================

describe("24. exact date preserved", () => {
  it("preserves exact start/end dates", async () => {
    const r = await createEvent("user-1", {
      title: "E",
      startAt: "2007-08-15T00:00:00Z",
      endAt: "2007-08-20T00:00:00Z",
      timePrecision: "exact",
    });
    if (!("data" in r)) throw new Error("fail");
    expect(r.data.startAt).toBe("2007-08-15T00:00:00Z");
    expect(r.data.endAt).toBe("2007-08-20T00:00:00Z");
    expect(r.data.timePrecision).toBe("exact");
  });
});

describe("25. approximate period preserved", () => {
  it("preserves a human period label verbatim", async () => {
    const r = await createEvent("user-1", {
      title: "E",
      timeLabel: "late 1990s",
      timePrecision: "period",
    });
    if (!("data" in r)) throw new Error("fail");
    expect(r.data.timeLabel).toBe("late 1990s");
    expect(r.data.startAt).toBeNull();
  });
});

describe("26. unknown time does not invent dates", () => {
  it("unknown precision leaves start/end null", async () => {
    const r = await createEvent("user-1", { title: "E" });
    if (!("data" in r)) throw new Error("fail");
    expect(r.data.timePrecision).toBe("unknown");
    expect(r.data.startAt).toBeNull();
    expect(r.data.endAt).toBeNull();
    expect(r.data.timeLabel).toBeNull();
  });
});

describe("27. start/end range preserved", () => {
  it("preserves a multi-year range", async () => {
    const r = await createChapter("user-1", {
      title: "C",
      startAt: "2001-01-01T00:00:00Z",
      endAt: "2005-12-31T00:00:00Z",
      timePrecision: "period",
      timeLabel: "2001–2005",
    });
    if (!("data" in r)) throw new Error("fail");
    expect(r.data.startAt).toBe("2001-01-01T00:00:00Z");
    expect(r.data.endAt).toBe("2005-12-31T00:00:00Z");
    expect(r.data.timeLabel).toBe("2001–2005");
  });
});

// ===========================================================================
// RELATIONSHIPS
// ===========================================================================

describe("28. same relationship cannot be duplicated", () => {
  it("attaching the same memory to an event twice yields one link (idempotent)", async () => {
    seedMemory("m1", "user-1");
    const r = await createEvent("user-1", { title: "E" });
    if (!("data" in r)) throw new Error("fail");
    await attachMemoryToEvent("user-1", r.data.id, "m1");
    await attachMemoryToEvent("user-1", r.data.id, "m1");
    expect(store.eventMemories).toHaveLength(1);
  });

  it("attaching the same event to a chapter twice yields one link", async () => {
    const er = await createEvent("user-1", { title: "E" });
    const cr = await createChapter("user-1", { title: "C" });
    if (!("data" in er) || !("data" in cr)) throw new Error("fail");
    await attachEventToChapter("user-1", cr.data.id, er.data.id);
    await attachEventToChapter("user-1", cr.data.id, er.data.id);
    expect(store.chapterEvents).toHaveLength(1);
  });
});

describe("29. self-reference is rejected where applicable", () => {
  it("attaching a memory to a chapter as if it were an event fails (different ids required)", async () => {
    seedMemory("m1", "user-1");
    const cr = await createChapter("user-1", { title: "C" });
    if (!("data" in cr)) throw new Error("fail");
    // Attaching a memory id as an event id → event not found → false.
    const ok = await attachEventToChapter("user-1", cr.data.id, "m1");
    expect(ok).toBe(false);
  });
});

describe("30. relationship rows are owner-scoped", () => {
  it("detach only removes the caller's own link", async () => {
    seedMemory("m1", "user-1");
    seedMemory("m2", "user-2");
    const r1 = await createEvent("user-1", { title: "E1" });
    const r2 = await createEvent("user-2", { title: "E2" });
    if (!("data" in r1) || !("data" in r2)) throw new Error("fail");
    await attachMemoryToEvent("user-1", r1.data.id, "m1");
    await attachMemoryToEvent("user-2", r2.data.id, "m2");
    // user-2 cannot detach user-1's link.
    await detachMemoryFromEvent("user-2", r1.data.id, "m1");
    expect(store.eventMemories).toHaveLength(2);
    await detachMemoryFromEvent("user-1", r1.data.id, "m1");
    expect(store.eventMemories).toHaveLength(1);
    expect(store.eventMemories[0].user_id).toBe("user-2");
  });
});

// ===========================================================================
// AI SUGGESTION (boundary)
// ===========================================================================

const SUGGEST_INPUT = {
  kind: "event" as const,
  patterns: [
    {
      patternType: "repeated_location",
      title: "A place that recurs",
      summary: "3 memories",
      evidenceCount: 3,
    },
  ],
  memories: [
    {
      memoryId: "m1",
      title: "Song — Artist",
      excerpt: "note 1",
      eventTimeLabel: "2002",
      location: "Istanbul",
    },
    {
      memoryId: "m2",
      title: "Song2 — Artist2",
      excerpt: "note 2",
      eventTimeLabel: "2004",
      location: "Istanbul",
    },
  ],
};

describe("31. suggestion is server-side only (code boundary)", () => {
  it("the suggestStructure server module references runRole, not the client", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/llm/suggestStructure.server.ts", "utf8");
    expect(src).toContain("runRole");
  });
});

describe("32. suggestion does not auto-save", () => {
  it("suggestStructureLogic returns a suggestion but persists nothing", async () => {
    runRoleImpl = async () =>
      JSON.stringify({
        title: "University Years",
        description: "A possible grouping",
        timeLabel: "2001–2005",
        memoryIds: ["m1", "m2"],
      });
    const beforeEvents = store.events.length;
    const beforeChapters = store.chapters.length;
    const out = await suggestStructureLogic(SUGGEST_INPUT);
    expect(out.suggestion).not.toBeNull();
    expect(store.events.length).toBe(beforeEvents);
    expect(store.chapters.length).toBe(beforeChapters);
  });
});

describe("33. malformed suggestion safely rejected", () => {
  it("returns null for empty response", async () => {
    runRoleImpl = async () => "";
    expect((await suggestStructureLogic(SUGGEST_INPUT)).suggestion).toBeNull();
  });
  it("returns null for invalid JSON", async () => {
    runRoleImpl = async () => "not json at all";
    expect((await suggestStructureLogic(SUGGEST_INPUT)).suggestion).toBeNull();
  });
  it("returns null for empty title (insufficient evidence signal)", async () => {
    runRoleImpl = async () => JSON.stringify({ title: "" });
    expect((await suggestStructureLogic(SUGGEST_INPUT)).suggestion).toBeNull();
  });
  it("returns null when memoryIds are not among valid set", async () => {
    runRoleImpl = async () => JSON.stringify({ title: "X", memoryIds: ["made-up-id"] });
    expect((await suggestStructureLogic(SUGGEST_INPUT)).suggestion).toBeNull();
  });
});

describe("34. user Accept creates owned object (app-layer behavior)", () => {
  it("createEvent produces an owned event from a suggestion title", async () => {
    runRoleImpl = async () => JSON.stringify({ title: "University Years", memoryIds: ["m1"] });
    const out = await suggestStructureLogic(SUGGEST_INPUT);
    expect(out.suggestion).not.toBeNull();
    // Simulate the UI's Accept action: create the event.
    const r = await createEvent("user-1", {
      title: out.suggestion!.title,
      timeLabel: out.suggestion!.timeLabel,
    });
    expect("data" in r).toBe(true);
    if ("data" in r) expect(r.data.userId).toBe("user-1");
  });
});

describe("35. user Dismiss creates nothing", () => {
  it("dismissing a suggestion leaves no events/chapters", async () => {
    runRoleImpl = async () => JSON.stringify({ title: "X", memoryIds: ["m1"] });
    const out = await suggestStructureLogic(SUGGEST_INPUT);
    // Dismiss = do nothing.
    expect(out.suggestion).not.toBeNull();
    expect(store.events).toHaveLength(0);
    expect(store.chapters).toHaveLength(0);
  });
});

describe("36. prompt forbids invented biography", () => {
  it("buildSuggestStructurePrompt includes anti-invention rules", async () => {
    const { buildSuggestStructurePrompt } = await import("@/lib/llm/suggestStructure");
    const prompt = buildSuggestStructurePrompt(SUGGEST_INPUT);
    expect(prompt).toContain("Do not invent");
    expect(prompt).toContain("Do not diagnose");
    expect(prompt).toContain("advisory only");
  });

  it("parseSuggestStructureResponse rejects memoryIds not in valid set", () => {
    const valid = new Set(["m1", "m2"]);
    const ok = parseSuggestStructureResponse(
      JSON.stringify({ title: "X", memoryIds: ["m1", "fake"] }),
      valid,
    );
    expect(ok).not.toBeNull();
    expect(ok!.memoryIds).toEqual(["m1"]);
  });
});

// ===========================================================================
// SECURITY
// ===========================================================================

describe("37. no cross-user data", () => {
  it("a user cannot attach their memory to another user's event", async () => {
    seedMemory("m1", "user-1");
    const r = await createEvent("user-2", { title: "E" });
    if (!("data" in r)) throw new Error("fail");
    const ok = await attachMemoryToEvent("user-1", r.data.id, "m1");
    expect(ok).toBe(false);
    expect(store.eventMemories).toHaveLength(0);
  });
});

describe("38. no provider keys in client (code boundary)", () => {
  it("the prompt + server modules reference no provider keys", async () => {
    const fs = await import("node:fs");
    for (const file of [
      "src/lib/llm/suggestStructure.ts",
      "src/lib/llm/suggestStructure.server.ts",
      "src/lib/supabase/life-remote.ts",
    ]) {
      const src = fs.readFileSync(file, "utf8");
      for (const k of ["GROQ_API_KEY", "GEMINI_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY"]) {
        expect(src).not.toContain(k);
      }
    }
  });
  it("the server fn reads no env directly", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/llm/suggestStructure.server.ts", "utf8");
    expect(src).not.toMatch(/process\.env/);
  });
});

describe("39. no direct browser LLM call (code boundary)", () => {
  it("events/chapters routes import the server fn, not orchestra", async () => {
    const fs = await import("node:fs");
    for (const file of [
      "src/routes/events.tsx",
      "src/routes/events.$eventId.tsx",
      "src/routes/chapters.tsx",
      "src/routes/chapters.$chapterId.tsx",
    ]) {
      const src = fs.readFileSync(file, "utf8");
      expect(src).not.toContain("@/lib/llm/orchestra");
      expect(src).not.toContain("runRole");
    }
  });
  it("the persistence layer references no orchestra/network", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/supabase/life-remote.ts", "utf8");
    expect(src).not.toContain("runRole");
    expect(src).not.toContain("orchestra");
  });
});

describe("40. existing Memory/Pattern behavior unchanged", () => {
  it("life-remote does not redefine createMemory/createPattern/createConnection", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/supabase/life-remote.ts", "utf8");
    expect(src).not.toMatch(/export (async )?function createMemory/);
    expect(src).not.toMatch(/export (async )?function createPattern/);
    expect(src).not.toMatch(/export (async )?function createConnection/);
  });
});
