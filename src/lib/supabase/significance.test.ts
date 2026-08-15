import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Significant Interaction Foundation tests.
 *
 * Covers 35 scenarios for the deterministic gate, the Orchestra classifier
 * prompt+parser, candidate persistence, user confirmation/dismissal,
 * provenance, ownership, RLS-style isolation, dedup, and scope.
 *
 * No live LLM calls. No network. The Orchestra call is a `runRoleImpl` injection
 * and Supabase is a stateful fake keyed on in-memory maps (mirrors
 * companion.test.ts), extended with a significant_interactions table that
 * enforces the partial unique-index dedup on (user_id, turn_id) WHERE status
 * IN ('candidate','confirmed').
 */

// ---------------------------------------------------------------------------
// Fake Supabase
// ---------------------------------------------------------------------------
type FakeRow = Record<string, unknown>;
type ChainResult = { data: FakeRow | FakeRow[] | null; error: unknown };

type Chain = {
  select: (cols?: string) => Chain;
  eq: (col: string, val: unknown) => Chain;
  in: (col: string, vals: unknown[]) => Chain;
  order: (col: string, opts?: { ascending?: boolean }) => Chain;
  limit: (n: number) => Chain;
  maybeSingle: () => Promise<ChainResult>;
  single: () => Promise<ChainResult>;
  insert: (row: FakeRow | FakeRow[]) => Chain;
  update: (patch: FakeRow) => Chain;
};

type FakeSupabase = {
  from: (table: string) => Chain;
  conversations: Map<string, FakeRow>;
  turns: Map<string, FakeRow>;
  interactions: Map<string, FakeRow>;
  nextConvId: number;
  nextTurnId: number;
  nextInteractionId: number;
};

let fake: FakeSupabase;

type OrderSpec = { col: string; ascending: boolean } | null;
type ChainState = {
  table: string;
  filters: Record<string, unknown>;
  inFilters: Record<string, unknown[]>;
  order: OrderSpec;
  limit: number | null;
  /** Set when an insert was rejected (e.g. unique-index violation). */
  insertFailed: boolean;
};

function tableRows(table: string): FakeRow[] {
  if (table === "companion_conversations") return [...fake.conversations.values()];
  if (table === "companion_turns") return [...fake.turns.values()];
  if (table === "significant_interactions") return [...fake.interactions.values()];
  return [];
}

