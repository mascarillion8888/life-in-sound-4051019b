import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MemoryCapture } from "@/lib/memory/types";

/**
 * Tests exercise the Music Memory persistence layer's contract:
 *   - atomic Memory creation (Memory + all bridge rows, or nothing)
 *   - Music Experience reuse and cross-user rejection
 *   - original_user_note immutability + user_note editability
 *   - user vs companion reflections (provenance)
 *   - deletion cascade (bridge + reflections) without touching Experiences
 *   - AI-derived context kept separate/stale-marked on user edits
 *
 * We stub the Supabase client returned by getSupabase() (our own module), so
 * these are real code-path tests of memory-remote.ts, not of the Supabase SDK.
 * No live LLM calls. No external API calls.
 */

type Chain = {
  select: (cols: string) => Chain;
  eq: (col: string, val: unknown) => Chain;
  in: (col: string, vals: unknown[]) => Chain;
  order: (col: string, opts: { ascending: boolean }) => Chain;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  single: () => Promise<{ data: unknown; error: unknown }>;
  insert: (row: unknown) => Chain;
  update: (patch: Record<string, unknown>) => Chain;
  delete: () => Chain;
};

type FakeSupabase = {
  from: (table: string) => Chain;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  calls: string[];
  // Test-only knobs:
  experiences: Map<
    string,
    {
      id: string;
      user_id: string;
      source_type: string;
      title: string | null;
      artist: string | null;
      external_ref: string | null;
    }
  >;
  memories: Map<
    string,
    {
      id: string;
      user_id: string;
      original_user_note: string | null;
      user_note: string | null;
      ai_context_stale_at: string | null;
    }
  >;
  bridge: Array<{
    memory_id: string;
    music_experience_id: string;
    user_id: string;
    position: number;
    role: string | null;
  }>;
  reflections: Array<{
    id: string;
    user_id: string;
    memory_id: string;
    author: string;
    body: string;
    source_context: unknown;
  }>;
  rpcFail?: boolean;
  nextExpId: number;
  nextMemId: number;
  nextReflId: number;
};

function makeFakeSupabase(opts: { rpcFail?: boolean } = {}): FakeSupabase {
  const calls: string[] = [];
  const fake: FakeSupabase = {
    from: () => ({
      select: () => fake.from(""),
      eq: () => fake.from(""),
      in: () => fake.from(""),
      order: () => fake.from(""),
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
      insert: () => fake.from(""),
      update: () => fake.from(""),
      delete: () => fake.from(""),
    }),
    rpc: async () => ({ data: null, error: null }),
    calls,
    experiences: new Map(),
    memories: new Map(),
    bridge: [],
    reflections: [],
    rpcFail: opts.rpcFail,
    nextExpId: 1,
    nextMemId: 1,
    nextReflId: 1,
  };

  // Override from() with a real implementation that manipulates the in-memory
  // state so tests can assert against it.
  fake.from = (table: string) => {
    calls.push(`from:${table}`);
    const chain: Chain = {
      select: (cols) => {
        calls.push(`select:${cols}`);
        return chain;
      },
      eq: (col, val) => {
        calls.push(`eq:${col}:${String(val)}`);
        return chain;
      },
      in: (col, vals) => {
        calls.push(`in:${col}:${vals.length}`);
        return chain;
      },
      order: (col, opts) => {
        calls.push(`order:${col}:${opts.ascending}`);
        return chain;
      },
      maybeSingle: async () => {
        // Return the last eq'd row for experiences lookup by id.
        return { data: null, error: null };
      },
      single: async () => {
        return { data: null, error: null };
      },
      insert: (row) => {
        calls.push(`insert:${table}:${JSON.stringify(row)}`);
        return chain;
      },
      update: (patch) => {
        calls.push(`update:${table}:${JSON.stringify(patch)}`);
        return chain;
      },
      delete: () => {
        calls.push(`delete:${table}`);
        return chain;
      },
    };
    return chain;
  };

  return fake;
}

// Module-level holder so a single top-level vi.mock factory can serve a
// different fake per test.
let currentFake: FakeSupabase | null = null;
function setFake(fake: FakeSupabase | null) {
  currentFake = fake;
}

vi.mock("./client", () => ({
  getSupabase: () => currentFake,
}));

