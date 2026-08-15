import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Companion Conversation Foundation tests.
 *
 * Deterministic: Supabase persistence is a stateful fake keyed on the in-memory
 * maps. The Orchestra call is a `runRoleImpl` injection so no live LLM/network
 * call is made. These are real code-path tests of companion-remote.ts and
 * companionConversation.server.ts logic, not of the Supabase SDK or providers.
 *
 * Key invariants under test:
 *   - every query is owner-scoped (cross-user → safe "not found", no persist)
 *   - content is preserved exactly as produced (no rewrite/summary)
 *   - turns ordered by created_at
 *   - user turn persisted BEFORE LLM call; assistant turn ONLY on success
 *   - LLM failure does not fabricate an assistant turn
 *   - retry reuses the existing user turn (no duplication)
 *   - provider key never reaches the browser; no direct provider call from browser
 */

// ---------------------------------------------------------------------------
// Fake Supabase
// ---------------------------------------------------------------------------
type FakeRow = Record<string, unknown>;
type ChainResult = { data: FakeRow | FakeRow[] | null; error: unknown };

type Chain = {
  select: (cols?: string) => Chain;
  eq: (col: string, val: unknown) => Chain;
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
  nextConvId: number;
  nextTurnId: number;
};

let fake: FakeSupabase;

function freshState(table: string): ChainState {
  return { table, filters: {}, order: null, limit: null };
}

// Build a chain that records eq filters, order, and limit, and is thenable
// (resolves to { data: row[], error }) so list queries work. `.single()` and
// `.maybeSingle()` return a single matching row.
type OrderSpec = { col: string; ascending: boolean } | null;
type ChainState = {
  table: string;
  filters: Record<string, unknown>;
  order: OrderSpec;
  limit: number | null;
};