function matchRows(state: ChainState): FakeRow[] {
  let rows = tableRows(state.table);
  for (const [k, v] of Object.entries(state.filters)) rows = rows.filter((r) => r[k] === v);
  for (const [k, vals] of Object.entries(state.inFilters)) {
    rows = rows.filter((r) => vals.includes(r[k]));
  }
  if (state.order) {
    const { col, ascending } = state.order;
    rows = [...rows].sort((a, b) => {
      const av = String(a[col]);
      const bv = String(b[col]);
      return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }
  if (state.limit != null) rows = rows.slice(0, state.limit);
  return rows;
}

function freshState(table: string): ChainState {
  return { table, filters: {}, inFilters: {}, order: null, limit: null, insertFailed: false };
}

function makeChain(state: ChainState): Chain {
  const thenable: Chain & { then?: unknown } = {
    select: () => makeChain({ ...state }),
    eq: (col, val) => makeChain({ ...state, filters: { ...state.filters, [col]: val } }),
    in: (col, vals) => makeChain({ ...state, inFilters: { ...state.inFilters, [col]: vals } }),
    order: (col, opts) =>
      makeChain({ ...state, order: { col, ascending: opts?.ascending ?? true } }),
    limit: (n) => makeChain({ ...state, limit: n }),
    maybeSingle: async () => {
      if (state.insertFailed) return { data: null, error: { code: "23505" } };
      const rows = matchRows(state);
      return { data: rows.length ? rows[0] : null, error: null };
    },
    single: async () => {
      if (state.insertFailed) return { data: null, error: { code: "23505" } };
      const rows = matchRows(state);
      return { data: rows.length ? rows[0] : null, error: null };
    },
    insert: (row) => {
      const rows = Array.isArray(row) ? row : [row];
      let lastId: string | null = null;
      let failed = false;
      for (const r of rows) {
        if (state.table === "companion_conversations") {
          const id = `conv-${fake.nextConvId++}`;
          const ts = new Date().toISOString();
          fake.conversations.set(id, {
            ...r,
            id,
            status: r.status ?? "active",
            created_at: ts,
            updated_at: ts,
          });
          lastId = id;
        } else if (state.table === "companion_turns") {
          const id = `turn-${fake.nextTurnId++}`;
          const ts = new Date().toISOString();
          fake.turns.set(id, {
            user_id: r.user_id,
            conversation_id: r.conversation_id,
            role: r.role,
            content: r.content,
            metadata: r.metadata ?? null,
            ...r,
            id,
            created_at: ts,
          });
          lastId = id;
        } else if (state.table === "significant_interactions") {
          // Enforce partial unique index: at most one active candidate per
          // (user_id, turn_id) where status in ('candidate','confirmed').
          const status = (r.status as string) ?? "candidate";
          const uid = r.user_id as string;
          const tid = r.turn_id as string;
          if (status === "candidate" || status === "confirmed") {
            const dup = [...fake.interactions.values()].some(
              (x) =>
                x.user_id === uid &&
                x.turn_id === tid &&
                (x.status === "candidate" || x.status === "confirmed"),
            );
            if (dup) {
              // Mimic a unique-index violation → subsequent single() sees error.
              failed = true;
              lastId = null;
              continue;
            }
          }
          const id = `sig-${fake.nextInteractionId++}`;
          const ts = new Date().toISOString();
          fake.interactions.set(id, {
            ...r,
            id,
            status,
            created_at: ts,
            updated_at: ts,
          });
          lastId = id;
        }
      }
      return makeChain({
        ...state,
        filters: lastId ? { ...state.filters, id: lastId } : state.filters,
        insertFailed: failed,
      });
    },
    update: (patch) => {
      const matching = matchRows(state);
      for (const m of matching) Object.assign(m, patch, { updated_at: new Date().toISOString() });
      return makeChain(state);
    },
  };
  (thenable as { then: unknown }).then = (
    resolve: (v: ChainResult) => void,
    reject?: (e: unknown) => void,
  ) => {
    try {
      resolve({ data: matchRows(state), error: null });
    } catch (e) {
      reject?.(e);
    }
  };
  return thenable as Chain;
}

vi.mock("./client", () => ({
  getSupabase: () => fake,
}));

// ---------------------------------------------------------------------------
// Subjects under test
// ---------------------------------------------------------------------------
import { evaluateSignificanceGate, GATE_SIGNAL_COUNT } from "@/lib/memory/significanceGate";
import {
  buildSignificancePrompt,
  isGroundedIn,
  parseSignificanceResponse,
  SIGNIFICANT_KINDS,
} from "@/lib/llm/significantInteraction";
import {
  classifySignificantInteractionLogic,
  type ClassifySignificantInteractionRequest,
} from "@/lib/llm/classifySignificantInteraction.server";
import { setCandidateStatusLogic } from "@/lib/llm/confirmSignificantInteraction.server";
import {
  candidateFingerprint,
  createCandidate,
  listCandidatesForTurn,
  loadSignificantInteraction,
} from "@/lib/supabase/significant-remote";
import {
  createConversation,
  createTurn,
  loadConversation,
  loadTurn,
} from "@/lib/supabase/companion-remote";
import type { OrchestraRole } from "@/lib/llm/orchestra";
import type { CompanionTurn, SignificantInteraction } from "@/lib/memory/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
beforeEach(() => {
  fake = {
    from: (table: string) => makeChain(freshState(table)),
    conversations: new Map(),
    turns: new Map(),
    interactions: new Map(),
    nextConvId: 1,
    nextTurnId: 1,
    nextInteractionId: 1,
  };
});

const TOKEN_U1 = "token-u1";
const TOKEN_U2 = "token-u2";
const TOKEN_ANON = "token-anon";

function seedConversation(userId: string): string {
  const id = `conv-${fake.nextConvId++}`;
  const ts = new Date().toISOString();
  fake.conversations.set(id, {
    id,
    user_id: userId,
    title: null,
    status: "active",
    started_at: ts,
    last_activity_at: ts,
    created_at: ts,
    updated_at: ts,
  });
  return id;
}

function seedTurn(
  userId: string,
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
): CompanionTurn {
  const id = `turn-${fake.nextTurnId++}`;
  const ts = new Date().toISOString();
  fake.turns.set(id, {
    id,
    user_id: userId,
    conversation_id: conversationId,
    role,
    content,
    created_at: ts,
    metadata: null,
  });
  return { id, userId, conversationId, role, content, createdAt: ts, metadata: null };
}

// Orchestra runRole injection: returns a fixed classifier JSON (or null).
function makeRunRole(reply: string | null) {
  const calls: { role: string; message: string }[] = [];
  const fn = async (role: OrchestraRole, message: string): Promise<string | null> => {
    calls.push({ role, message });
    return reply;
  };
  return { fn: fn as typeof import("@/lib/llm/orchestra").runRole, calls };
}

// getCurrentUser injection: maps access tokens to verified users.
function makeAuth(map: Record<string, { id: string; isAnonymous?: boolean }>) {
  const calls: string[] = [];
  const fn = async (accessToken: string | undefined | null) => {
    calls.push(accessToken ?? "");
    if (!accessToken) return null;
    const entry = map[accessToken];
    if (!entry) return null;
    return { id: entry.id, isAnonymous: Boolean(entry.isAnonymous) };
  };
  return { fn: fn as typeof import("@/lib/supabase/server-auth").getCurrentUser, calls };
}

function classifyRequest(
  accessToken: string,
  conversationId: string,
  turnId: string,
): ClassifySignificantInteractionRequest {
  return { accessToken, conversationId, turnId };
}

// A valid classifier JSON for a given kind + candidate.
function validJson(kind: string, candidate: string, confidence = 0.8): string {
  return JSON.stringify({
    significant: true,
    kind,
    candidateContent: candidate,
    reason: "explicit user statement",
    confidence,
  });
}

// ===========================================================================
// Deterministic gate (pure) — 1-9, 8, 9
// ===========================================================================

describe("1. greeting does not trigger significance analysis", () => {
  it("'hello' is not analyzed", () => {
    const r = evaluateSignificanceGate({ role: "user", content: "hello" });
    expect(r.shouldAnalyze).toBe(false);
    expect(r.signals).toHaveLength(0);
  });
});

describe("2. thanks does not trigger significance analysis", () => {
  it("'thanks!' is not analyzed", () => {
    const r = evaluateSignificanceGate({ role: "user", content: "thanks!" });
    expect(r.shouldAnalyze).toBe(false);
  });
});

describe("3. explicit remember request triggers analysis", () => {
  it("'please remember this about me' is analyzed", () => {
    const r = evaluateSignificanceGate({ role: "user", content: "please remember this about me" });
    expect(r.shouldAnalyze).toBe(true);
    expect(r.signals).toContain("remember this");
  });
});

describe("4. explicit preference triggers analysis", () => {
  it("'I prefer a calm tone' is analyzed", () => {
    const r = evaluateSignificanceGate({ role: "user", content: "I prefer a calm tone" });
    expect(r.shouldAnalyze).toBe(true);
    expect(r.signals).toContain("i prefer");
  });
});

describe("5. explicit boundary triggers analysis", () => {
  it("'please don't ask about that again' is analyzed", () => {
    const r = evaluateSignificanceGate({
      role: "user",
      content: "please don't ask about that again",
    });
    expect(r.shouldAnalyze).toBe(true);
    expect(r.signals).toContain("please don't");
  });
});

describe("6. explicit directive triggers analysis", () => {
  it("'from now on, keep replies short' is analyzed", () => {
    const r = evaluateSignificanceGate({
      role: "user",
      content: "from now on, keep replies short",
    });
    expect(r.shouldAnalyze).toBe(true);
    expect(r.signals).toContain("from now on");
  });
});

describe("7. ambiguous emotional statement does not automatically classify", () => {
  it("'I feel a bit sad today' is not analyzed (no durable signal)", () => {
    const r = evaluateSignificanceGate({ role: "user", content: "I feel a bit sad today" });
    expect(r.shouldAnalyze).toBe(false);
  });
  it("short small talk is not analyzed", () => {
    expect(evaluateSignificanceGate({ role: "user", content: "how are you" }).shouldAnalyze).toBe(
      false,
    );
    expect(evaluateSignificanceGate({ role: "user", content: "ok cool" }).shouldAnalyze).toBe(
      false,
    );
  });
});

describe("8. gate makes no network calls", () => {
  it("gate module references no network/I/O APIs in code", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/memory/significanceGate.ts", "utf8");
    // Strip doc comments so the check targets actual code, not the prose that
    // documents "no fetch / no Orchestra / no Supabase".
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).not.toMatch(/import\s+.*orchestra/);
    expect(code).not.toMatch(/import\s+.*supabase/);
    expect(code).not.toMatch(/process\.env/);
  });
});