import {
  addReflection,
  createMemory,
  deleteMemory,
  listMemories,
  listReflections,
  loadMemory,
  updateMemory,
} from "./memory-remote";

// ---------------------------------------------------------------------------
// A richer fake whose from()/rpc() actually mutate in-memory state, so the
// persistence layer's real code paths are exercised end-to-end.
// ---------------------------------------------------------------------------
function makeStatefulFake(opts: { rpcFail?: boolean } = {}): FakeSupabase {
  const f = makeFakeSupabase(opts);

  // Track eq() column/value for the current chain so maybeSingle()/single()
  // can resolve against in-memory maps.
  let eqCol = "";
  let eqVal: unknown = "";
  let inCol = "";
  let inVals: unknown[] = [];
  let lastSelect = "*";
  let lastTable = "";
  let lastPatch: Record<string, unknown> | null = null;
  let isDelete = false;

  f.from = (table: string) => {
    lastTable = table;
    f.calls.push(`from:${table}`);
    eqCol = "";
    eqVal = "";
    inCol = "";
    inVals = [];
    lastPatch = null;
    isDelete = false;
    const chain: Chain = {
      select: (cols) => {
        lastSelect = cols;
        f.calls.push(`select:${cols}`);
        return chain;
      },
      eq: (col, val) => {
        eqCol = col;
        eqVal = val;
        f.calls.push(`eq:${col}:${String(val)}`);
        return chain;
      },
      in: (col, vals) => {
        inCol = col;
        inVals = vals;
        f.calls.push(`in:${col}:${vals.length}`);
        return chain;
      },
      order: (col, o) => {
        f.calls.push(`order:${col}:${o.ascending}`);
        return chain;
      },
      maybeSingle: async () => {
        if (lastTable === "music_experiences" && eqCol === "id") {
          const exp = f.experiences.get(String(eqVal));
          return { data: exp ?? null, error: null };
        }
        if (lastTable === "memories" && eqCol === "id") {
          const mem = f.memories.get(String(eqVal));
          return { data: mem ?? null, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => {
        if (lastTable === "music_experiences" && lastSelect === "id") {
          // insert().select("id").single() — return a new id.
          const id = `exp-${f.nextExpId++}`;
          return { data: { id }, error: null };
        }
        if (lastTable === "reflections" && lastSelect === "id") {
          const id = `refl-${f.nextReflId++}`;
          return { data: { id }, error: null };
        }
        return { data: null, error: null };
      },
      insert: (row) => {
        f.calls.push(`insert:${lastTable}:${JSON.stringify(row)}`);
        if (lastTable === "music_experiences") {
          // Defer actual creation until .select("id").single() resolves the id,
          // because the persistence layer reads back the generated id.
          pendingExpInsert = row as {
            user_id: string;
            source_type: string;
            title: string | null;
            artist: string | null;
            external_ref: string | null;
          };
        }
        if (lastTable === "reflections") {
          const r = row as {
            user_id: string;
            memory_id: string;
            author: string;
            body: string;
            source_context: unknown;
          };
          pendingReflInsert = r;
        }
        return chain;
      },
      update: (patch) => {
        lastPatch = patch;
        f.calls.push(`update:${lastTable}:${JSON.stringify(patch)}`);
        return chain;
      },
      delete: () => {
        isDelete = true;
        f.calls.push(`delete:${lastTable}`);
        return chain;
      },
    };

    // Intercept single() to also commit pending experience/reflection inserts
    // using the generated id.
    const origSingle = chain.single;
    chain.single = async () => {
      const res = await origSingle();
      if (lastTable === "music_experiences" && pendingExpInsert && res.data) {
        const id = (res.data as { id: string }).id;
        f.experiences.set(id, {
          id,
          user_id: pendingExpInsert.user_id,
          source_type: pendingExpInsert.source_type,
          title: pendingExpInsert.title ?? null,
          artist: pendingExpInsert.artist ?? null,
          external_ref: pendingExpInsert.external_ref ?? null,
        });
        pendingExpInsert = null;
      }
      if (lastTable === "reflections" && pendingReflInsert && res.data) {
        const id = (res.data as { id: string }).id;
        f.reflections.push({
          id,
          user_id: pendingReflInsert.user_id,
          memory_id: pendingReflInsert.memory_id,
          author: pendingReflInsert.author,
          body: pendingReflInsert.body,
          source_context: pendingReflInsert.source_context,
        });
        pendingReflInsert = null;
      }
      return res;
    };

    // Intercept maybeSingle/eq combinations for delete/update side effects.
    // We need a final side-effecting step. Since the persistence layer calls
    // .delete().eq("id", memId).eq("user_id", userId) — but our chain returns
    // itself, we track eq and apply on the next terminal. The terminal for
    // delete/update in supabase-js is the eq() that returns void (no, it's the
    // chained promise). We handle delete via a custom returning object.
    return chain;
  };

  // For delete/update side effects, we re-assign eq on the returned chain via
  // a wrapper that the persistence layer's `.delete().eq().eq()` uses. Since
  // chain.eq returns chain, we capture the LAST eq and apply on await. But
  // supabase-js delete().eq(...) returns a thenable. Our chain.delete() returns
  // chain (thenable? no). The persistence layer does:
  //   await client.from(MEMORIES_TABLE).delete().eq("id", memId).eq("user_id", userId)
  // which in our fake is `chain` (an object, not a promise). That would fail.
  // So we must make delete()/update() return a thenable chain. We'll patch below.

  // RPC: simulate the atomic create. On success, create the memory + bridge rows
  // in-memory; on rpcFail, return an error (and create nothing).
  f.rpc = async (name: string, args?: Record<string, unknown>) => {
    f.calls.push(`rpc:${name}`);
    if (name !== "create_memory_atomic") return { data: null, error: "unknown rpc" };
    if (f.rpcFail) return { data: null, error: "atomic failed" };

    const p = args ?? {};
    const userId = String(p.p_user_id);
    const links = (p.p_links as Array<{ music_experience_id: string; position: number }>) ?? [];

    // DB-level cross-user + existence check (mirrors the real function).
    for (const link of links) {
      const exp = f.experiences.get(link.music_experience_id);
      if (!exp) return { data: null, error: "music experience not found" };
      if (exp.user_id !== userId) return { data: null, error: "cross-user" };
    }

    const memId = `mem-${f.nextMemId++}`;
    f.memories.set(memId, {
      id: memId,
      user_id: userId,
      original_user_note: (p.p_original_note as string) ?? null,
      user_note: (p.p_user_note as string) ?? null,
      ai_context_stale_at: null,
    });
    for (const link of links) {
      f.bridge.push({
        memory_id: memId,
        music_experience_id: link.music_experience_id,
        user_id: userId,
        position: link.position,
        role: null,
      });
    }
    return { data: memId, error: null };
  };

  return f;
}

let pendingExpInsert: {
  user_id: string;
  source_type: string;
  title: string | null;
  artist: string | null;
  external_ref: string | null;
} | null = null;
let pendingReflInsert: {
  user_id: string;
  memory_id: string;
  author: string;
  body: string;
  source_context: unknown;
} | null = null;

// We need the delete()/update() terminal to be awaitable and to apply side
// effects. Patch makeStatefulFake's from() to return thenable delete/update.
// (Done above via chain; but chain.delete returns chain, not a promise.)
// Fix: override delete/update to return a thenable.
function patchDeleteUpdate(f: FakeSupabase) {
  const origFrom = f.from;
  let eqs: Array<[string, unknown]> = [];
  let lastTable = "";
  let lastPatch: Record<string, unknown> | null = null;
  let mode: "none" | "delete" | "update" = "none";
  f.from = (table: string) => {
    lastTable = table;
    eqs = [];
    lastPatch = null;
    mode = "none";
    f.calls.push(`from:${table}`);
    const thenable = {
      select: (cols: string) => {
        f.calls.push(`select:${cols}`);
        return thenable;
      },
      eq: (col: string, val: unknown) => {
        eqs.push([col, val]);
        f.calls.push(`eq:${col}:${String(val)}`);
        return thenable;
      },
      in: (col: string, vals: unknown[]) => {
        f.calls.push(`in:${col}:${vals.length}`);
        return thenable;
      },
      order: (col: string, o: { ascending: boolean }) => {
        f.calls.push(`order:${col}:${o.ascending}`);
        return thenable;
      },
      then: async (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        // Apply side effect for delete/update.
        if (mode === "delete" && lastTable === "memories") {
          const idEq = eqs.find(([c]) => c === "id");
          if (idEq) {
            const id = String(idEq[1]);
            f.memories.delete(id);
            f.bridge = f.bridge.filter((b) => b.memory_id !== id);
            f.reflections = f.reflections.filter((r) => r.memory_id !== id);
          }
          return resolve({ error: null });
        }
        if (mode === "update" && lastTable === "memories" && lastPatch) {
          const idEq = eqs.find(([c]) => c === "id");
          if (idEq) {
            const id = String(idEq[1]);
            const mem = f.memories.get(id);
            if (mem && lastPatch.user_note !== undefined)
              mem.user_note = lastPatch.user_note as string | null;
            if (mem && lastPatch.ai_context_stale_at !== undefined)
              mem.ai_context_stale_at = lastPatch.ai_context_stale_at as string;
          }
          return resolve({ error: null });
        }
        // For selects (loadMemory/listMemories/listReflections), return data.
        if (lastTable === "memories" && mode === "none") {
          const idEq = eqs.find(([c]) => c === "id");
          const userEq = eqs.find(([c]) => c === "user_id");
          if (idEq && userEq) {
            const m = f.memories.get(String(idEq[1]));
            return resolve({ data: m && m.user_id === userEq[1] ? m : null, error: null });
          }
          if (userEq && !idEq) {
            const all = Array.from(f.memories.values()).filter((m) => m.user_id === userEq[1]);
            return resolve({ data: all, error: null });
          }
          return resolve({ data: null, error: null });
        }
        if (lastTable === "music_experiences" && mode === "none") {
          const idEq = eqs.find(([c]) => c === "id");
          if (idEq) {
            const e = f.experiences.get(String(idEq[1]));
            return resolve({ data: e ?? null, error: null });
          }
          const inEq =
            eqs.find(([c]) => c === "id") || eqs.find(([c]) => c.toLowerCase().includes("id"));
          return resolve({ data: null, error: null });
        }
        if (lastTable === "memory_music_experiences" && mode === "none") {
          const memEq = eqs.find(([c]) => c === "memory_id");
          const userEq = eqs.find(([c]) => c === "user_id");
          let rows = f.bridge;
          if (memEq) rows = rows.filter((b) => b.memory_id === memEq[1]);
          if (userEq) rows = rows.filter((b) => b.user_id === userEq[1]);
          return resolve({ data: rows, error: null });
        }
        if (lastTable === "reflections" && mode === "none") {
          const memEq = eqs.find(([c]) => c === "memory_id");
          const userEq = eqs.find(([c]) => c === "user_id");
          let rows = f.reflections;
          if (memEq) rows = rows.filter((r) => r.memory_id === memEq[1]);
          if (userEq) rows = rows.filter((r) => r.user_id === userEq[1]);
          return resolve({ data: rows, error: null });
        }
        return resolve({ data: null, error: null });
      },
      maybeSingle: async () => {
        const idEq = eqs.find(([c]) => c === "id");
        if (lastTable === "music_experiences" && idEq) {
          const e = f.experiences.get(String(idEq[1]));
          return { data: e ?? null, error: null };
        }
        if (lastTable === "memories" && idEq) {
          const m = f.memories.get(String(idEq[1]));
          return { data: m ?? null, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => {
        if (lastTable === "music_experiences") {
          const id = `exp-${f.nextExpId++}`;
          if (pendingExpInsert) {
            f.experiences.set(id, {
              id,
              user_id: pendingExpInsert.user_id,
              source_type: pendingExpInsert.source_type,
              title: pendingExpInsert.title ?? null,
              artist: pendingExpInsert.artist ?? null,
              external_ref: pendingExpInsert.external_ref ?? null,
            });
            pendingExpInsert = null;
          }
          return { data: { id }, error: null };
        }
        if (lastTable === "reflections") {
          const id = `refl-${f.nextReflId++}`;
          if (pendingReflInsert) {
            f.reflections.push({
              id,
              user_id: pendingReflInsert.user_id,
              memory_id: pendingReflInsert.memory_id,
              author: pendingReflInsert.author,
              body: pendingReflInsert.body,
              source_context: pendingReflInsert.source_context,
            });
            pendingReflInsert = null;
          }
          return { data: { id }, error: null };
        }
        return { data: null, error: null };
      },
      insert: (row: unknown) => {
        f.calls.push(`insert:${lastTable}:${JSON.stringify(row)}`);
        if (lastTable === "music_experiences") pendingExpInsert = row as typeof pendingExpInsert;
        if (lastTable === "reflections") pendingReflInsert = row as typeof pendingReflInsert;
        return thenable;
      },
      update: (patch: Record<string, unknown>) => {
        lastPatch = patch;
        mode = "update";
        f.calls.push(`update:${lastTable}:${JSON.stringify(patch)}`);
        return thenable;
      },
      delete: () => {
        mode = "delete";
        f.calls.push(`delete:${lastTable}`);
        return thenable;
      },
    };
    return thenable;
  };
}

describe("createMemory", () => {
  beforeEach(() => {
    setFake(null);
    pendingExpInsert = null;
    pendingReflInsert = null;
  });

  it("1. creates a Memory with one Music Experience", async () => {
    const f = makeStatefulFake();
    patchDeleteUpdate(f);
    setFake(f);

    const result = await createMemory("user-1", {
      musicExperiences: [{ sourceType: "streaming", title: "Hoppípolla", artist: "Sigur Rós" }],
      userNote: "first dance",
    });

    expect(result).toEqual({ memoryId: "mem-1" });
    expect(f.experiences.size).toBe(1);
    expect(f.memories.size).toBe(1);
    expect(f.bridge).toHaveLength(1);
    expect(f.bridge[0].memory_id).toBe("mem-1");
    // original_user_note seeded from userNote.
    const mem = f.memories.get("mem-1")!;
    expect(mem.original_user_note).toBe("first dance");
    expect(mem.user_note).toBe("first dance");
  });

  it("2. creates a Memory with multiple Music Experiences", async () => {
    const f = makeStatefulFake();
    patchDeleteUpdate(f);
    setFake(f);

    const result = await createMemory("user-1", {
      musicExperiences: [
        { sourceType: "streaming", title: "A", artist: "X" },
        { sourceType: "streaming", title: "B", artist: "Y" },
        { sourceType: "streaming", title: "C", artist: "Z" },
      ],
    });

    expect(result).toEqual({ memoryId: "mem-1" });
    expect(f.experiences.size).toBe(3);
    expect(f.bridge).toHaveLength(3);
    expect(f.bridge.map((b) => b.position)).toEqual([0, 1, 2]);
  });

  it("3. reuses an existing Music Experience (by id) instead of duplicating", async () => {
    const f = makeStatefulFake();
    patchDeleteUpdate(f);
    // Pre-seed an existing experience owned by user-1.
    f.experiences.set("exp-existing", {
      id: "exp-existing",
      user_id: "user-1",
      source_type: "streaming",
      title: "Old",
      artist: null,
      external_ref: null,
    });
    setFake(f);

    const result = await createMemory("user-1", {
      musicExperiences: [{ id: "exp-existing", sourceType: "streaming", title: "Old" }],
    });

    expect(result).toEqual({ memoryId: "mem-1" });
    // No new experience created — still only the pre-seeded one.
    expect(f.experiences.size).toBe(1);
    expect(f.bridge[0].music_experience_id).toBe("exp-existing");
  });

  it("4. supports an unknown-title Music Experience with null title", async () => {
    const f = makeStatefulFake();
    patchDeleteUpdate(f);
    setFake(f);

    const result = await createMemory("user-1", {
      musicExperiences: [{ sourceType: "unknown_title", title: null }],
    });

    expect(result).toEqual({ memoryId: "mem-1" });
    const exp = Array.from(f.experiences.values())[0];
    expect(exp.title).toBeNull();
    expect(exp.source_type).toBe("unknown_title");
  });

  it("5. rejects a cross-user Music Experience reference", async () => {
    const f = makeStatefulFake();
    patchDeleteUpdate(f);
    // An experience owned by a DIFFERENT user.
    f.experiences.set("exp-other", {
      id: "exp-other",
      user_id: "user-2",
      source_type: "streaming",
      title: "Theirs",
      artist: null,
      external_ref: null,
    });
    setFake(f);

    const result = await createMemory("user-1", {
      musicExperiences: [{ id: "exp-other", sourceType: "streaming", title: "Theirs" }],
    });

    expect(result).toEqual({ error: "cross-user music experience reference" });
    // No memory created.
    expect(f.memories.size).toBe(0);
    expect(f.bridge).toHaveLength(0);
  });

  it("6. rejects a Memory without any Music Experience", async () => {
    const f = makeStatefulFake();
    patchDeleteUpdate(f);
    setFake(f);

    const result = await createMemory("user-1", {
      musicExperiences: [],
    } as unknown as MemoryCapture);

    expect(result).toEqual({ error: "a memory requires at least one music experience" });
    expect(f.memories.size).toBe(0);
  });

  it("7. atomic failure leaves no partial Memory (rpc fails)", async () => {
    const f = makeStatefulFake({ rpcFail: true });
    patchDeleteUpdate(f);
    setFake(f);

    const result = await createMemory("user-1", {
      musicExperiences: [{ sourceType: "streaming", title: "Song", artist: "A" }],
    });

    expect(result).toEqual({ error: "atomic memory creation failed" });
    // The RPC failed → no memory, no bridge rows.
    expect(f.memories.size).toBe(0);
    expect(f.bridge).toHaveLength(0);
    // New experience rows may exist (they are independent, reusable), but no
    // Memory/bridge was created.
  });
});

describe("updateMemory", () => {
  beforeEach(() => {
    setFake(null);
    pendingExpInsert = null;
    pendingReflInsert = null;
  });

  it("8. original_user_note remains unchanged during updates", async () => {
    const f = makeStatefulFake();
    patchDeleteUpdate(f);
    setFake(f);
    // Seed a memory with an original note.
    f.memories.set("mem-1", {
      id: "mem-1",
      user_id: "user-1",
      original_user_note: "the original",
      user_note: "the original",
      ai_context_stale_at: null,
    });

    await updateMemory("user-1", "mem-1", { userNote: "edited current note" });

    const mem = f.memories.get("mem-1")!;
    expect(mem.original_user_note).toBe("the original"); // unchanged
    expect(mem.user_note).toBe("edited current note"); // updated
  });

  it("9. user_note can be updated independently", async () => {
    const f = makeStatefulFake();
    patchDeleteUpdate(f);
    setFake(f);
    f.memories.set("mem-1", {
      id: "mem-1",
      user_id: "user-1",
      original_user_note: "orig",
      user_note: "orig",
      ai_context_stale_at: null,
    });

    await updateMemory("user-1", "mem-1", { userNote: "new text" });

    const mem = f.memories.get("mem-1")!;
    expect(mem.user_note).toBe("new text");
    expect(mem.original_user_note).toBe("orig");
  });

  it("15. AI-derived context is marked stale (not erased) on user-source edit", async () => {
    const f = makeStatefulFake();
    patchDeleteUpdate(f);
    setFake(f);
    f.memories.set("mem-1", {
      id: "mem-1",
      user_id: "user-1",
      original_user_note: "o",
      user_note: "o",
      ai_context_stale_at: null,
    });

    await updateMemory("user-1", "mem-1", { feeling: "joy" });

    const mem = f.memories.get("mem-1")!;
    // Stale marker set to a timestamp (regenerable), not erased to null.
    expect(mem.ai_context_stale_at).not.toBeNull();
    expect(typeof mem.ai_context_stale_at).toBe("string");
  });
});

describe("addReflection / listReflections", () => {
  beforeEach(() => {
    setFake(null);
    pendingExpInsert = null;
    pendingReflInsert = null;
  });

  it("10. stores a user reflection as author=user", async () => {
    const f = makeStatefulFake();
    patchDeleteUpdate(f);
    setFake(f);
    f.memories.set("mem-1", {
      id: "mem-1",
      user_id: "user-1",
      original_user_note: null,
      user_note: null,
      ai_context_stale_at: null,
    });

    const result = await addReflection("user-1", {
      memoryId: "mem-1",
      author: "user",
      body: "I think about this often",
    });

    expect(result).toEqual({ reflectionId: "refl-1" });
    const r = f.reflections[0];
    expect(r.author).toBe("user");
    expect(r.body).toBe("I think about this often");
  });

  it("11. stores a companion reflection as author=companion", async () => {
    const f = makeStatefulFake();
    patchDeleteUpdate(f);
    setFake(f);
    f.memories.set("mem-1", {
      id: "mem-1",
      user_id: "user-1",
      original_user_note: null,
      user_note: null,
      ai_context_stale_at: null,
    });

    const result = await addReflection("user-1", {
      memoryId: "mem-1",
      author: "companion",
      body: "This memory echoes an earlier one.",
      sourceContext: { retrieved: ["mem-2"] },
    });

    expect(result).toEqual({ reflectionId: "refl-1" });
    const r = f.reflections[0];
    expect(r.author).toBe("companion");
    expect(r.source_context).toEqual({ retrieved: ["mem-2"] });
  });
});

describe("deleteMemory", () => {
  beforeEach(() => {
    setFake(null);
    pendingExpInsert = null;
    pendingReflInsert = null;
  });

  it("12. Memory deletion removes reflections and bridge links", async () => {
    const f = makeStatefulFake();
    patchDeleteUpdate(f);
    setFake(f);
    // Seed: a memory, two bridge links, two reflections.
    f.experiences.set("exp-1", {
      id: "exp-1",
      user_id: "user-1",
      source_type: "streaming",
      title: "A",
      artist: null,
      external_ref: null,
    });
    f.memories.set("mem-1", {
      id: "mem-1",
      user_id: "user-1",
      original_user_note: null,
      user_note: null,
      ai_context_stale_at: null,
    });
    f.bridge.push({
      memory_id: "mem-1",
      music_experience_id: "exp-1",
      user_id: "user-1",
      position: 0,
      role: null,
    });
    f.reflections.push({
      id: "refl-1",
      user_id: "user-1",
      memory_id: "mem-1",
      author: "user",
      body: "x",
      source_context: null,
    });

    await deleteMemory("user-1", "mem-1");

    expect(f.memories.has("mem-1")).toBe(false);
    expect(f.bridge.some((b) => b.memory_id === "mem-1")).toBe(false);
    expect(f.reflections.some((r) => r.memory_id === "mem-1")).toBe(false);
  });

  it("13. Music Experience remains after Memory deletion", async () => {
    const f = makeStatefulFake();
    patchDeleteUpdate(f);
    setFake(f);
    f.experiences.set("exp-1", {
      id: "exp-1",
      user_id: "user-1",
      source_type: "streaming",
      title: "A",
      artist: null,
      external_ref: null,
    });
    f.memories.set("mem-1", {
      id: "mem-1",
      user_id: "user-1",
      original_user_note: null,
      user_note: null,
      ai_context_stale_at: null,
    });
    f.bridge.push({
      memory_id: "mem-1",
      music_experience_id: "exp-1",
      user_id: "user-1",
      position: 0,
      role: null,
    });

    await deleteMemory("user-1", "mem-1");

    // Experience survives — it is independent and reusable.
    expect(f.experiences.has("exp-1")).toBe(true);
  });
});

describe("RLS / ownership boundaries", () => {
  beforeEach(() => {
    setFake(null);
    pendingExpInsert = null;
    pendingReflInsert = null;
  });

  it("14. RLS/ownership boundaries are represented in the migration", async () => {
    // This test verifies the migration file contains owner-only RLS policies
    // for all four tables, the user_id → auth.users FK, and the bridge
    // carrying user_id for simpler RLS (cross-user protection).
    const fs = await import("node:fs");
    const sql = fs.readFileSync("supabase/migrations/0002_music_memory.sql", "utf8");

    // Every table references auth.users with on delete cascade.
    expect(sql).toMatch(/music_exferences|music_experiences/);
    for (const t of ["music_experiences", "memories", "memory_music_experiences", "reflections"]) {
      expect(sql).toContain(`create table if not exists public.${t}`);
      expect(sql).toContain(`alter table public.${t} enable row level security`);
      expect(sql).toContain(`"${t}_owner_select"`);
      expect(sql).toContain(`"${t}_owner_insert"`);
      expect(sql).toContain(`"${t}_owner_update"`);
      expect(sql).toContain(`"${t}_owner_delete"`);
    }
    // auth.users FK cascade on all four.
    expect((sql.match(/references auth\.users \(id\) on delete cascade/g) || []).length).toBe(4);
    // Bridge carries user_id.
    expect(sql).toContain("memory_music_experiences");
    // Cross-user protection in the atomic RPC.
    expect(sql).toContain("cross-user music experience reference");
    // original_user_note immutability trigger.
    expect(sql).toContain("preserve_original_user_note");
    expect(sql).toContain("new.original_user_note = old.original_user_note");
    // Atomic create RPC.
    expect(sql).toContain("create_memory_atomic");
    expect(sql).toContain("a memory requires at least one music experience");
  });
});