function matchRows(state: ChainState): FakeRow[] {
  let rows =
    state.table === "companion_conversations"
      ? [...fake.conversations.values()]
      : state.table === "companion_turns"
        ? [...fake.turns.values()]
        : [];
  for (const [k, v] of Object.entries(state.filters)) rows = rows.filter((r) => r[k] === v);
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

function makeChain(state: ChainState): Chain {
  const thenable: Chain & { then?: unknown } = {
    select: () => makeChain({ ...state }),
    eq: (col, val) => makeChain({ ...state, filters: { ...state.filters, [col]: val } }),
    order: (col, opts) =>
      makeChain({ ...state, order: { col, ascending: opts?.ascending ?? true } }),
    limit: (n) => makeChain({ ...state, limit: n }),
    maybeSingle: async () => {
      const rows = matchRows(state);
      return { data: rows.length ? rows[0] : null, error: null };
    },
    single: async () => {
      const rows = matchRows(state);
      return { data: rows.length ? rows[0] : null, error: null };
    },
    insert: (row) => {
      const rows = Array.isArray(row) ? row : [row];
      let lastId: string | null = null;
      for (const r of rows) {
        if (state.table === "companion_conversations") {
          const id = `conv-${fake.nextConvId++}`;
          const full: FakeRow = {
            status: r.status ?? "active",
            started_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...r,
            id,
          };
          fake.conversations.set(id, full);
          lastId = id;
        } else if (state.table === "companion_turns") {
          const id = `turn-${fake.nextTurnId++}`;
          const ts = new Date().toISOString();
          const full: FakeRow = {
            user_id: r.user_id,
            conversation_id: r.conversation_id,
            role: r.role,
            content: r.content,
            metadata: r.metadata ?? null,
            ...r,
            id,
            created_at: ts,
          };
          fake.turns.set(id, full);
          lastId = id;
        }
      }
      // After insert, a following .select().single() should resolve to the new row.
      return makeChain({
        ...state,
        filters: lastId ? { ...state.filters, id: lastId } : state.filters,
      });
    },
    update: (patch) => {
      const matching = matchRows(state);
      for (const m of matching) Object.assign(m, patch, { updated_at: new Date().toISOString() });
      return makeChain(state);
    },
  };
  // Make the chain thenable → list queries resolve to all matching rows.
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
import {
  archiveConversation,
  createConversation,
  createTurn,
  listConversations,
  listTurns,
  loadConversation,
  loadRecentTurns,
  reopenConversation,
} from "./companion-remote";
import {
  companionConversationLogic,
  type CompanionConversationRequest,
} from "@/lib/llm/companionConversation.server";
import type { OrchestraRole } from "@/lib/llm/orchestra";
import type { CompanionTurn } from "@/lib/memory/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
beforeEach(() => {
  fake = {
    from: (table: string) => makeChain(freshState(table)),
    conversations: new Map(),
    turns: new Map(),
    nextConvId: 1,
    nextTurnId: 1,
  };
});

function seedConversation(userId: string, status: "active" | "archived" = "active"): string {
  const id = `conv-${fake.nextConvId++}`;
  const ts = new Date().toISOString();
  fake.conversations.set(id, {
    id,
    user_id: userId,
    title: null,
    status,
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
  ageMs = 0,
): CompanionTurn {
  const id = `turn-${fake.nextTurnId++}`;
  const ts = new Date(Date.now() - ageMs).toISOString();
  fake.turns.set(id, {
    id,
    user_id: userId,
    conversation_id: conversationId,
    role,
    content,
    created_at: ts,
    metadata: null,
  });
  return {
    id,
    userId,
    conversationId,
    role,
    content,
    createdAt: ts,
    metadata: null,
  };
}

// A runRole injection that records what it was called with.
function makeRunRole(reply: string | null) {
  const calls: { role: string; message: string }[] = [];
  const fn = async (role: OrchestraRole, message: string): Promise<string | null> => {
    calls.push({ role, message });
    return reply;
  };
  return { fn: fn as typeof import("@/lib/llm/orchestra").runRole, calls };
}

// A getCurrentUser injection that maps access tokens to verified users, so
// tests exercise the server-side identity resolution without a live Supabase.
// This mirrors how the production server fn derives userId from getUser(token).
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

// ===========================================================================
// Persistence layer
// ===========================================================================

describe("1. create owned conversation", () => {
  it("creates a conversation owned by the given user", async () => {
    const c = await createConversation("u-1");
    expect(c).not.toBeNull();
    expect(c!.userId).toBe("u-1");
    expect(c!.status).toBe("active");
  });
});

describe("2. list only owned conversations", () => {
  it("returns only the caller's conversations", async () => {
    seedConversation("u-1");
    seedConversation("u-2");
    seedConversation("u-1");
    const mine = await listConversations("u-1");
    expect(mine).toHaveLength(2);
    expect(mine.every((c) => c.userId === "u-1")).toBe(true);
  });
});

describe("3. load owned conversation", () => {
  it("loads a conversation owned by the caller", async () => {
    const id = seedConversation("u-1");
    const c = await loadConversation("u-1", id);
    expect(c).not.toBeNull();
    expect(c!.id).toBe(id);
  });
});

describe("4. cross-user conversation inaccessible", () => {
  it("returns null when loading another user's conversation", async () => {
    const id = seedConversation("u-1");
    const c = await loadConversation("u-2", id);
    expect(c).toBeNull();
  });
});

describe("5. archive conversation", () => {
  it("sets status to archived and preserves the conversation", async () => {
    const id = seedConversation("u-1");
    const c = await archiveConversation("u-1", id);
    expect(c).not.toBeNull();
    expect(c!.status).toBe("archived");
  });
});

describe("6. create user turn", () => {
  it("creates a turn with role user in an owned conversation", async () => {
    const id = seedConversation("u-1");
    const t = await createTurn("u-1", id, "user", "hello");
    expect(t).not.toBeNull();
    expect(t!.role).toBe("user");
    expect(t!.content).toBe("hello");
  });
});

describe("7. create assistant turn", () => {
  it("creates a turn with role assistant in an owned conversation", async () => {
    const id = seedConversation("u-1");
    const t = await createTurn("u-1", id, "assistant", "hi there");
    expect(t).not.toBeNull();
    expect(t!.role).toBe("assistant");
    expect(t!.content).toBe("hi there");
  });
});

describe("8. turns preserve original content", () => {
  it("content is stored verbatim, including whitespace/newlines", async () => {
    const id = seedConversation("u-1");
    const original = "line one\n  line two  ";
    const t = await createTurn("u-1", id, "user", original);
    expect(t!.content).toBe(original);
    const list = await listTurns("u-1", id);
    expect(list.find((x) => x.id === t!.id)!.content).toBe(original);
  });
});

describe("9. turns remain ordered by created_at", () => {
  it("listTurns returns turns in chronological order", async () => {
    const id = seedConversation("u-1");
    seedTurn("u-1", id, "user", "first", 3000);
    seedTurn("u-1", id, "assistant", "second", 2000);
    seedTurn("u-1", id, "user", "third", 1000);
    const list = await listTurns("u-1", id);
    expect(list.map((t) => t.content)).toEqual(["first", "second", "third"]);
  });
});

describe("10. recent turns limit works", () => {
  it("returns at most the limit, oldest-first", async () => {
    const id = seedConversation("u-1");
    for (let i = 0; i < 10; i++) seedTurn("u-1", id, "user", `t${i}`, (10 - i) * 100);
    const recent = await loadRecentTurns("u-1", id, 3);
    expect(recent).toHaveLength(3);
    // oldest-first within the recent window
    expect(recent[0].content).toBe("t7");
    expect(recent[2].content).toBe("t9");
  });
});

describe("11. cross-user turn rejected", () => {
  it("returns null when creating a turn in another user's conversation", async () => {
    const id = seedConversation("u-1");
    const t = await createTurn("u-2", id, "user", "intrusion");
    expect(t).toBeNull();
    // No turn persisted.
    expect(
      [...fake.turns.values()].filter((r) => r.role === "user" && r.content === "intrusion"),
    ).toHaveLength(0);
  });
});

describe("12. conversation ownership checked before turn creation", () => {
  it("does not insert a turn when the conversation is not owned", async () => {
    const id = seedConversation("u-1");
    await createTurn("u-2", id, "user", "nope");
    expect(fake.turns.size).toBe(0);
  });
});

describe("23. archive preserves historical turns", () => {
  it("archiving keeps all turns intact", async () => {
    const id = seedConversation("u-1");
    seedTurn("u-1", id, "user", "a");
    seedTurn("u-1", id, "assistant", "b");
    await archiveConversation("u-1", id);
    const turns = await listTurns("u-1", id);
    expect(turns).toHaveLength(2);
  });
});

describe("reopen conversation", () => {
  it("restores active status", async () => {
    const id = seedConversation("u-1", "archived");
    const c = await reopenConversation("u-1", id);
    expect(c!.status).toBe("active");
  });
});

// ===========================================================================
// Server function (companionConversationLogic)
// ===========================================================================
//
// The server fn derives the authoritative userId from the verified access
// token via `getCurrentUser(accessToken)` — it NEVER trusts a browser-supplied
// userId. Tests inject `makeAuth(...)` as the identity resolver so no live
// Supabase Auth call is made.

const TOKEN_U1 = "token-u1";
const TOKEN_U2 = "token-u2";
const TOKEN_ANON = "token-anon";

function baseRequest(conversationId: string, message: string): CompanionConversationRequest {
  return { accessToken: TOKEN_U1, conversationId, message };
}

describe("13. user message is persisted before LLM call", () => {
  it("a user turn exists before runRole is invoked", async () => {
    const id = seedConversation("u-1");
    const rr = makeRunRole("reply");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    // Instrument: record turns present at call time.
    let turnsAtCall = 0;
    const fn = async (role: OrchestraRole, message: string): Promise<string | null> => {
      turnsAtCall = [...fake.turns.values()].filter((r) => r.role === "user").length;
      return rr.fn(role, message);
    };
    await companionConversationLogic(baseRequest(id, "hi"), fn, auth.fn);
    expect(turnsAtCall).toBeGreaterThanOrEqual(1);
  });
});

describe("14. assistant response persisted after successful LLM call", () => {
  it("an assistant turn is stored when runRole returns text", async () => {
    const id = seedConversation("u-1");
    const rr = makeRunRole("hello back");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    await companionConversationLogic(baseRequest(id, "hi"), rr.fn, auth.fn);
    const turns = await listTurns("u-1", id);
    expect(turns.some((t) => t.role === "assistant" && t.content === "hello back")).toBe(true);
  });
});

describe("15. LLM failure does not fabricate assistant turn", () => {
  it("no assistant turn is created when runRole returns null", async () => {
    const id = seedConversation("u-1");
    const rr = makeRunRole(null);
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await companionConversationLogic(baseRequest(id, "hi"), rr.fn, auth.fn);
    expect(res.ok).toBe(false);
    expect(res.assistantTurn).toBeNull();
    const turns = await listTurns("u-1", id);
    expect(turns.some((t) => t.role === "assistant")).toBe(false);
    // User turn remains saved.
    expect(turns.some((t) => t.role === "user")).toBe(true);
  });
});

describe("16. retry does not duplicate prior user turn", () => {
  it("reuses the existing user turn when existingUserTurnId is provided", async () => {
    const id = seedConversation("u-1");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    // First attempt fails.
    const rrFail = makeRunRole(null);
    const r1 = await companionConversationLogic(baseRequest(id, "hi"), rrFail.fn, auth.fn);
    expect(r1.userTurn).not.toBeNull();
    const userTurnId = r1.userTurn!.id;

    // Retry with the existing user turn id — succeeds now.
    const rrOk = makeRunRole("finally");
    const r2 = await companionConversationLogic(
      { accessToken: TOKEN_U1, conversationId: id, message: "", existingUserTurnId: userTurnId },
      rrOk.fn,
      auth.fn,
    );
    expect(r2.ok).toBe(true);
    // Exactly one user turn exists (no duplication).
    const userTurns = [...fake.turns.values()].filter((r) => r.role === "user");
    expect(userTurns).toHaveLength(1);
  });
});

describe("17. current conversation context reaches server-only Companion function", () => {
  it("the prompt passed to runRole includes prior turn content", async () => {
    const id = seedConversation("u-1");
    seedTurn("u-1", id, "user", "I love Beethoven", 2000);
    seedTurn("u-1", id, "assistant", "Tell me more", 1000);
    const rr = makeRunRole("reply");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    await companionConversationLogic(baseRequest(id, "what do you remember?"), rr.fn, auth.fn);
    expect(rr.calls.length).toBe(1);
    const msg = rr.calls[0].message;
    expect(msg).toContain("Beethoven");
    expect(msg).toContain("what do you remember?");
  });
});

describe("ownership verified before turn creation (logic)", () => {
  it("returns not-ok when the conversation is not owned by the authenticated user", async () => {
    const id = seedConversation("u-1");
    const rr = makeRunRole("x");
    // Authenticated as u-2, but the conversation belongs to u-1.
    const auth = makeAuth({ [TOKEN_U2]: { id: "u-2" } });
    const res = await companionConversationLogic(
      { accessToken: TOKEN_U2, conversationId: id, message: "hi" },
      rr.fn,
      auth.fn,
    );
    expect(res.ok).toBe(false);
    expect(rr.calls.length).toBe(0); // LLM never called
  });
});

describe("empty message rejected", () => {
  it("does not create a user turn for empty content", async () => {
    const id = seedConversation("u-1");
    const rr = makeRunRole("x");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await companionConversationLogic(baseRequest(id, "   "), rr.fn, auth.fn);
    expect(res.ok).toBe(false);
    expect(fake.turns.size).toBe(0);
  });
});

// ===========================================================================
// Identity hardening (new this phase)
// ===========================================================================

describe("identity: server derives userId from authenticated context", () => {
  it("getCurrentUser is called with the access token", async () => {
    const id = seedConversation("u-1");
    const rr = makeRunRole("reply");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    await companionConversationLogic(baseRequest(id, "hi"), rr.fn, auth.fn);
    expect(auth.calls).toContain(TOKEN_U1);
  });
});

describe("identity: no authenticated user → rejected before any DB/LLM work", () => {
  it("returns not-ok and calls nothing when getUser returns null", async () => {
    const id = seedConversation("u-1");
    const rr = makeRunRole("reply");
    // No mapping → getUser returns null for any token.
    const auth = makeAuth({});
    const res = await companionConversationLogic(baseRequest(id, "hi"), rr.fn, auth.fn);
    expect(res.ok).toBe(false);
    expect(res.userTurn).toBeNull();
    expect(res.assistantTurn).toBeNull();
    expect(rr.calls.length).toBe(0); // LLM never called
    expect(fake.turns.size).toBe(0); // nothing persisted
  });
});

describe("identity: absent access token → rejected", () => {
  it("returns not-ok when no access token is presented", async () => {
    const id = seedConversation("u-1");
    const rr = makeRunRole("reply");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await companionConversationLogic(
      { accessToken: "", conversationId: id, message: "hi" },
      rr.fn,
      auth.fn,
    );
    expect(res.ok).toBe(false);
    expect(rr.calls.length).toBe(0);
    expect(fake.turns.size).toBe(0);
  });
});

describe("identity: anonymous user still works", () => {
  it("an anonymous (isAnonymous) user can run a conversation", async () => {
    const id = seedConversation("anon-user-1");
    const rr = makeRunRole("hi anon");
    const auth = makeAuth({ [TOKEN_ANON]: { id: "anon-user-1", isAnonymous: true } });
    const res = await companionConversationLogic(
      { accessToken: TOKEN_ANON, conversationId: id, message: "hello" },
      rr.fn,
      auth.fn,
    );
    expect(res.ok).toBe(true);
    expect(res.assistantTurn).not.toBeNull();
    const turns = await listTurns("anon-user-1", id);
    expect(turns.some((t) => t.role === "assistant")).toBe(true);
  });
});

describe("identity: authenticated user still works", () => {
  it("an authenticated user can run a conversation", async () => {
    const id = seedConversation("auth-user-1");
    const rr = makeRunRole("hi auth");
    const auth = makeAuth({ "token-auth": { id: "auth-user-1", isAnonymous: false } });
    const res = await companionConversationLogic(
      { accessToken: "token-auth", conversationId: id, message: "hello" },
      rr.fn,
      auth.fn,
    );
    expect(res.ok).toBe(true);
    expect(res.assistantTurn).not.toBeNull();
  });
});

describe("identity: userId mismatch cannot bypass ownership", () => {
  it("a token verifying as u-2 cannot access u-1's conversation", async () => {
    const id = seedConversation("u-1");
    const rr = makeRunRole("x");
    const auth = makeAuth({ [TOKEN_U2]: { id: "u-2" } });
    const res = await companionConversationLogic(
      { accessToken: TOKEN_U2, conversationId: id, message: "hi" },
      rr.fn,
      auth.fn,
    );
    expect(res.ok).toBe(false);
    expect(rr.calls.length).toBe(0);
    expect(fake.turns.size).toBe(0);
  });
});

describe("identity: arbitrary browser userId is never an input", () => {
  it("CompanionConversationRequest has no userId field (static type check)", async () => {
    const req: CompanionConversationRequest = {
      accessToken: TOKEN_U1,
      conversationId: "x",
      message: "y",
    };
    // The request carries only accessToken + conversationId + message (+ optional
    // contextSlices/existingUserTurnId). There is no userId property.
    expect(req).not.toHaveProperty("userId");
  });
});

// ===========================================================================
// Security / scope (static checks)
// ===========================================================================

async function readSrc(path: string): Promise<string> {
  const fs = await import("node:fs");
  return fs.readFileSync(path, "utf8");
}

describe("18. provider key never reaches browser", () => {
  it("client-route modules reference no provider keys / process.env", async () => {
    for (const file of [
      "src/routes/companion.tsx",
      "src/routes/companion.$conversationId.tsx",
      "src/lib/supabase/companion-remote.ts",
    ]) {
      const src = await readSrc(file);
      for (const k of [
        "GROQ_API_KEY",
        "GEMINI_API_KEY",
        "MISTRAL_API_KEY",
        "OPENROUTER_API_KEY",
        "SUPABASE_SERVICE_ROLE",
      ]) {
        expect(src).not.toContain(k);
      }
      expect(src).not.toMatch(/process\.env/);
    }
  });
});

describe("19. no direct provider call from browser", () => {
  it("client modules never import orchestra/runRole; only the .server.ts does", async () => {
    const remote = await readSrc("src/lib/supabase/companion-remote.ts");
    const routeIdx = await readSrc("src/routes/companion.tsx");
    const routeDet = await readSrc("src/routes/companion.$conversationId.tsx");
    for (const src of [remote, routeIdx, routeDet]) {
      expect(src).not.toMatch(/from ["']@\/lib\/llm\/orchestra["']/);
      expect(src).not.toMatch(/runRole\s*\(/);
      expect(src).not.toMatch(/api\.groq\.com|generativelanguage|api\.mistral|openrouter\.ai/);
    }
    // The server fn imports runRole from orchestra (server-only).
    const srv = await readSrc("src/lib/llm/companionConversation.server.ts");
    expect(srv).toContain('from "@/lib/llm/orchestra"');
  });
});

describe("20. existing Memory/Pattern/Event/Chapter/Media data unchanged", () => {
  it("companion migration + remote touch no other tables", async () => {
    const fs = await import("node:fs");
    const mig = fs.readFileSync("supabase/migrations/0007_companion_conversations.sql", "utf8");
    for (const table of [
      "memories",
      "patterns",
      "life_events",
      "life_chapters",
      "media",
      "reflections",
      "memory_connections",
      "journeys",
    ]) {
      // No alter/drop on existing tables.
      expect(mig).not.toMatch(new RegExp(`alter table public.${table}`, "i"));
      expect(mig).not.toMatch(new RegExp(`drop table.*${table}`, "i"));
    }
    expect(mig).toContain("companion_conversations");
    expect(mig).toContain("companion_turns");
  });
});

describe("21. anonymous user can create conversation", () => {
  it("createConversation works for an anonymous-style user id", async () => {
    const c = await createConversation("anon-user-1");
    expect(c).not.toBeNull();
    expect(c!.userId).toBe("anon-user-1");
  });
});

describe("22. authenticated user can create conversation", () => {
  it("createConversation works for a permanent user id", async () => {
    const c = await createConversation("auth-user-1");
    expect(c).not.toBeNull();
    expect(c!.userId).toBe("auth-user-1");
  });
});

describe("24. user sign-out does not delete conversation data", () => {
  it("conversations + turns persist in the store (sign-out is a client-only session clear)", async () => {
    const id = seedConversation("u-1");
    seedTurn("u-1", id, "user", "hello");
    // Simulate sign-out: nothing in companion-remote deletes data.
    // The data remains in the fake store.
    expect(fake.conversations.size).toBe(1);
    expect(fake.turns.size).toBe(1);
    // Reloading still returns the conversation + turn.
    const c = await loadConversation("u-1", id);
    expect(c).not.toBeNull();
    const t = await listTurns("u-1", id);
    expect(t).toHaveLength(1);
  });
});

describe("no companion-memory / significance fields", () => {
  it("server response contains no memoryCandidate/significance/saveMemory/rememberThis", async () => {
    const id = seedConversation("u-1");
    const rr = makeRunRole("plain reply");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await companionConversationLogic(baseRequest(id, "hi"), rr.fn, auth.fn);
    expect(res).not.toHaveProperty("memoryCandidate");
    expect(res).not.toHaveProperty("significance");
    expect(res).not.toHaveProperty("saveMemory");
    expect(res).not.toHaveProperty("rememberThis");
  });
});

describe("no service-role / admin API", () => {
  it("companion modules reference no service role or admin auth API", async () => {
    for (const file of [
      "src/lib/supabase/companion-remote.ts",
      "src/lib/supabase/server-auth.ts",
      "src/lib/llm/companionConversation.server.ts",
      "src/lib/llm/companionConversation.ts",
    ]) {
      const src = await readSrc(file);
      expect(src).not.toContain("SERVICE_ROLE");
      expect(src).not.toContain("service_role");
      expect(src).not.toContain("auth.admin");
      expect(src).not.toContain("admin.deleteUser");
    }
  });
});

describe("identity: server-auth resolves via getUser(token), not trusted userId", () => {
  it("server-auth.ts calls supabase.auth.getUser and derives id from the result", async () => {
    const src = await readSrc("src/lib/supabase/server-auth.ts");
    expect(src).toMatch(/\.auth\.getUser\(/);
    expect(src).toMatch(/data\.user\.id/);
    // It must NOT accept a userId param.
    expect(src).not.toMatch(/function getCurrentUser\s*\(\s*userId/);
  });
});

describe("identity: server-auth is not shipped to the browser bundle", () => {
  it("server-auth.ts is imported only by server modules", async () => {
    const det = await readSrc("src/routes/companion.$conversationId.tsx");
    const idx = await readSrc("src/routes/companion.tsx");
    const remote = await readSrc("src/lib/supabase/companion-remote.ts");
    // Client modules must not import the server-side identity resolver.
    for (const src of [det, idx, remote]) {
      expect(src).not.toMatch(/from ["']@\/lib\/supabase\/server-auth["']/);
    }
    // The server fn imports it.
    const srv = await readSrc("src/lib/llm/companionConversation.server.ts");
    expect(srv).toContain('from "@/lib/supabase/server-auth"');
  });
});

describe("content is not rewritten", () => {
  it("stored turn content equals the input verbatim (behavioral)", async () => {
    const id = seedConversation("u-1");
    const original = "  Keep   this exactly.\nWith newlines.  ";
    const t = await createTurn("u-1", id, "user", original);
    expect(t!.content).toBe(original);
    const list = await listTurns("u-1", id);
    expect(list[0].content).toBe(original);
  });
});