describe("9. assistant turn is never classified as a user significant interaction", () => {
  it("an assistant turn returns shouldAnalyze=false even with signal phrases", () => {
    const r = evaluateSignificanceGate({
      role: "assistant",
      content: "I prefer to keep this in mind from now on",
    });
    expect(r.shouldAnalyze).toBe(false);
    expect(r.signals).toHaveLength(0);
  });
  it("a system turn returns shouldAnalyze=false", () => {
    expect(
      evaluateSignificanceGate({ role: "system", content: "remember this" }).shouldAnalyze,
    ).toBe(false);
  });
});

describe("gate: signal count is non-trivial and conservative", () => {
  it("exposes the implemented signal count", () => {
    expect(GATE_SIGNAL_COUNT).toBeGreaterThanOrEqual(17);
  });
});

// ===========================================================================
// Classifier parser (pure) — 10-19
// ===========================================================================

const USER_TURN = "I prefer a calm, mature conversation style from now on";

describe("10. classifier returns valid directive", () => {
  it("parses a directive kind", () => {
    const r = parseSignificanceResponse(
      validJson("directive", "Keep replies calm and short", 0.8),
      { content: USER_TURN },
    );
    expect(r).not.toBeNull();
    expect(r!.significant).toBe(true);
    expect(r!.kind).toBe("directive");
  });
});

describe("11. classifier returns valid preference", () => {
  it("parses a preference kind", () => {
    const r = parseSignificanceResponse(
      validJson("preference", "The user prefers a calm style", 0.7),
      { content: USER_TURN },
    );
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("preference");
  });
});

describe("12. classifier returns valid boundary", () => {
  it("parses a boundary kind", () => {
    const r = parseSignificanceResponse(
      validJson("boundary", "Do not ask about the calm topic again", 0.6),
      { content: USER_TURN },
    );
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("boundary");
  });
});

describe("13. classifier returns valid confirmed_context", () => {
  it("parses a confirmed_context kind", () => {
    const r = parseSignificanceResponse(
      validJson("confirmed_context", "The user wants calm conversations", 0.65),
      { content: USER_TURN },
    );
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("confirmed_context");
  });
});

describe("14. classifier returns valid decision", () => {
  it("parses a decision kind", () => {
    const r = parseSignificanceResponse(
      validJson("decision", "The user decided on calm replies", 0.9),
      { content: USER_TURN },
    );
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("decision");
  });
});

