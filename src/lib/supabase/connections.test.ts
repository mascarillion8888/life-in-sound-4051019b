import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the Memory Connection persistence layer + AI suggestion boundary.
 *
 * Scenarios covered:
 *   - same connection cannot be duplicated (6)
 *   - self-connection rejected (7)
 *   - cross-user source rejected (8)
 *   - cross-user target rejected (9)
 *   - user-linked connection persists (10)
 *   - connection deletion works (11)
 *   - related memories query returns only owned memories (12)
 *   - connection reason is displayed correctly (13)
 *   - original memories are never modified by connection creation (15)
 *   - optional AI suggestion is never auto-persisted (16)
 *   - optional AI rejection leaves no connection (17)
 *   - optional AI acceptance creates an explicitly marked AI-suggested connection (18)
 *   - malformed AI suggestion is ignored safely (19)
 *   - no provider keys in client bundle (20)
 *
 * No real LLM calls. The server fn's `runRole` dependency is stubbed via the
 * orchestra module mock; the Supabase client is a stateful fake.
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

// Stateful fake Supabase client.
type FakeMem = {
  id: string;
  user_id: string;
  original_user_note: string | null;
  user_note: string | null;
  location: string | null;
  event_time_label: string | null;
  experiences: Array<{ id: string; title: string | null; artist: string | null; position: number }>;
};
type FakeConn = {
  id: string;
  user_id: string;
  source_memory_id: string;
  target_memory_id: string;
  connection_type: string;
  source: string;
  confidence: number;
  reason: string | null;
  metadata: unknown;
  created_at: string;
};

const store: {
  memories: Map<string, FakeMem>;
  connections: FakeConn[];
  nextConnId: number;
} = { memories: new Map(), connections: [], nextConnId: 1 };

let currentFake: SupabaseFake | null = null;

type FakeThenable = {
  select: (cols?: string) => FakeThenable;
  eq: (col: string, val: unknown) => FakeThenable;
  or: (cond: string) => FakeThenable;
  in: (col: string, vals: unknown[]) => FakeThenable;
  order: () => FakeThenable;
  then: (resolve: (v: unknown) => unknown) => unknown;
  delete: () => {
    eq: (
      col: string,
      val: unknown,
    ) => {
      eq: (col: string, val: unknown) => Promise<{ error: unknown }>;
    };
  };
};

