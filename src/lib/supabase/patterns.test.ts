import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the Pattern Engine persistence layer + AI interpretation boundary.
 *
 * Scenarios covered:
 *   - 13. cross-user patterns rejected
 *   - 15. dismissed pattern status works
 *   - 16. deleting a pattern does not delete memories
 *   - 17. deleting a memory removes corresponding pattern evidence safely
 *   - 18. pattern UI shows evidence count (via listPatterns)
 *   - 19. related memories are user-owned only
 *   - 20. AI interpretation is optional
 *   - 21. missing provider key returns null interpretation
 *   - 22. network failure returns null interpretation
 *   - 23. malformed AI response returns null interpretation
 *   - 24. AI interpretation never auto-modifies source memory
 *   - 25. client bundle contains no provider key (code boundary)
 *   - 26. no direct provider call from browser (code boundary)
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
type FakePattern = {
  id: string;
  user_id: string;
  pattern_type: string;
  title: string;
  summary: string;
  confidence: number;
  observed_from: string | null;
  observed_to: string | null;
  status: string;
  fingerprint: string;
  evidence_count: number;
  interpretation: string | null;
  interpretation_model: string | null;
  interpretation_prompt_version: string | null;
  interpretation_created_at: string | null;
  created_at: string;
  updated_at: string;
};
type FakePatternMemory = {
  id: string;
  pattern_id: string;
  memory_id: string;
  user_id: string;
  evidence_role: string | null;
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
  patterns: FakePattern[];
  patternMemories: FakePatternMemory[];
  nextPatternId: number;
  nextPmId: number;
} = {
  memories: new Map(),
  patterns: [],
  patternMemories: [],
  nextPatternId: 1,
  nextPmId: 1,
};

let currentFake: SupabaseFake | null = null;