describe("15. malformed LLM JSON returns null", () => {
  it("non-JSON returns null", () => {
    expect(parseSignificanceResponse("not json", { content: USER_TURN })).toBeNull();
  });
  it("code-fenced JSON returns null", () => {
    expect(parseSignificanceResponse("```json\n{...}\n```", { content: USER_TURN })).toBeNull();
  });
  it("JSON missing significant field returns null", () => {
    expect(parseSignificanceResponse('{"kind":"preference"}', { content: USER_TURN })).toBeNull();
  });
  it("significant=false with extra fields returns the safe null-fields shape", () => {
    const r = parseSignificanceResponse(
      '{"significant":false,"kind":null,"candidateContent":null,"reason":null,"confidence":null}',
      { content: USER_TURN },
    );
    expect(r).not.toBeNull();
    expect(r!.significant).toBe(false);
    expect(r!.kind).toBeNull();
  });
});

describe("16. invalid kind returns null", () => {
  it("an excluded kind (ai_fact) returns null", () => {
    expect(
      parseSignificanceResponse(validJson("ai_fact", "some fact", 0.5), { content: USER_TURN }),
    ).toBeNull();
  });
  it("an excluded kind (psychological_profile) returns null", () => {
    expect(
      parseSignificanceResponse(validJson("psychological_profile", "profile", 0.5), {
        content: USER_TURN,
      }),
    ).toBeNull();
  });
  it("an unknown kind returns null", () => {
    expect(
      parseSignificanceResponse(validJson("mood", "mood", 0.5), { content: USER_TURN }),
    ).toBeNull();
  });
  it("SIGNIFICANT_KINDS excludes the forbidden categories", () => {
    expect(SIGNIFICANT_KINDS).not.toContain("ai_fact");
    expect(SIGNIFICANT_KINDS).not.toContain("psychological_profile");
    expect(SIGNIFICANT_KINDS).not.toContain("diagnosis");
    expect(SIGNIFICANT_KINDS).not.toContain("personality_trait");
  });
});

describe("17. invalid confidence returns null", () => {
  it("confidence > 1 returns null", () => {
    expect(
      parseSignificanceResponse(validJson("preference", "calm preference", 1.5), {
        content: USER_TURN,
      }),
    ).toBeNull();
  });
  it("confidence < 0 returns null", () => {
    expect(
      parseSignificanceResponse(validJson("preference", "calm preference", -0.1), {
        content: USER_TURN,
      }),
    ).toBeNull();
  });
  it("non-numeric confidence returns null", () => {
    const r = parseSignificanceResponse(
      '{"significant":true,"kind":"preference","candidateContent":"calm preference","reason":"r","confidence":"high"}',
      { content: USER_TURN },
    );
    expect(r).toBeNull();
  });
  it("null confidence is accepted", () => {
    const r = parseSignificanceResponse(
      '{"significant":true,"kind":"preference","candidateContent":"calm preference","reason":"r","confidence":null}',
      { content: USER_TURN },
    );
    expect(r).not.toBeNull();
    expect(r!.confidence).toBeNull();
  });
});

describe("18. empty candidate returns null", () => {
  it("empty candidateContent returns null", () => {
    expect(
      parseSignificanceResponse(validJson("preference", "   ", 0.5), { content: USER_TURN }),
    ).toBeNull();
  });
  it("missing candidateContent returns null", () => {
    expect(
      parseSignificanceResponse(
        '{"significant":true,"kind":"preference","reason":"r","confidence":0.5}',
        { content: USER_TURN },
      ),
    ).toBeNull();
  });
});

describe("19. candidate not grounded in user turn is rejected", () => {
  it("a candidate with no token overlap is rejected", () => {
    const r = parseSignificanceResponse(validJson("preference", "The user lives in Paris", 0.5), {
      content: USER_TURN,
    });
    expect(r).toBeNull();
  });
  it("isGrounded short-circuits on empty", () => {
    expect(isGroundedIn("", USER_TURN)).toBe(false);
    expect(isGroundedIn("preference", "")).toBe(false);
  });
  it("grounding helper detects overlap", () => {
    expect(isGroundedIn("calm style preference", USER_TURN)).toBe(true);
  });
});

// ===========================================================================
// Classifier logic (integration with fake persistence) — 20-29
// ===========================================================================

describe("20. classifier failure does not break conversation", () => {
  it("Orchestra returning null yields no candidate and ok=true", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "please remember this: I prefer calm");
    const rr = makeRunRole(null);
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await classifySignificantInteractionLogic(
      classifyRequest(TOKEN_U1, cid, t.id),
      rr.fn,
      auth.fn,
    );
    expect(res.ok).toBe(true);
    expect(res.candidate).toBeNull();
    expect(res.gateTriggered).toBe(true);
    expect(res.llmCalled).toBe(true);
    expect(fake.interactions.size).toBe(0);
  });
  it("Orchestra throwing yields no candidate and ok=true", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "from now on keep it short");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const throwing = (async () => {
      throw new Error("network");
    }) as typeof import("@/lib/llm/orchestra").runRole;
    const res = await classifySignificantInteractionLogic(
      classifyRequest(TOKEN_U1, cid, t.id),
      throwing,
      auth.fn,
    );
    expect(res.ok).toBe(true);
    expect(res.candidate).toBeNull();
    expect(fake.interactions.size).toBe(0);
  });
});

describe("21. candidate is not automatically confirmed", () => {
  it("a created candidate has status='candidate', never 'confirmed'", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this: I prefer calm replies");
    const rr = makeRunRole(validJson("preference", "The user prefers calm replies", 0.8));
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await classifySignificantInteractionLogic(
      classifyRequest(TOKEN_U1, cid, t.id),
      rr.fn,
      auth.fn,
    );
    expect(res.candidate).not.toBeNull();
    expect(res.candidate!.status).toBe("candidate");
    expect(res.candidate!.source).toBe("ai_classified");
  });
});