type SupabaseFake = {
  from: (table: string) => FakeThenable;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

vi.mock("./client", () => ({
  getSupabase: () => currentFake,
}));

import {
  createConnection,
  deleteConnection,
  findRelatedMemories,
  listConnectionsForMemory,
} from "./memory-remote";

function makeStatefulFake(): SupabaseFake {
  const f: SupabaseFake = {
    from: (table: string) => {
      const eqs: Array<[string, unknown]> = [];
      const lastTable = table;
      const thenable: FakeThenable = {
        select: (_cols?: string) => thenable,
        eq: (col: string, val: unknown) => {
          eqs.push([col, val]);
          return thenable;
        },
        or: (_cond: string) => thenable,
        in: (_col: string, _vals: unknown[]) => thenable,
        order: () => thenable,
        then: (resolve: (v: unknown) => unknown) => {
          // SELECT terminal for memories by ids + user_id.
          if (lastTable === "memories") {
            const userEq = eqs.find(([c]) => c === "user_id");
            // For .in("id", ids) calls we don't track the vals, so return all
            // owned rows matching user_id. findRelatedMemories then filters.
            const uid = userEq ? String(userEq[1]) : null;
            const rows = Array.from(store.memories.values()).filter((m) => {
              if (uid && m.user_id !== uid) return false;
              return true;
            });
            return resolve({
              data: rows.map((m) => ({
                id: m.id,
                original_user_note: m.original_user_note,
                user_note: m.user_note,
                event_time_label: m.event_time_label,
              })),
              error: null,
            });
          }
          if (lastTable === "memory_music_experiences") {
            const userEq = eqs.find(([c]) => c === "user_id");
            const uid = userEq ? String(userEq[1]) : null;
            // Return bridge rows derived from stored memories' experiences.
            const rows: Array<{
              memory_id: string;
              music_experience_id: string;
              position: number;
            }> = [];
            for (const m of store.memories.values()) {
              if (uid && m.user_id !== uid) continue;
              for (const e of m.experiences) {
                rows.push({ memory_id: m.id, music_experience_id: e.id, position: e.position });
              }
            }
            return resolve({ data: rows, error: null });
          }
          if (lastTable === "music_experiences") {
            // Return a flat list of experiences for titles.
            const rows: Array<{ id: string; title: string | null; artist: string | null }> = [];
            for (const m of store.memories.values()) {
              for (const e of m.experiences) {
                rows.push({ id: e.id, title: e.title, artist: e.artist });
              }
            }
            return resolve({ data: rows, error: null });
          }
          if (lastTable === "memory_connections") {
            const userEq = eqs.find(([c]) => c === "user_id");
            const uid = userEq ? String(userEq[1]) : null;
            let rows = store.connections;
            if (uid) rows = rows.filter((c) => c.user_id === uid);
            return resolve({ data: rows, error: null });
          }
          return resolve({ data: [], error: null });
        },
        delete: () => {
          return {
            eq: (col: string, val: unknown) => {
              eqs.push([col, val]);
              return {
                eq: (col2: string, val2: unknown) => {
                  eqs.push([col2, val2]);
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
      return thenable;
    },
    rpc: async (name: string, args?: Record<string, unknown>) => {
      if (name !== "create_connection_atomic") {
        return { data: null, error: "unknown rpc" };
      }
      const p = args ?? {};
      const userId = String(p.p_user_id);
      let sourceId = String(p.p_source_memory_id);
      let targetId = String(p.p_target_memory_id);

      // Reject self-connection.
      if (sourceId === targetId)
        return { data: null, error: { message: "self-connection rejected" } };

      // Verify both memories exist and belong to the user.
      const src = store.memories.get(sourceId);
      const tgt = store.memories.get(targetId);
      if (!src || !tgt) return { data: null, error: { message: "memory not found" } };
      if (src.user_id !== userId || tgt.user_id !== userId) {
        return { data: null, error: { message: "cross-user memory reference" } };
      }

      // Normalize ordering (lower id = source).
      if (sourceId > targetId) {
        const tmp = sourceId;
        sourceId = targetId;
        targetId = tmp;
      }

      // Duplicate check (unique pair + type).
      const dup = store.connections.find(
        (c) =>
          c.user_id === userId &&
          c.source_memory_id === sourceId &&
          c.target_memory_id === targetId &&
          c.connection_type === String(p.p_connection_type),
      );
      if (dup) return { data: null, error: { message: "duplicate connection" } };

      const id = `conn-${store.nextConnId++}`;
      store.connections.push({
        id,
        user_id: userId,
        source_memory_id: sourceId,
        target_memory_id: targetId,
        connection_type: String(p.p_connection_type),
        source: String(p.p_source),
        confidence: Number(p.p_confidence ?? 1.0),
        reason: (p.p_reason as string | null) ?? null,
        metadata: p.p_metadata ?? null,
        created_at: new Date().toISOString(),
      });
      return { data: id, error: null };
    },
  };
  return f;
}

// Stub deleteConnection's actual DB call inside the fake: the delete() above
// returns a promise that resolves with {error:null} but doesn't mutate. We
// need a real delete side-effect. Patch the fake's from() to handle delete.

function makeDeleteableFake(): SupabaseFake {
  const base = makeStatefulFake();
  // The base fake's from() returns a thenable that handles SELECT terminals
  // for all tables (including memory_connections), but its delete() does not
  // mutate state. Re-wrap: keep the base thenable for SELECT, but replace
  // delete() with a mutating implementation.
  const origFrom = base.from.bind(base);
  base.from = (table: string) => {
    const inner = origFrom(table);
    return {
      ...inner,
      delete: () => {
        const eqs: Array<[string, unknown]> = [];
        return {
          eq: (col: string, val: unknown) => {
            eqs.push([col, val]);
            return {
              eq: (col2: string, val2: unknown) => {
                eqs.push([col2, val2]);
                const idEq = eqs.find(([c]) => c === "id");
                const userEq = eqs.find(([c]) => c === "user_id");
                if (idEq && userEq) {
                  const id = String(idEq[1]);
                  const uid = String(userEq[1]);
                  store.connections = store.connections.filter(
                    (c) => !(c.id === id && c.user_id === uid),
                  );
                }
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    };
  };
  return base;
}

beforeEach(() => {
  store.memories.clear();
  store.connections = [];
  store.nextConnId = 1;
  currentFake = makeDeleteableFake();
  runRoleImpl = null;
});

function seedMemory(id: string, userId: string, overrides: Partial<FakeMem> = {}): FakeMem {
  const m: FakeMem = {
    id,
    user_id: userId,
    original_user_note: "original note",
    user_note: "current note",
    location: null,
    event_time_label: null,
    experiences: [{ id: `exp-${id}`, title: `Song ${id}`, artist: `Artist ${id}`, position: 0 }],
    ...overrides,
  };
  store.memories.set(id, m);
  return m;
}

describe("7. self-connection rejected", () => {
  it("returns an error and creates nothing", async () => {
    seedMemory("mem-1", "user-1");
    const result = await createConnection("user-1", {
      sourceMemoryId: "mem-1",
      targetMemoryId: "mem-1",
      connectionType: "user_linked",
      source: "user",
    });
    expect("error" in result).toBe(true);
    expect(store.connections).toHaveLength(0);
  });
});

describe("8 + 9. cross-user source/target rejected", () => {
  it("rejects cross-user source memory", async () => {
    seedMemory("mem-1", "user-2"); // owned by user-2
    seedMemory("mem-2", "user-1");
    const result = await createConnection("user-1", {
      sourceMemoryId: "mem-1",
      targetMemoryId: "mem-2",
      connectionType: "user_linked",
      source: "user",
    });
    expect("error" in result).toBe(true);
    expect(store.connections).toHaveLength(0);
  });

  it("rejects cross-user target memory", async () => {
    seedMemory("mem-1", "user-1");
    seedMemory("mem-2", "user-2"); // owned by user-2
    const result = await createConnection("user-1", {
      sourceMemoryId: "mem-1",
      targetMemoryId: "mem-2",
      connectionType: "user_linked",
      source: "user",
    });
    expect("error" in result).toBe(true);
    expect(store.connections).toHaveLength(0);
  });
});

describe("6. same connection cannot be duplicated", () => {
  it("rejects a second identical connection", async () => {
    seedMemory("mem-1", "user-1");
    seedMemory("mem-2", "user-1");
    const first = await createConnection("user-1", {
      sourceMemoryId: "mem-1",
      targetMemoryId: "mem-2",
      connectionType: "user_linked",
      source: "user",
    });
    expect("connectionId" in first).toBe(true);

    const second = await createConnection("user-1", {
      sourceMemoryId: "mem-1",
      targetMemoryId: "mem-2",
      connectionType: "user_linked",
      source: "user",
    });
    expect("error" in second).toBe(true);
    expect(store.connections).toHaveLength(1);
  });
});

describe("10. user-linked connection persists", () => {
  it("creates a connection with source=user", async () => {
    seedMemory("mem-1", "user-1");
    seedMemory("mem-2", "user-1");
    const result = await createConnection("user-1", {
      sourceMemoryId: "mem-1",
      targetMemoryId: "mem-2",
      connectionType: "user_linked",
      source: "user",
    });
    expect("connectionId" in result).toBe(true);
    expect(store.connections[0].source).toBe("user");
    expect(store.connections[0].connection_type).toBe("user_linked");
  });
});

describe("11. connection deletion works", () => {
  it("removes a connection by id (owned)", async () => {
    seedMemory("mem-1", "user-1");
    seedMemory("mem-2", "user-1");
    const created = await createConnection("user-1", {
      sourceMemoryId: "mem-1",
      targetMemoryId: "mem-2",
      connectionType: "user_linked",
      source: "user",
    });
    expect("connectionId" in created).toBe(true);
    const id = (created as { connectionId: string }).connectionId;
    const ok = await deleteConnection("user-1", id);
    expect(ok).toBe(true);
    expect(store.connections).toHaveLength(0);
  });
});

describe("12. related memories query returns only owned memories", () => {
  it("returns only the current user's related memories", async () => {
    seedMemory("mem-1", "user-1");
    seedMemory("mem-2", "user-1");
    seedMemory("mem-3", "user-2"); // different user
    await createConnection("user-1", {
      sourceMemoryId: "mem-1",
      targetMemoryId: "mem-2",
      connectionType: "user_linked",
      source: "user",
    });
    const related = await findRelatedMemories("user-1", "mem-1");
    expect(related).toHaveLength(1);
    expect(related[0].memoryId).toBe("mem-2");
  });
});

describe("13. connection reason is displayed correctly", () => {
  it("uses the stored reason when present, else a label", async () => {
    seedMemory("mem-1", "user-1");
    seedMemory("mem-2", "user-1");
    await createConnection("user-1", {
      sourceMemoryId: "mem-1",
      targetMemoryId: "mem-2",
      connectionType: "user_linked",
      source: "user",
      reason: "These two belong together",
    });
    const related = await findRelatedMemories("user-1", "mem-1");
    expect(related[0].reason).toBe("These two belong together");
  });

  it("falls back to a label when no reason", async () => {
    seedMemory("mem-1", "user-1");
    seedMemory("mem-2", "user-1");
    await createConnection("user-1", {
      sourceMemoryId: "mem-1",
      targetMemoryId: "mem-2",
      connectionType: "user_linked",
      source: "user",
    });
    const related = await findRelatedMemories("user-1", "mem-1");
    expect(related[0].reason).toBe("Linked by you");
  });
});

describe("15. original memories are never modified by connection creation", () => {
  it("connection creation leaves both memories' notes untouched", async () => {
    seedMemory("mem-1", "user-1", { original_user_note: "note 1", user_note: "note 1" });
    seedMemory("mem-2", "user-1", { original_user_note: "note 2", user_note: "note 2" });
    await createConnection("user-1", {
      sourceMemoryId: "mem-1",
      targetMemoryId: "mem-2",
      connectionType: "user_linked",
      source: "user",
    });
    expect(store.memories.get("mem-1")!.original_user_note).toBe("note 1");
    expect(store.memories.get("mem-2")!.original_user_note).toBe("note 2");
    expect(store.memories.get("mem-1")!.user_note).toBe("note 1");
    expect(store.memories.get("mem-2")!.user_note).toBe("note 2");
  });
});

// ---------------------------------------------------------------------------
// AI suggestion boundary tests (server-side, never auto-persisted)
// ---------------------------------------------------------------------------
import { suggestConnectionLogic } from "@/lib/llm/suggestConnection.server";
import {
  buildSuggestConnectionPrompt,
  parseSuggestConnectionResponse,
} from "@/lib/llm/suggestConnection";

const SOURCE_INPUT = {
  memory: {
    id: "mem-1",
    originalUserNote: "On the train in 2004",
    userNote: "On the train in 2004",
    feeling: null,
    lifeEvent: null,
    location: "on the train",
    weather: null,
    eventTime: { label: "2004" },
    musicExperiences: [
      {
        musicExperienceId: "exp-1",
        position: 0,
        role: null,
        experience: {
          id: "exp-1",
          sourceType: "streaming" as const,
          title: "Hoppípolla",
          artist: "Sigur Rós",
          album: null,
          externalRef: null,
          sourceNotes: null,
        },
      },
    ],
  },
  candidates: [
    {
      id: "mem-2",
      originalUserNote: "Train ride to school",
      userNote: "Train ride to school",
      feeling: null,
      lifeEvent: null,
      location: "on the train",
      weather: null,
      eventTime: { label: "2005" },
      musicExperiences: [
        {
          musicExperienceId: "exp-2",
          position: 0,
          role: null,
          experience: {
            id: "exp-2",
            sourceType: "streaming" as const,
            title: null,
            artist: "Radiohead",
            album: null,
            externalRef: null,
            sourceNotes: null,
          },
        },
      ],
    },
  ],
};

describe("16. optional AI suggestion is never auto-persisted", () => {
  it("suggestConnectionLogic returns a suggestion but creates no connection", async () => {
    runRoleImpl = async () =>
      JSON.stringify({
        candidateMemoryId: "mem-2",
        reason: "Both mention trains.",
        confidence: 0.6,
      });

    const result = await suggestConnectionLogic(SOURCE_INPUT);
    expect(result.suggestion).not.toBeNull();
    expect(result.suggestion!.candidateMemoryId).toBe("mem-2");

    // Nothing persisted by the suggestion logic.
    expect(store.connections).toHaveLength(0);
  });
});

describe("17. optional AI rejection leaves no connection", () => {
  it("dismissing (never accepting) creates no connection", async () => {
    runRoleImpl = async () =>
      JSON.stringify({ candidateMemoryId: "mem-2", reason: "x", confidence: 0.5 });
    const result = await suggestConnectionLogic(SOURCE_INPUT);
    // UI would dismiss here; no createConnection call is made.
    expect(result.suggestion).not.toBeNull();
    expect(store.connections).toHaveLength(0);
  });
});

describe("18. optional AI acceptance creates an explicitly marked connection", () => {
  it("accepting persists source=ai_suggested with the reason", async () => {
    seedMemory("mem-1", "user-1");
    seedMemory("mem-2", "user-1");
    runRoleImpl = async () =>
      JSON.stringify({
        candidateMemoryId: "mem-2",
        reason: "Both mention trains.",
        confidence: 0.6,
      });

    const suggestion = await suggestConnectionLogic(SOURCE_INPUT);
    expect(suggestion.suggestion).not.toBeNull();

    // The UI explicitly accepts → calls createConnection.
    const created = await createConnection("user-1", {
      sourceMemoryId: "mem-1",
      targetMemoryId: suggestion.suggestion!.candidateMemoryId,
      connectionType: "user_linked",
      source: "ai_suggested",
      confidence: suggestion.suggestion!.confidence,
      reason: suggestion.suggestion!.reason,
      metadata: { savedFrom: "ai_suggested" },
    });
    expect("connectionId" in created).toBe(true);
    expect(store.connections).toHaveLength(1);
    expect(store.connections[0].source).toBe("ai_suggested");
    expect(store.connections[0].reason).toBe("Both mention trains.");
  });
});

describe("9 + 10 (suggestion). missing key / network failure returns null", () => {
  it("returns null when runRole returns null (no key)", async () => {
    runRoleImpl = null;
    const result = await suggestConnectionLogic(SOURCE_INPUT);
    expect(result.suggestion).toBeNull();
  });
  it("returns null on network failure and does not throw", async () => {
    runRoleImpl = async () => {
      throw new Error("network down");
    };
    const result = await suggestConnectionLogic(SOURCE_INPUT);
    expect(result.suggestion).toBeNull();
  });
});

describe("19. malformed AI suggestion is ignored safely", () => {
  it("returns null on non-JSON", () => {
    expect(parseSuggestConnectionResponse("not json", new Set(["mem-2"]))).toBeNull();
  });
  it("returns null when candidateMemoryId is not among valid candidates", () => {
    const out = JSON.stringify({ candidateMemoryId: "mem-999", reason: "x", confidence: 0.5 });
    expect(parseSuggestConnectionResponse(out, new Set(["mem-2"]))).toBeNull();
  });
  it("returns null on missing reason", () => {
    const out = JSON.stringify({ candidateMemoryId: "mem-2", confidence: 0.5 });
    expect(parseSuggestConnectionResponse(out, new Set(["mem-2"]))).toBeNull();
  });
  it("returns null on out-of-range confidence", () => {
    const out = JSON.stringify({ candidateMemoryId: "mem-2", reason: "x", confidence: 1.5 });
    expect(parseSuggestConnectionResponse(out, new Set(["mem-2"]))).toBeNull();
  });
  it("returns null on the literal word null", () => {
    expect(parseSuggestConnectionResponse("null", new Set(["mem-2"]))).toBeNull();
  });
  it("tolerates code-fenced JSON", () => {
    const fenced =
      "```json\n" +
      JSON.stringify({ candidateMemoryId: "mem-2", reason: "x", confidence: 0.5 }) +
      "\n```";
    const parsed = parseSuggestConnectionResponse(fenced, new Set(["mem-2"]));
    expect(parsed).not.toBeNull();
    expect(parsed!.candidateMemoryId).toBe("mem-2");
  });
});

describe("grounding prompt forbids invented facts", () => {
  const prompt = buildSuggestConnectionPrompt(SOURCE_INPUT);
  it("forbids inventing facts", () => {
    expect(prompt).toContain("Do not invent facts");
  });
  it("forbids claiming user psychology", () => {
    expect(prompt).toContain("psychology");
  });
  it("requires uncertainty language", () => {
    expect(prompt).toContain("uncertainty language");
  });
  it("states the suggestion is advisory", () => {
    expect(prompt).toContain("advisory");
  });
});

describe("20. no provider keys in client bundle (code boundary)", () => {
  it("the prompt module references no provider keys", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/llm/suggestConnection.ts", "utf8");
    for (const k of ["GROQ_API_KEY", "GEMINI_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY"]) {
      expect(src).not.toContain(k);
    }
  });
  it("the server fn module reads no env directly", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/llm/suggestConnection.server.ts", "utf8");
    for (const k of ["GROQ_API_KEY", "GEMINI_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY"]) {
      expect(src).not.toContain(k);
    }
    expect(src).not.toMatch(/process\.env/);
  });
  it("the route UI imports the server fn, not orchestra", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/routes/memory.$memoryId.tsx", "utf8");
    expect(src).toContain("suggestConnection.server");
    expect(src).not.toContain("@/lib/llm/orchestra");
    expect(src).not.toContain("runRole");
  });
});