type FakeThenable = {
  select: (cols?: string) => FakeThenable;
  eq: (col: string, val: unknown) => FakeThenable;
  neq: (col: string, val: unknown) => FakeThenable;
  in: (col: string, vals: unknown[]) => FakeThenable;
  order: () => FakeThenable;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  then: (resolve: (v: unknown) => unknown) => unknown;
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

// Mock memory-remote so patterns-remote's listMemories/listReflections/loadMemory
// use our fake store.
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
  listReflections: async () => [],
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

import {
  createPattern,
  deletePattern,
  dismissPattern,
  listPatternEvidence,
  listPatterns,
  loadPattern,
  loadPatternRelatedMemories,
  savePatternInterpretation,
} from "./patterns-remote";
import { interpretPatternLogic } from "@/lib/llm/interpretPattern.server";
import { parseInterpretPatternResponse } from "@/lib/llm/interpretPattern";
import type { PatternCandidate } from "@/lib/memory/types";

function makeFake(): SupabaseFake {
  const f: SupabaseFake = {
    from: (table: string) => {
      const eqs: Array<[string, unknown]> = [];
      const neqs: Array<[string, unknown]> = [];
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
        maybeSingle: async () => {
          // patterns select by id + user_id
          if (table === "patterns") {
            const idEq = eqs.find(([c]) => c === "id");
            const userEq = eqs.find(([c]) => c === "user_id");
            const row = store.patterns.find(
              (p) => p.id === String(idEq?.[1]) && p.user_id === String(userEq?.[1]),
            );
            return { data: row ?? null, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve) => {
          if (table === "patterns") {
            const userEq = eqs.find(([c]) => c === "user_id");
            let rows = store.patterns.filter((p) => p.user_id === String(userEq?.[1]));
            const statusNeq = neqs.find(([c]) => c === "status");
            if (statusNeq) rows = rows.filter((p) => p.status !== String(statusNeq[1]));
            return resolve({ data: rows, error: null });
          }
          if (table === "pattern_memories") {
            const userEq = eqs.find(([c]) => c === "user_id");
            const patEq = eqs.find(([c]) => c === "pattern_id");
            const rows = store.patternMemories.filter(
              (pm) =>
                pm.user_id === String(userEq?.[1]) &&
                (!patEq || pm.pattern_id === String(patEq[1])),
            );
            return resolve({ data: rows, error: null });
          }
          if (table === "memories") {
            const userEq = eqs.find(([c]) => c === "user_id");
            const rows = Array.from(store.memories.values()).filter(
              (m) => m.user_id === String(userEq?.[1]),
            );
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
          if (table === "memory_music_experiences") {
            const userEq = eqs.find(([c]) => c === "user_id");
            const rows: Array<{
              memory_id: string;
              music_experience_id: string;
              position: number;
            }> = [];
            for (const m of store.memories.values()) {
              if (userEq && m.user_id !== String(userEq[1])) continue;
              for (const e of m.experiences) {
                rows.push({ memory_id: m.id, music_experience_id: e.id, position: e.position });
              }
            }
            return resolve({ data: rows, error: null });
          }
          if (table === "music_experiences") {
            const rows: Array<{ id: string; title: string | null; artist: string | null }> = [];
            for (const m of store.memories.values()) {
              for (const e of m.experiences) {
                rows.push({ id: e.id, title: e.title, artist: e.artist });
              }
            }
            return resolve({ data: rows, error: null });
          }
          return resolve({ data: [], error: null });
        },
        update: (patch) => {
          // Stash the patch for the terminal then()/eq chain.
          (thenable as unknown as { _patch: Record<string, unknown> })._patch = patch;
          return thenable;
        },
        delete: () => thenable,
      };
      return thenable;
    },
    rpc: async (name, args) => {
      if (name !== "create_pattern_atomic") return { data: null, error: "unknown rpc" };
      const p = args ?? {};
      const userId = String(p.p_user_id);
      const evidence = p.p_evidence as Array<{ memory_id: string; evidence_role?: string }>;

      if (!evidence || evidence.length === 0) {
        return { data: null, error: { message: "no evidence" } };
      }

      // Verify every evidence memory belongs to the caller.
      for (const e of evidence) {
        const m = store.memories.get(e.memory_id);
        if (!m) return { data: null, error: { message: "evidence memory not found" } };
        if (m.user_id !== userId) {
          return { data: null, error: { message: "cross-user evidence memory" } };
        }
      }

      // Duplicate fingerprint check.
      const dup = store.patterns.find(
        (pat) =>
          pat.user_id === userId &&
          pat.pattern_type === String(p.p_pattern_type) &&
          pat.fingerprint === String(p.p_fingerprint),
      );
      if (dup) return { data: null, error: { message: "duplicate pattern" } };

      const id = `pat-${store.nextPatternId++}`;
      store.patterns.push({
        id,
        user_id: userId,
        pattern_type: String(p.p_pattern_type),
        title: String(p.p_title),
        summary: String(p.p_summary),
        confidence: Number(p.p_confidence),
        observed_from: (p.p_observed_from as string | null) ?? null,
        observed_to: (p.p_observed_to as string | null) ?? null,
        status: String(p.p_status),
        fingerprint: String(p.p_fingerprint),
        evidence_count: Number(p.p_evidence_count),
        interpretation: null,
        interpretation_model: null,
        interpretation_prompt_version: null,
        interpretation_created_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      for (const e of evidence) {
        store.patternMemories.push({
          id: `pm-${store.nextPmId++}`,
          pattern_id: id,
          memory_id: e.memory_id,
          user_id: userId,
          evidence_role: e.evidence_role ?? null,
          created_at: new Date().toISOString(),
        });
      }
      return { data: id, error: null };
    },
  };
  return f;
}

// The update()/delete() terminal needs to apply side-effects. Override the
// then() handler so update by id+user_id mutates store, and delete removes.
function makeMutableFake(): SupabaseFake {
  const base = makeFake();
  const origFrom = base.from.bind(base);
  base.from = ((table: string) => {
    const inner = origFrom(table);
    const eqs: Array<[string, unknown]> = [];
    return {
      ...inner,
      eq: (col: string, val: unknown) => {
        eqs.push([col, val]);
        return {
          eq: (col2: string, val2: unknown) => {
            eqs.push([col2, val2]);
            return Promise.resolve({ error: null });
          },
          then: (resolve: (v: unknown) => unknown) => {
            applyMutation(table, eqs, inner);
            return resolve({ error: null });
          },
        };
      },
      update: (patch: Record<string, unknown>) => {
        (inner as unknown as { _patch: Record<string, unknown> })._patch = patch;
        return {
          eq: (col: string, val: unknown) => {
            eqs.push([col, val]);
            return {
              eq: (col2: string, val2: unknown) => {
                eqs.push([col2, val2]);
                applyMutation(table, eqs, { _patch: patch } as unknown as FakeThenable);
                return Promise.resolve({ error: null });
              },
              then: (resolve: (v: unknown) => unknown) => {
                applyMutation(table, eqs, { _patch: patch } as unknown as FakeThenable);
                return resolve({ error: null });
              },
            };
          },
        };
      },
      delete: () => ({
        eq: (col: string, val: unknown) => {
          eqs.push([col, val]);
          return {
            eq: (col2: string, val2: unknown) => {
              eqs.push([col2, val2]);
              applyDelete(table, eqs);
              return Promise.resolve({ error: null });
            },
            then: (resolve: (v: unknown) => unknown) => {
              applyDelete(table, eqs);
              return resolve({ error: null });
            },
          };
        },
      }),
    } as unknown as FakeThenable;
  }) as (table: string) => FakeThenable;
  return base;
}

function applyMutation(table: string, eqs: Array<[string, unknown]>, inner: FakeThenable) {
  const patch = (inner as unknown as { _patch?: Record<string, unknown> })._patch;
  if (!patch) return;
  const idEq = eqs.find(([c]) => c === "id");
  const userEq = eqs.find(([c]) => c === "user_id");
  if (table === "patterns" && idEq && userEq) {
    const id = String(idEq[1]);
    const uid = String(userEq[1]);
    store.patterns = store.patterns.map((p) =>
      p.id === id && p.user_id === uid ? { ...p, ...patch } : p,
    );
  }
}

function applyDelete(table: string, eqs: Array<[string, unknown]>) {
  const idEq = eqs.find(([c]) => c === "id");
  const userEq = eqs.find(([c]) => c === "user_id");
  if (table === "patterns" && idEq && userEq) {
    const id = String(idEq[1]);
    const uid = String(userEq[1]);
    store.patterns = store.patterns.filter((p) => !(p.id === id && p.user_id === uid));
    store.patternMemories = store.patternMemories.filter((pm) => pm.pattern_id !== id);
  }
}

beforeEach(() => {
  store.memories.clear();
  store.patterns = [];
  store.patternMemories = [];
  store.nextPatternId = 1;
  store.nextPmId = 1;
  currentFake = makeMutableFake();
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

function candidate(
  overrides: Partial<PatternCandidate> & { fingerprint: string },
): PatternCandidate {
  return {
    patternType: "repeated_music",
    title: "A song that follows you",
    summary: "Appears in 2 memories.",
    confidence: 1.0,
    evidenceCount: 2,
    observedFrom: null,
    observedTo: null,
    evidence: [
      { memoryId: "m1", evidenceRole: "Contains this music experience" },
      { memoryId: "m2", evidenceRole: "Contains this music experience" },
    ],
    ...overrides,
  };
}

describe("13. cross-user patterns rejected", () => {
  it("rejects creation when an evidence memory belongs to another user", async () => {
    seedMemory("m1", "user-1");
    seedMemory("m2", "user-2"); // different owner
    const result = await createPattern("user-1", candidate({ fingerprint: "fp-1" }));
    expect("error" in result).toBe(true);
    expect(store.patterns).toHaveLength(0);
  });

  it("listPatterns returns only the caller's patterns", async () => {
    seedMemory("m1", "user-1");
    seedMemory("m2", "user-1");
    seedMemory("m3", "user-2");
    await createPattern(
      "user-1",
      candidate({
        fingerprint: "fp-1",
        evidence: [
          { memoryId: "m1", evidenceRole: null },
          { memoryId: "m2", evidenceRole: null },
        ],
      }),
    );
    await createPattern(
      "user-2",
      candidate({ fingerprint: "fp-2", evidence: [{ memoryId: "m3", evidenceRole: null }] }),
    );
    const u1 = await listPatterns("user-1", false);
    const u2 = await listPatterns("user-2", false);
    expect(u1).toHaveLength(1);
    expect(u2).toHaveLength(1);
  });
});

describe("15. dismissed pattern status works", () => {
  it("dismissPattern sets status=dismissed and hides from default list", async () => {
    seedMemory("m1", "user-1");
    seedMemory("m2", "user-1");
    const created = await createPattern("user-1", candidate({ fingerprint: "fp-1" }));
    const id = (created as { patternId: string }).patternId;

    const ok = await dismissPattern("user-1", id);
    expect(ok).toBe(true);

    const visible = await listPatterns("user-1", false);
    expect(visible.find((p) => p.id === id)).toBeUndefined();
    const all = await listPatterns("user-1", true);
    expect(all.find((p) => p.id === id)?.status).toBe("dismissed");
  });
});

describe("16. deleting a pattern does not delete memories", () => {
  it("deletePattern removes pattern + evidence but keeps memories", async () => {
    seedMemory("m1", "user-1");
    seedMemory("m2", "user-1");
    const created = await createPattern("user-1", candidate({ fingerprint: "fp-1" }));
    const id = (created as { patternId: string }).patternId;

    const ok = await deletePattern("user-1", id);
    expect(ok).toBe(true);
    expect(store.patterns).toHaveLength(0);
    expect(store.patternMemories).toHaveLength(0);
    // Memories untouched.
    expect(store.memories.has("m1")).toBe(true);
    expect(store.memories.has("m2")).toBe(true);
  });
});

describe("17. deleting a memory removes corresponding pattern evidence safely", () => {
  it("removing a memory from the store leaves the pattern intact (evidence shrinks)", async () => {
    seedMemory("m1", "user-1");
    seedMemory("m2", "user-1");
    const created = await createPattern("user-1", candidate({ fingerprint: "fp-1" }));
    const id = (created as { patternId: string }).patternId;

    // Simulate memory deletion (in real DB, ON DELETE CASCADE removes pattern_memories).
    store.memories.delete("m1");
    store.patternMemories = store.patternMemories.filter((pm) => pm.memory_id !== "m1");

    const evidence = await listPatternEvidence("user-1", id);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].memoryId).toBe("m2");
    // Pattern still exists.
    const pat = await loadPattern("user-1", id);
    expect(pat).not.toBeNull();
  });
});

describe("18. pattern UI shows evidence count", () => {
  it("listPatterns returns patterns with evidenceCount", async () => {
    seedMemory("m1", "user-1");
    seedMemory("m2", "user-1");
    await createPattern("user-1", candidate({ fingerprint: "fp-1", evidenceCount: 2 }));
    const list = await listPatterns("user-1", false);
    expect(list[0].evidenceCount).toBe(2);
  });
});

describe("19. related memories are user-owned only", () => {
  it("loadPatternRelatedMemories returns only owned memories", async () => {
    seedMemory("m1", "user-1");
    seedMemory("m2", "user-1");
    // m3 belongs to user-2 but is NOT evidence (RLS would block it anyway).
    seedMemory("m3", "user-2");
    const created = await createPattern("user-1", candidate({ fingerprint: "fp-1" }));
    const id = (created as { patternId: string }).patternId;
    const related = await loadPatternRelatedMemories("user-1", id);
    expect(related).toHaveLength(2);
    expect(related.map((r) => r.memoryId).sort()).toEqual(["m1", "m2"]);
  });
});

// ---------------------------------------------------------------------------
// AI interpretation boundary tests
// ---------------------------------------------------------------------------

const PATTERN_INPUT = {
  pattern: {
    patternType: "repeated_music" as const,
    title: "A song that follows you",
    summary: "Appears in 3 of your memories.",
    evidenceCount: 3,
    observedFrom: "2023-01-01T00:00:00Z",
    observedTo: "2024-06-01T00:00:00Z",
  },
  relatedMemories: [
    { title: "High Hopes — Pink Floyd", excerpt: "On the train in 2004", eventTimeLabel: "2004" },
    { title: "High Hopes — Pink Floyd", excerpt: "A rainy night", eventTimeLabel: "2010" },
    { title: "High Hopes — Pink Floyd", excerpt: "Coming home", eventTimeLabel: "2024" },
  ],
};

describe("20. AI interpretation is optional", () => {
  it("interpretPatternLogic returns null when no provider is configured", async () => {
    runRoleImpl = null;
    const out = await interpretPatternLogic(PATTERN_INPUT);
    expect(out.interpretation).toBeNull();
  });
});

describe("21. missing provider key returns null interpretation", () => {
  it("returns null when runRole returns null", async () => {
    runRoleImpl = async () => null;
    const out = await interpretPatternLogic(PATTERN_INPUT);
    expect(out.interpretation).toBeNull();
  });
});

describe("22. network failure returns null interpretation", () => {
  it("returns null and does not throw on runRole rejection", async () => {
    runRoleImpl = async () => {
      throw new Error("network down");
    };
    const out = await interpretPatternLogic(PATTERN_INPUT);
    expect(out.interpretation).toBeNull();
  });
});

describe("23. malformed AI response returns null interpretation", () => {
  it("returns null for empty response", () => {
    expect(parseInterpretPatternResponse("")).toBeNull();
    expect(parseInterpretPatternResponse("   ")).toBeNull();
  });
  it("returns null for JSON-shaped output", () => {
    expect(parseInterpretPatternResponse('{"x":1}')).toBeNull();
  });
  it("returns null for code-fenced output", () => {
    expect(parseInterpretPatternResponse("```\nprose\n```")).toBeNull();
  });
  it("returns trimmed prose for a valid response", () => {
    expect(parseInterpretPatternResponse("  One possible interpretation is...  ")).toBe(
      "One possible interpretation is...",
    );
  });
});

describe("24. AI interpretation never auto-modifies source memory", () => {
  it("savePatternInterpretation writes ONLY interpretation_* fields", async () => {
    seedMemory("m1", "user-1");
    seedMemory("m2", "user-1");
    const created = await createPattern("user-1", candidate({ fingerprint: "fp-1" }));
    const id = (created as { patternId: string }).patternId;

    const before = { ...store.memories.get("m1")! };
    const ok = await savePatternInterpretation(
      "user-1",
      id,
      "One possible interpretation is...",
      "summarizer",
      "pattern-interpret-v1",
    );
    expect(ok).toBe(true);
    // Source memory untouched.
    expect(store.memories.get("m1")).toEqual(before);
    // Pattern interpretation field set.
    const pat = store.patterns.find((p) => p.id === id)!;
    expect(pat.interpretation).toBe("One possible interpretation is...");
    expect(pat.interpretation_model).toBe("summarizer");
  });
});

describe("25. client bundle contains no provider key (code boundary)", () => {
  it("the prompt module references no provider keys", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/llm/interpretPattern.ts", "utf8");
    for (const k of ["GROQ_API_KEY", "GEMINI_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY"]) {
      expect(src).not.toContain(k);
    }
  });
  it("the server fn module reads no env directly", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/llm/interpretPattern.server.ts", "utf8");
    for (const k of ["GROQ_API_KEY", "GEMINI_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY"]) {
      expect(src).not.toContain(k);
    }
    expect(src).not.toMatch(/process\.env/);
  });
});

describe("26. no direct provider call from browser (code boundary)", () => {
  it("the patterns route imports the server fn, not orchestra", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/routes/patterns.tsx", "utf8");
    expect(src).toContain("interpretPattern.server");
    expect(src).not.toContain("@/lib/llm/orchestra");
    expect(src).not.toContain("runRole");
  });
  it("the pure patterns module references no orchestra/network", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/memory/patterns.ts", "utf8");
    expect(src).not.toContain("runRole");
    expect(src).not.toContain("orchestra");
    expect(src).not.toContain("fetch(");
    expect(src).not.toContain("getSupabase");
  });
});

describe("grounding prompt forbids diagnosis and invention", () => {
  it("forbids inventing facts and diagnosing", async () => {
    const { buildInterpretPatternPrompt } = await import("@/lib/llm/interpretPattern");
    const prompt = buildInterpretPatternPrompt(PATTERN_INPUT);
    expect(prompt).toContain("Do not invent facts");
    expect(prompt).toContain("Do not diagnose");
    expect(prompt).toContain("advisory");
    expect(prompt).toContain("One possible interpretation is");
  });
});