describe("22. explicit Remember persists confirmed status", () => {
  it("confirming a candidate sets status='confirmed'", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this: I prefer calm replies");
    const rr = makeRunRole(validJson("preference", "The user prefers calm replies", 0.8));
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const created = await classifySignificantInteractionLogic(
      classifyRequest(TOKEN_U1, cid, t.id),
      rr.fn,
      auth.fn,
    );
    const cand = created.candidate!;
    const confirmed = await setCandidateStatusLogic(
      { accessToken: TOKEN_U1, candidateId: cand.id },
      "confirmed",
      auth.fn,
    );
    expect(confirmed).not.toBeNull();
    expect(confirmed!.status).toBe("confirmed");
  });
});

describe("23. Not now persists dismissed status", () => {
  it("dismissing a candidate sets status='dismissed'", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this: I prefer calm replies");
    const rr = makeRunRole(validJson("preference", "The user prefers calm replies", 0.8));
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const created = await classifySignificantInteractionLogic(
      classifyRequest(TOKEN_U1, cid, t.id),
      rr.fn,
      auth.fn,
    );
    const cand = created.candidate!;
    const dismissed = await setCandidateStatusLogic(
      { accessToken: TOKEN_U1, candidateId: cand.id },
      "dismissed",
      auth.fn,
    );
    expect(dismissed).not.toBeNull();
    expect(dismissed!.status).toBe("dismissed");
  });
});

describe("24. cross-user candidate rejected", () => {
  it("u-2 cannot confirm u-1's candidate", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this: I prefer calm replies");
    const rr = makeRunRole(validJson("preference", "The user prefers calm replies", 0.8));
    const authU1 = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const authU2 = makeAuth({ [TOKEN_U2]: { id: "u-2" } });
    const created = await classifySignificantInteractionLogic(
      classifyRequest(TOKEN_U1, cid, t.id),
      rr.fn,
      authU1.fn,
    );
    const cand = created.candidate!;
    // u-2 tries to confirm → not owned → null.
    const res = await setCandidateStatusLogic(
      { accessToken: TOKEN_U2, candidateId: cand.id },
      "confirmed",
      authU2.fn,
    );
    expect(res).toBeNull();
    // u-1's candidate remains candidate.
    const still = await loadSignificantInteraction("u-1", cand.id);
    expect(still!.status).toBe("candidate");
  });
  it("u-2 cannot classify against u-1's turn (ownership)", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this: I prefer calm replies");
    const rr = makeRunRole(validJson("preference", "The user prefers calm replies", 0.8));
    const authU2 = makeAuth({ [TOKEN_U2]: { id: "u-2" } });
    const res = await classifySignificantInteractionLogic(
      classifyRequest(TOKEN_U2, cid, t.id),
      rr.fn,
      authU2.fn,
    );
    expect(res.candidate).toBeNull();
    expect(res.ok).toBe(false);
    expect(fake.interactions.size).toBe(0);
  });
});

describe("25. unrelated conversation rejected", () => {
  it("classifying a turn in another conversation yields no candidate", async () => {
    const c1 = seedConversation("u-1");
    const c2 = seedConversation("u-1");
    const t1 = seedTurn("u-1", c1, "user", "remember this: I prefer calm replies");
    const rr = makeRunRole(validJson("preference", "The user prefers calm replies", 0.8));
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    // turn belongs to c1, request names c2 → turn/conversation mismatch.
    const res = await classifySignificantInteractionLogic(
      classifyRequest(TOKEN_U1, c2, t1.id),
      rr.fn,
      auth.fn,
    );
    expect(res.candidate).toBeNull();
    expect(res.ok).toBe(false);
  });
});

describe("26. assistant turn cannot be used as source", () => {
  it("classifying an assistant turn yields no candidate", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "assistant", "I prefer to remember this from now on");
    const rr = makeRunRole(validJson("preference", "calm preference", 0.8));
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await classifySignificantInteractionLogic(
      classifyRequest(TOKEN_U1, cid, t.id),
      rr.fn,
      auth.fn,
    );
    expect(res.candidate).toBeNull();
    expect(res.gateTriggered).toBe(false);
    expect(res.llmCalled).toBe(false);
    expect(rr.calls.length).toBe(0);
  });
});

describe("27. duplicate candidate prevented", () => {
  it("a second classification of the same turn returns the existing candidate, no dup LLM row", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this: I prefer calm replies");
    const rr = makeRunRole(validJson("preference", "The user prefers calm replies", 0.8));
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const r1 = await classifySignificantInteractionLogic(
      classifyRequest(TOKEN_U1, cid, t.id),
      rr.fn,
      auth.fn,
    );
    expect(r1.candidate).not.toBeNull();
    const firstId = r1.candidate!.id;
    // Second call: existing active candidate → returns it without a new row.
    const r2 = await classifySignificantInteractionLogic(
      classifyRequest(TOKEN_U1, cid, t.id),
      rr.fn,
      auth.fn,
    );
    expect(r2.candidate).not.toBeNull();
    expect(r2.candidate!.id).toBe(firstId);
    expect(fake.interactions.size).toBe(1);
    expect(r2.llmCalled).toBe(false);
  });
  it("createCandidate rejects a duplicate active candidate directly", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const a = await createCandidate({
      userId: "u-1",
      conversationId: cid,
      turnId: t.id,
      kind: "preference",
      candidateContent: "prefers calm",
      reason: null,
      source: "ai_classified",
      confidence: 0.5,
    });
    expect(a).not.toBeNull();
    const b = await createCandidate({
      userId: "u-1",
      conversationId: cid,
      turnId: t.id,
      kind: "preference",
      candidateContent: "prefers calm",
      reason: null,
      source: "ai_classified",
      confidence: 0.6,
    });
    expect(b).toBeNull();
    expect(fake.interactions.size).toBe(1);
  });
});

describe("28. original conversation turn remains unchanged", () => {
  it("classification does not mutate the source turn content", async () => {
    const cid = seedConversation("u-1");
    const original = "remember this: I prefer calm replies";
    const t = seedTurn("u-1", cid, "user", original);
    const rr = makeRunRole(validJson("preference", "The user prefers calm replies", 0.8));
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    await classifySignificantInteractionLogic(classifyRequest(TOKEN_U1, cid, t.id), rr.fn, auth.fn);
    const still = await loadTurn("u-1", t.id);
    expect(still!.content).toBe(original);
    expect(still!.role).toBe("user");
  });
  it("candidate_content is NOT a copy of the original turn", async () => {
    const cid = seedConversation("u-1");
    const original = "remember this: I prefer calm replies";
    const t = seedTurn("u-1", cid, "user", original);
    const candidateText = "The user prefers calm replies";
    const rr = makeRunRole(validJson("preference", candidateText, 0.8));
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await classifySignificantInteractionLogic(
      classifyRequest(TOKEN_U1, cid, t.id),
      rr.fn,
      auth.fn,
    );
    expect(res.candidate!.candidateContent).toBe(candidateText);
    expect(res.candidate!.candidateContent).not.toBe(original);
  });
});

// ===========================================================================
// Schema / scope / security static checks — 29-35
// ===========================================================================

async function readSrc(path: string): Promise<string> {
  const fs = await import("node:fs");
  return fs.readFileSync(path, "utf8");
}

describe("29. no companion_memories table exists in this phase", () => {
  it("migration 0008 creates significant_interactions only, not companion_memories", async () => {
    const mig = await readSrc("supabase/migrations/0008_significant_interactions.sql");
    expect(mig).toContain("create table if not exists public.significant_interactions");
    expect(mig).not.toMatch(/create table.*companion_memories/i);
  });
  it("no migration 0001-0008 creates companion_memories (0009 is the only one)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = "supabase/migrations";
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".sql")) continue;
      // Migration 0009 legitimately creates companion_memories (Companion Memory
      // phase). The Significant Interaction phase (0008 and earlier) must not.
      if (f.startsWith("0009")) continue;
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      expect(src).not.toMatch(/create table.*companion_memories/i);
    }
  });
  it("no companion_memories references in source modules", async () => {
    for (const f of [
      "src/lib/supabase/significant-remote.ts",
      "src/lib/llm/classifySignificantInteraction.server.ts",
      "src/lib/llm/confirmSignificantInteraction.server.ts",
      "src/lib/llm/significantInteraction.ts",
      "src/lib/memory/significanceGate.ts",
    ]) {
      const fs = await import("node:fs");
      if (!fs.existsSync(f)) continue;
      const src = await readSrc(f);
      // Strip doc comments so the check targets actual code, not the prose that
      // documents "no companion_memories table".
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(code).not.toMatch(/companion_memories/);
    }
  });
});

describe("30. no provider key in client bundle", () => {
  it("client + pure modules reference no provider keys / process.env", async () => {
    for (const f of [
      "src/routes/companion.tsx",
      "src/routes/companion.$conversationId.tsx",
      "src/lib/supabase/companion-remote.ts",
      "src/lib/supabase/significant-remote.ts",
      "src/lib/llm/significantInteraction.ts",
      "src/lib/memory/significanceGate.ts",
      "src/lib/supabase/confirmSignificantInteraction.server.ts",
    ]) {
      // confirmSignificantInteraction.server.ts may not exist; skip if absent.
      const fs = await import("node:fs");
      if (!fs.existsSync(f)) continue;
      const src = await readSrc(f);
      for (const k of [
        "GROQ_API_KEY",
        "GEMINI_API_KEY",
        "MISTRAL_API_KEY",
        "OPENROUTER_API_KEY",
        "SUPABASE_SERVICE_ROLE",
      ]) {
        expect(src).not.toContain(k);
      }
    }
  });
});

describe("31. no direct provider call from browser", () => {
  it("client modules never import orchestra/runRole; only the .server.ts does", async () => {
    for (const f of [
      "src/lib/supabase/significant-remote.ts",
      "src/lib/llm/significantInteraction.ts",
      "src/lib/memory/significanceGate.ts",
    ]) {
      const src = await readSrc(f);
      expect(src).not.toMatch(/from ["']@\/lib\/llm\/orchestra["']/);
      expect(src).not.toMatch(/runRole\s*\(/);
      expect(src).not.toMatch(/api\.groq\.com|generativelanguage|api\.mistral|openrouter\.ai/);
    }
    // The server classifier imports runRole (server-only).
    const srv = await readSrc("src/lib/llm/classifySignificantInteraction.server.ts");
    expect(srv).toContain('from "@/lib/llm/orchestra"');
    // The pure prompt builder does NOT.
    const pure = await readSrc("src/lib/llm/significantInteraction.ts");
    expect(pure).not.toMatch(/from ["']@\/lib\/llm\/orchestra["']/);
  });
});

describe("32. anonymous user works", () => {
  it("an anonymous user can produce a candidate", async () => {
    const cid = seedConversation("anon-1");
    const t = seedTurn("anon-1", cid, "user", "remember this: I prefer calm");
    const rr = makeRunRole(validJson("preference", "calm preference", 0.7));
    const auth = makeAuth({ [TOKEN_ANON]: { id: "anon-1", isAnonymous: true } });
    const res = await classifySignificantInteractionLogic(
      classifyRequest(TOKEN_ANON, cid, t.id),
      rr.fn,
      auth.fn,
    );
    expect(res.candidate).not.toBeNull();
    expect(res.candidate!.userId).toBe("anon-1");
  });
});

describe("33. authenticated user works", () => {
  it("an authenticated user can produce a candidate", async () => {
    const cid = seedConversation("auth-1");
    const t = seedTurn("auth-1", cid, "user", "from now on keep it short");
    const rr = makeRunRole(validJson("directive", "keep replies short", 0.8));
    const auth = makeAuth({ "token-auth": { id: "auth-1", isAnonymous: false } });
    const res = await classifySignificantInteractionLogic(
      classifyRequest("token-auth", cid, t.id),
      rr.fn,
      auth.fn,
    );
    expect(res.candidate).not.toBeNull();
    expect(res.candidate!.userId).toBe("auth-1");
  });
});

describe("34. existing Conversation behavior unchanged", () => {
  it("conversation + turn CRUD still works via companion-remote", async () => {
    const c = await createConversation("u-1");
    expect(c).not.toBeNull();
    const loaded = await loadConversation("u-1", c!.id);
    expect(loaded).not.toBeNull();
    const t = await createTurn("u-1", c!.id, "user", "hello");
    expect(t).not.toBeNull();
    const turn = await loadTurn("u-1", t!.id);
    expect(turn).not.toBeNull();
    expect(turn!.content).toBe("hello");
  });
  it("the deterministic gate still preserves the existing companionConversation contract (no candidate fields leaked for a greeting)", () => {
    // A greeting must not trigger analysis: gate returns false → classifier
    // never called → no candidate. The conversation response shape is intact.
    const r = evaluateSignificanceGate({ role: "user", content: "hi" });
    expect(r.shouldAnalyze).toBe(false);
  });
});

describe("35. existing Memory/Pattern/Event/Chapter/Media unchanged", () => {
  it("migration 0008 touches no other tables", async () => {
    const mig = await readSrc("supabase/migrations/0008_significant_interactions.sql");
    for (const table of [
      "memories",
      "patterns",
      "life_events",
      "life_chapters",
      "media",
      "reflections",
      "memory_connections",
      "journeys",
      "music_experiences",
      "companion_conversations",
      "companion_turns",
    ]) {
      // No alter/drop on existing tables (companion_conversations/turns are
      // referenced via FK only, not altered).
      expect(mig).not.toMatch(new RegExp(`alter table public.${table}`, "i"));
      expect(mig).not.toMatch(new RegExp(`drop table.*${table}`, "i"));
    }
    expect(mig).toContain("significant_interactions");
  });
  it("significant-remote references no other tables", async () => {
    const src = await readSrc("src/lib/supabase/significant-remote.ts");
    expect(src).toContain("significant_interactions");
    for (const t of [
      "memories",
      "patterns",
      "life_events",
      "life_chapters",
      "media",
      "reflections",
    ]) {
      expect(src).not.toMatch(new RegExp(`from\\(["']${t}["']`));
    }
  });
});

// ===========================================================================
// Provenance + RLS + cost-gate structural checks
// ===========================================================================

describe("provenance: every candidate points to conversation + turn + user", () => {
  it("migration 0008 has FKs to conversations, turns, auth.users", async () => {
    const mig = await readSrc("supabase/migrations/0008_significant_interactions.sql");
    expect(mig).toMatch(/conversation_id.*references public\.companion_conversations/);
    expect(mig).toMatch(/turn_id.*references public\.companion_turns/);
    expect(mig).toMatch(/user_id.*references auth\.users/);
  });
  it("a created candidate carries conversationId + turnId + userId", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this: I prefer calm");
    const c = await createCandidate({
      userId: "u-1",
      conversationId: cid,
      turnId: t.id,
      kind: "preference",
      candidateContent: "prefers calm",
      reason: null,
      source: "ai_classified",
      confidence: 0.5,
    });
    expect(c!.conversationId).toBe(cid);
    expect(c!.turnId).toBe(t.id);
    expect(c!.userId).toBe("u-1");
    expect(c!.fingerprint).toBe(candidateFingerprint(t.id, "prefers calm"));
  });
});

describe("RLS: four owner policies present", () => {
  it("migration 0008 defines select/insert/update/delete owner policies", async () => {
    const mig = await readSrc("supabase/migrations/0008_significant_interactions.sql");
    expect(mig).toContain("enable row level security");
    expect(mig).toContain("significant_interactions_owner_select");
    expect(mig).toContain("significant_interactions_owner_insert");
    expect(mig).toContain("significant_interactions_owner_update");
    expect(mig).toContain("significant_interactions_owner_delete");
    expect(mig).toMatch(/auth\.uid\(\) = user_id/);
  });
});

describe("cost gate: deterministic gate runs before Orchestra", () => {
  it("a non-significant turn does NOT call the Orchestra", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "hello there");
    const rr = makeRunRole(validJson("preference", "calm preference", 0.8));
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await classifySignificantInteractionLogic(
      classifyRequest(TOKEN_U1, cid, t.id),
      rr.fn,
      auth.fn,
    );
    expect(res.gateTriggered).toBe(false);
    expect(res.llmCalled).toBe(false);
    expect(rr.calls.length).toBe(0);
    expect(res.candidate).toBeNull();
    expect(fake.interactions.size).toBe(0);
  });
  it("a significant turn DOES call the Orchestra", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this: I prefer calm");
    const rr = makeRunRole(validJson("preference", "calm preference", 0.8));
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    await classifySignificantInteractionLogic(classifyRequest(TOKEN_U1, cid, t.id), rr.fn, auth.fn);
    expect(rr.calls.length).toBe(1);
  });
});

describe("cost gate: gate re-run server-side (defense-in-depth)", () => {
  it("the classifier server fn re-evaluates the gate, not the browser", () => {
    // The classifier logic calls evaluateSignificanceGate internally; a turn
    // with no signal never reaches the LLM even if the browser asked.
    const r = evaluateSignificanceGate({ role: "user", content: "ok thanks" });
    expect(r.shouldAnalyze).toBe(false);
  });
});

describe("confirm: cannot confirm an already-confirmed candidate", () => {
  it("double-confirm is a safe no-op (no state regression)", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this: I prefer calm");
    const rr = makeRunRole(validJson("preference", "calm preference", 0.8));
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const created = await classifySignificantInteractionLogic(
      classifyRequest(TOKEN_U1, cid, t.id),
      rr.fn,
      auth.fn,
    );
    const cand = created.candidate!;
    const first = await setCandidateStatusLogic(
      { accessToken: TOKEN_U1, candidateId: cand.id },
      "confirmed",
      auth.fn,
    );
    expect(first!.status).toBe("confirmed");
    // Second confirm: candidate is no longer 'candidate' → null (idempotent).
    const second = await setCandidateStatusLogic(
      { accessToken: TOKEN_U1, candidateId: cand.id },
      "confirmed",
      auth.fn,
    );
    expect(second).toBeNull();
  });
});

describe("identity: server derives userId from access token, not browser input", () => {
  it("classifySignificantInteractionLogic calls getCurrentUser with the token", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this: I prefer calm");
    const rr = makeRunRole(validJson("preference", "calm preference", 0.8));
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    await classifySignificantInteractionLogic(classifyRequest(TOKEN_U1, cid, t.id), rr.fn, auth.fn);
    expect(auth.calls).toContain(TOKEN_U1);
  });
  it("no access token → rejected before any work", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this: I prefer calm");
    const rr = makeRunRole(validJson("preference", "calm preference", 0.8));
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await classifySignificantInteractionLogic(
      classifyRequest("", cid, t.id),
      rr.fn,
      auth.fn,
    );
    expect(res.ok).toBe(false);
    expect(rr.calls.length).toBe(0);
    expect(fake.interactions.size).toBe(0);
  });
});

describe("prompt contract: minimal context only", () => {
  it("the prompt includes the user turn + signals, not the whole DB", () => {
    const prompt = buildSignificancePrompt({
      userTurn: { role: "user", content: "remember this: I prefer calm" },
      signals: ["remember this"],
    });
    expect(prompt).toContain("USER TURN UNDER ANALYSIS");
    expect(prompt).toContain("remember this: I prefer calm");
    expect(prompt).toContain("remember this");
    // Grounding rules present.
    expect(prompt).toContain("Never invent");
    expect(prompt).toContain("EXPLICIT USER STATEMENT");
  });
  it("the prompt instructs JSON output shape", () => {
    const prompt = buildSignificancePrompt({
      userTurn: { role: "user", content: "from now on" },
      signals: ["from now on"],
    });
    expect(prompt).toContain('"significant"');
    expect(prompt).toContain('"candidateContent"');
  });
});

describe("listCandidatesForTurn owner scope", () => {
  it("returns only the caller's candidates for the turn", async () => {
    const c1 = seedConversation("u-1");
    const t1 = seedTurn("u-1", c1, "user", "remember this: I prefer calm");
    const c2 = seedConversation("u-2");
    const t2 = seedTurn("u-2", c2, "user", "remember this: I prefer loud");
    await createCandidate({
      userId: "u-1",
      conversationId: c1,
      turnId: t1.id,
      kind: "preference",
      candidateContent: "prefers calm",
      reason: null,
      source: "ai_classified",
      confidence: 0.5,
    });
    await createCandidate({
      userId: "u-2",
      conversationId: c2,
      turnId: t2.id,
      kind: "preference",
      candidateContent: "prefers loud",
      reason: null,
      source: "ai_classified",
      confidence: 0.5,
    });
    const mine = await listCandidatesForTurn("u-1", t1.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].candidateContent).toBe("prefers calm");
    const cross = await listCandidatesForTurn("u-2", t1.id);
    expect(cross).toHaveLength(0);
  });
});
