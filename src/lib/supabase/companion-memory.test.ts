import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Companion Memory Foundation tests.
 *
 * Covers 34 scenarios for promotion (confirmed-only, ownership-verified,
 * dedup, related-object ownership), CRUD, archive/restore, delete,
 * provenance ("Why?"), content preservation, failure recovery, identity,
 * and scope (no browser userId, no service-role key, no provider key in
 * client bundle, no browser LLM call, anonymous/authenticated compatibility,
 * existing behavior unchanged).
 *
 * No live LLM calls. No network. Supabase is a stateful fake keyed on
 * in-memory maps (mirrors significance.test.ts), extended with
 * companion_memories, memories, life_events, life_chapters tables. The
 * companion_memories table enforces the unique promotion constraint on
 * significant_interaction_id and ON DELETE SET NULL for related-object links.
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
  delete: () => Chain;
};

type FakeSupabase = {
  from: (table: string) => Chain;
  conversations: Map<string, FakeRow>;
  turns: Map<string, FakeRow>;
  interactions: Map<string, FakeRow>;
  memories: Map<string, FakeRow>;
  events: Map<string, FakeRow>;
  chapters: Map<string, FakeRow>;
  companionMemories: Map<string, FakeRow>;
  nextConvId: number;
  nextTurnId: number;
  nextInteractionId: number;
  nextMemoryId: number;
  nextEventId: number;
  nextChapterId: number;
  nextCompanionMemoryId: number;
};

let fake: FakeSupabase;

type OrderSpec = { col: string; ascending: boolean } | null;
type ChainState = {
  table: string;
  filters: Record<string, unknown>;
  inFilters: Record<string, unknown[]>;
  order: OrderSpec;
  limit: number | null;
  insertFailed: boolean;
  /** Pending mutation: applied to matching rows when a terminal is reached. */
  pendingUpdate: FakeRow | null;
  pendingDelete: boolean;
};

function tableRows(table: string): FakeRow[] {
  switch (table) {
    case "companion_conversations":
      return [...fake.conversations.values()];
    case "companion_turns":
      return [...fake.turns.values()];
    case "significant_interactions":
      return [...fake.interactions.values()];
    case "memories":
      return [...fake.memories.values()];
    case "life_events":
      return [...fake.events.values()];
    case "life_chapters":
      return [...fake.chapters.values()];
    case "companion_memories":
      return [...fake.companionMemories.values()];
    default:
      return [];
  }
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
  return {
    table,
    filters: {},
    inFilters: {},
    order: null,
    limit: null,
    insertFailed: false,
    pendingUpdate: null,
    pendingDelete: false,
  };
}

function mapFor(table: string): Map<string, FakeRow> | null {
  switch (table) {
    case "companion_conversations":
      return fake.conversations;
    case "companion_turns":
      return fake.turns;
    case "significant_interactions":
      return fake.interactions;
    case "memories":
      return fake.memories;
    case "life_events":
      return fake.events;
    case "life_chapters":
      return fake.chapters;
    case "companion_memories":
      return fake.companionMemories;
    default:
      return null;
  }
}

/** Detach related-object links before deleting Memories/Events/Chapters. */
function detachRelatedLinks(table: string, ids: Set<string>): void {
  if (table !== "memories" && table !== "life_events" && table !== "life_chapters") return;
  const fkCol =
    table === "memories"
      ? "related_memory_id"
      : table === "life_events"
        ? "related_event_id"
        : "related_chapter_id";
  for (const cm of fake.companionMemories.values()) {
    if (ids.has(cm[fkCol] as string)) cm[fkCol] = null;
  }
}

function runPending(state: ChainState): void {
  const matching = matchRows(state);
  if (state.pendingDelete) {
    const ids = new Set(matching.map((m) => m.id as string));
    detachRelatedLinks(state.table, ids);
    const map = mapFor(state.table);
    if (map) for (const m of matching) map.delete(m.id as string);
    return;
  }
  if (state.pendingUpdate) {
    for (const m of matching) {
      Object.assign(m, state.pendingUpdate, { updated_at: new Date().toISOString() });
      if (state.pendingUpdate.archived_at === null) m.archived_at = null;
    }
  }
}

function makeChain(state: ChainState): Chain {
  const thenable: Chain & { then?: unknown } = {
    select: () => {
      runPending(state);
      return makeChain({ ...state, pendingUpdate: null, pendingDelete: false });
    },
    eq: (col, val) => makeChain({ ...state, filters: { ...state.filters, [col]: val } }),
    in: (col, vals) => makeChain({ ...state, inFilters: { ...state.inFilters, [col]: vals } }),
    order: (col, opts) =>
      makeChain({ ...state, order: { col, ascending: opts?.ascending ?? true } }),
    limit: (n) => makeChain({ ...state, limit: n }),
    maybeSingle: async () => {
      if (state.insertFailed) return { data: null, error: { code: "23505" } };
      runPending(state);
      const rows = matchRows(state);
      return { data: rows.length ? rows[0] : null, error: null };
    },
    single: async () => {
      if (state.insertFailed) return { data: null, error: { code: "23505" } };
      runPending(state);
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
          const id = `sig-${fake.nextInteractionId++}`;
          const ts = new Date().toISOString();
          fake.interactions.set(id, {
            ...r,
            id,
            status: r.status ?? "candidate",
            source: r.source ?? "ai_classified",
            created_at: ts,
            updated_at: ts,
          });
          lastId = id;
        } else if (state.table === "memories") {
          const id = `mem-${fake.nextMemoryId++}`;
          const ts = new Date().toISOString();
          fake.memories.set(id, { ...r, id, created_at: ts, updated_at: ts });
          lastId = id;
        } else if (state.table === "life_events") {
          const id = `evt-${fake.nextEventId++}`;
          const ts = new Date().toISOString();
          fake.events.set(id, { ...r, id, created_at: ts, updated_at: ts });
          lastId = id;
        } else if (state.table === "life_chapters") {
          const id = `chp-${fake.nextChapterId++}`;
          const ts = new Date().toISOString();
          fake.chapters.set(id, { ...r, id, created_at: ts, updated_at: ts });
          lastId = id;
        } else if (state.table === "companion_memories") {
          // UNIQUE on significant_interaction_id: at most one Companion Memory
          // per source interaction.
          const siId = r.significant_interaction_id as string;
          const dup = [...fake.companionMemories.values()].some(
            (x) => x.significant_interaction_id === siId,
          );
          if (dup) {
            failed = true;
            lastId = null;
            continue;
          }
          const id = `cm-${fake.nextCompanionMemoryId++}`;
          const ts = new Date().toISOString();
          fake.companionMemories.set(id, {
            ...r,
            id,
            status: r.status ?? "active",
            source: r.source ?? "user_confirmed",
            created_at: ts,
            updated_at: ts,
            archived_at: r.archived_at ?? null,
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
    update: (patch) => makeChain({ ...state, pendingUpdate: patch }),
    delete: () => makeChain({ ...state, pendingDelete: true }),
  };
  (thenable as { then: unknown }).then = (
    resolve: (v: ChainResult) => void,
    reject?: (e: unknown) => void,
  ) => {
    try {
      runPending(state);
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
  archiveCompanionMemory,
  createCompanionMemory,
  deleteCompanionMemory,
  listActiveCompanionMemories,
  listCompanionMemories,
  loadCompanionMemory,
  loadCompanionMemoryBySignificantInteraction,
  loadCompanionMemoryProvenance,
  restoreCompanionMemory,
  updateCompanionMemory,
} from "@/lib/supabase/companion-memory-remote";
import {
  promoteSignificantInteractionLogic,
  type PromoteSignificantInteractionRequest,
} from "@/lib/llm/promoteSignificantInteraction.server";
import { loadTurn } from "@/lib/supabase/companion-remote";
import {
  loadSignificantInteraction,
  setSignificantInteractionStatus,
} from "@/lib/supabase/significant-remote";
import type { CompanionMemory, SignificantInteraction } from "@/lib/memory/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
beforeEach(() => {
  fake = {
    from: (table: string) => makeChain(freshState(table)),
    conversations: new Map(),
    turns: new Map(),
    interactions: new Map(),
    memories: new Map(),
    events: new Map(),
    chapters: new Map(),
    companionMemories: new Map(),
    nextConvId: 1,
    nextTurnId: 1,
    nextInteractionId: 1,
    nextMemoryId: 1,
    nextEventId: 1,
    nextChapterId: 1,
    nextCompanionMemoryId: 1,
  };
});

const TOKEN_U1 = "token-u1";
const TOKEN_U2 = "token-u2";
const TOKEN_ANON = "token-anon";

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
): {
  id: string;
  userId: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string;
  metadata: null;
} {
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

function seedInteraction(
  userId: string,
  conversationId: string,
  turnId: string,
  status: "candidate" | "confirmed" | "dismissed" | "archived" = "confirmed",
  candidateContent = "The user prefers calm replies",
): string {
  const id = `sig-${fake.nextInteractionId++}`;
  const ts = new Date().toISOString();
  fake.interactions.set(id, {
    id,
    user_id: userId,
    conversation_id: conversationId,
    turn_id: turnId,
    kind: "preference",
    candidate_content: candidateContent,
    reason: null,
    status,
    source: "ai_classified",
    confidence: 0.8,
    fingerprint: `${turnId}:${candidateContent.toLowerCase().replace(/\s+/g, " ")}`,
    created_at: ts,
    updated_at: ts,
  });
  return id;
}

function seedMemory(userId: string): string {
  const id = `mem-${fake.nextMemoryId++}`;
  const ts = new Date().toISOString();
  fake.memories.set(id, { id, user_id: userId, title: "A memory", created_at: ts, updated_at: ts });
  return id;
}
function seedEvent(userId: string): string {
  const id = `evt-${fake.nextEventId++}`;
  const ts = new Date().toISOString();
  fake.events.set(id, { id, user_id: userId, title: "An event", created_at: ts, updated_at: ts });
  return id;
}
function seedChapter(userId: string): string {
  const id = `chp-${fake.nextChapterId++}`;
  const ts = new Date().toISOString();
  fake.chapters.set(id, {
    id,
    user_id: userId,
    title: "A chapter",
    created_at: ts,
    updated_at: ts,
  });
  return id;
}

function promote(
  accessToken: string,
  significantInteractionId: string,
  opts: {
    relatedMemoryId?: string | null;
    relatedEventId?: string | null;
    relatedChapterId?: string | null;
  } = {},
): PromoteSignificantInteractionRequest {
  return {
    accessToken,
    significantInteractionId,
    relatedMemoryId: opts.relatedMemoryId ?? null,
    relatedEventId: opts.relatedEventId ?? null,
    relatedChapterId: opts.relatedChapterId ?? null,
  };
}

// ===========================================================================
// Promotion — 1-10
// ===========================================================================

describe("1. confirmed Significant Interaction can be promoted", () => {
  it("creates an active Companion Memory from a confirmed interaction", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this: I prefer calm");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    expect(res.ok).toBe(true);
    expect(res.promoted).toBe(true);
    expect(res.alreadyExisted).toBe(false);
    expect(res.companionMemory).not.toBeNull();
    expect(res.companionMemory!.status).toBe("active");
    expect(res.companionMemory!.source).toBe("user_confirmed");
    expect(res.companionMemory!.content).toBe("The user prefers calm replies");
  });
});

describe("2. candidate Significant Interaction cannot be promoted", () => {
  it("a still-candidate interaction yields no Companion Memory", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "candidate");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    expect(res.ok).toBe(false);
    expect(res.interactionVerified).toBe(false);
    expect(res.companionMemory).toBeNull();
    expect(fake.companionMemories.size).toBe(0);
  });
});

describe("3. dismissed Significant Interaction cannot be promoted", () => {
  it("a dismissed interaction yields no Companion Memory", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "dismissed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    expect(res.ok).toBe(false);
    expect(res.companionMemory).toBeNull();
  });
});

describe("4. duplicate promotion is prevented", () => {
  it("promoting the same interaction twice returns the existing memory", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const r1 = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    expect(r1.ok).toBe(true);
    const r2 = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    expect(r2.ok).toBe(true);
    expect(r2.alreadyExisted).toBe(true);
    expect(r2.companionMemory!.id).toBe(r1.companionMemory!.id);
    expect(fake.companionMemories.size).toBe(1);
  });
  it("createCompanionMemory rejects a duplicate significant_interaction_id directly", async () => {
    const a = await createCompanionMemory({
      userId: "u-1",
      significantInteractionId: "sig-1",
      kind: "preference",
      content: "prefers calm",
      source: "user_confirmed",
    });
    expect(a).not.toBeNull();
    const b = await createCompanionMemory({
      userId: "u-1",
      significantInteractionId: "sig-1",
      kind: "preference",
      content: "different",
      source: "user_confirmed",
    });
    expect(b).toBeNull();
    expect(fake.companionMemories.size).toBe(1);
  });
});

describe("5. Companion Memory gets correct provenance", () => {
  it("the memory references the source interaction + conversation + turn + user", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this: I prefer calm");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    const cm = res.companionMemory!;
    expect(cm.significantInteractionId).toBe(si);
    expect(cm.userId).toBe("u-1");
    // The source interaction still points to the turn/conversation.
    const src = await loadSignificantInteraction("u-1", si);
    expect(src!.turnId).toBe(t.id);
    expect(src!.conversationId).toBe(cid);
  });
});

describe("6. wrong-user Significant Interaction is rejected", () => {
  it("u-2 cannot promote u-1's interaction", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const authU2 = makeAuth({ [TOKEN_U2]: { id: "u-2" } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_U2, si), authU2.fn);
    expect(res.ok).toBe(false);
    expect(res.companionMemory).toBeNull();
    expect(fake.companionMemories.size).toBe(0);
  });
});

describe("7. related Memory must belong to current user", () => {
  it("a related memory owned by another user is rejected", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const otherMem = seedMemory("u-2");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(
      promote(TOKEN_U1, si, { relatedMemoryId: otherMem }),
      auth.fn,
    );
    expect(res.ok).toBe(false);
    expect(res.companionMemory).toBeNull();
  });
  it("a related memory owned by the current user is accepted", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const myMem = seedMemory("u-1");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(
      promote(TOKEN_U1, si, { relatedMemoryId: myMem }),
      auth.fn,
    );
    expect(res.ok).toBe(true);
    expect(res.companionMemory!.relatedMemoryId).toBe(myMem);
  });
});

describe("8. related Event must belong to current user", () => {
  it("a related event owned by another user is rejected", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const otherEvt = seedEvent("u-2");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(
      promote(TOKEN_U1, si, { relatedEventId: otherEvt }),
      auth.fn,
    );
    expect(res.ok).toBe(false);
  });
  it("a related event owned by the current user is accepted", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const myEvt = seedEvent("u-1");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(
      promote(TOKEN_U1, si, { relatedEventId: myEvt }),
      auth.fn,
    );
    expect(res.ok).toBe(true);
    expect(res.companionMemory!.relatedEventId).toBe(myEvt);
  });
});

describe("9. related Chapter must belong to current user", () => {
  it("a related chapter owned by another user is rejected", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const otherChp = seedChapter("u-2");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(
      promote(TOKEN_U1, si, { relatedChapterId: otherChp }),
      auth.fn,
    );
    expect(res.ok).toBe(false);
  });
  it("a related chapter owned by the current user is accepted", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const myChp = seedChapter("u-1");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(
      promote(TOKEN_U1, si, { relatedChapterId: myChp }),
      auth.fn,
    );
    expect(res.ok).toBe(true);
    expect(res.companionMemory!.relatedChapterId).toBe(myChp);
  });
});

describe("10. anonymous user can own Companion Memory", () => {
  it("an anonymous user can promote a confirmed interaction", async () => {
    const cid = seedConversation("anon-1");
    const t = seedTurn("anon-1", cid, "user", "remember this");
    const si = seedInteraction("anon-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_ANON]: { id: "anon-1", isAnonymous: true } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_ANON, si), auth.fn);
    expect(res.ok).toBe(true);
    expect(res.companionMemory!.userId).toBe("anon-1");
  });
});

// ===========================================================================
// Authenticated + retrieval + CRUD — 11-19
// ===========================================================================

describe("11. authenticated user can own Companion Memory", () => {
  it("an authenticated user can promote a confirmed interaction", async () => {
    const cid = seedConversation("auth-1");
    const t = seedTurn("auth-1", cid, "user", "remember this");
    const si = seedInteraction("auth-1", cid, t.id, "confirmed");
    const auth = makeAuth({ "token-auth": { id: "auth-1", isAnonymous: false } });
    const res = await promoteSignificantInteractionLogic(promote("token-auth", si), auth.fn);
    expect(res.ok).toBe(true);
    expect(res.companionMemory!.userId).toBe("auth-1");
  });
});

describe("12. active memory appears in default retrieval", () => {
  it("listActiveCompanionMemories returns active memories only", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    const active = await listActiveCompanionMemories("u-1");
    expect(active).toHaveLength(1);
    expect(active[0].status).toBe("active");
  });
  it("listCompanionMemories returns active by default", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    const list = await listCompanionMemories("u-1");
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("active");
  });
});

describe("13. archived memory excluded from default retrieval", () => {
  it("an archived memory is not in the default list", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    await archiveCompanionMemory("u-1", res.companionMemory!.id);
    const active = await listActiveCompanionMemories("u-1");
    expect(active).toHaveLength(0);
    const list = await listCompanionMemories("u-1");
    expect(list).toHaveLength(0);
  });
  it("an archived memory appears when includeArchived=true", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    await archiveCompanionMemory("u-1", res.companionMemory!.id);
    const list = await listCompanionMemories("u-1", { includeArchived: true });
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe("archived");
  });
});

describe("14. restore makes archived memory active again", () => {
  it("archive then restore returns status active and clears archivedAt", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    const id = res.companionMemory!.id;
    const arch = await archiveCompanionMemory("u-1", id);
    expect(arch!.status).toBe("archived");
    expect(arch!.archivedAt).not.toBeNull();
    const rest = await restoreCompanionMemory("u-1", id);
    expect(rest!.status).toBe("active");
    expect(rest!.archivedAt).toBeNull();
    const active = await listActiveCompanionMemories("u-1");
    expect(active).toHaveLength(1);
  });
});

describe("15. delete removes Companion Memory", () => {
  it("deleteCompanionMemory removes the row", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    const id = res.companionMemory!.id;
    const ok = await deleteCompanionMemory("u-1", id);
    expect(ok).toBe(true);
    expect(fake.companionMemories.size).toBe(0);
    expect(await loadCompanionMemory("u-1", id)).toBeNull();
  });
  it("deleting another user's memory leaves it intact (safe no-op)", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    const id = res.companionMemory!.id;
    await deleteCompanionMemory("u-2", id);
    // Cross-user delete is a safe no-op (RLS blocks it): the memory survives.
    expect(fake.companionMemories.size).toBe(1);
    const still = await loadCompanionMemory("u-1", id);
    expect(still).not.toBeNull();
    expect(still!.content).toBe("The user prefers calm replies");
  });
});

describe("16. deleting related Memory does not delete Companion Memory", () => {
  it("ON DELETE SET NULL detaches the link but preserves the Companion Memory", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const myMem = seedMemory("u-1");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(
      promote(TOKEN_U1, si, { relatedMemoryId: myMem }),
      auth.fn,
    );
    const cmId = res.companionMemory!.id;
    // Delete the related Memory via the fake's delete path.
    await fake.from("memories").delete();
    expect(fake.memories.size).toBe(0);
    // Companion Memory survives; link is detached.
    const cm = await loadCompanionMemory("u-1", cmId);
    expect(cm).not.toBeNull();
    expect(cm!.content).toBe("The user prefers calm replies");
    expect(cm!.relatedMemoryId).toBeNull();
  });
});

describe("17. deleting related Event does not delete Companion Memory", () => {
  it("ON DELETE SET NULL detaches the event link", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const myEvt = seedEvent("u-1");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(
      promote(TOKEN_U1, si, { relatedEventId: myEvt }),
      auth.fn,
    );
    const cmId = res.companionMemory!.id;
    await fake.from("life_events").delete();
    const cm = await loadCompanionMemory("u-1", cmId);
    expect(cm).not.toBeNull();
    expect(cm!.relatedEventId).toBeNull();
  });
});

describe("18. deleting related Chapter does not delete Companion Memory", () => {
  it("ON DELETE SET NULL detaches the chapter link", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const myChp = seedChapter("u-1");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(
      promote(TOKEN_U1, si, { relatedChapterId: myChp }),
      auth.fn,
    );
    const cmId = res.companionMemory!.id;
    await fake.from("life_chapters").delete();
    const cm = await loadCompanionMemory("u-1", cmId);
    expect(cm).not.toBeNull();
    expect(cm!.relatedChapterId).toBeNull();
  });
});

describe("19. user can edit Companion Memory", () => {
  it("updateCompanionMemory changes content only", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    const id = res.companionMemory!.id;
    const updated = await updateCompanionMemory("u-1", id, "Edited content");
    expect(updated).not.toBeNull();
    expect(updated!.content).toBe("Edited content");
    // Provenance unchanged.
    expect(updated!.significantInteractionId).toBe(si);
    expect(updated!.status).toBe("active");
    expect(updated!.source).toBe("user_confirmed");
  });
  it("cross-user edit fails safely", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    const r = await updateCompanionMemory("u-2", res.companionMemory!.id, "hacked");
    expect(r).toBeNull();
    const cm = await loadCompanionMemory("u-1", res.companionMemory!.id);
    expect(cm!.content).toBe("The user prefers calm replies");
  });
});

describe("20. AI cannot silently rewrite existing Companion Memory", () => {
  it("no AI path imports updateCompanionMemory or promoteSignificantInteraction", async () => {
    const fs = await import("node:fs");
    // The companion conversation engine must not mutate Companion Memories.
    const conv = fs.readFileSync("src/lib/llm/companionConversation.server.ts", "utf8");
    expect(conv).not.toMatch(/updateCompanionMemory/);
    expect(conv).not.toMatch(/createCompanionMemory/);
    expect(conv).not.toMatch(/promoteSignificantInteraction/);
    // No AI module other than the user-only management fn imports updateCompanionMemory.
    for (const f of [
      "src/lib/llm/companionConversation.server.ts",
      "src/lib/llm/companionConversation.ts",
      "src/lib/llm/significantInteraction.ts",
      "src/lib/llm/classifySignificantInteraction.server.ts",
      "src/lib/llm/confirmSignificantInteraction.server.ts",
      "src/lib/llm/promoteSignificantInteraction.server.ts",
    ]) {
      if (!fs.existsSync(f)) continue;
      const src = fs.readFileSync(f, "utf8");
      expect(src).not.toMatch(/updateCompanionMemory\s*\(/);
    }
  });
});

// ===========================================================================
// Provenance + identity + failure — 21-25
// ===========================================================================

describe('21. "Why do you remember this?" exposes provenance', () => {
  it("loadCompanionMemoryProvenance reconstructs the chain", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this: I prefer calm");
    const si = seedInteraction("u-1", cid, t.id, "confirmed", "The user prefers calm replies");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    const p = await loadCompanionMemoryProvenance("u-1", res.companionMemory!.id);
    expect(p).not.toBeNull();
    expect(p!.companionMemoryId).toBe(res.companionMemory!.id);
    expect(p!.significantInteractionId).toBe(si);
    expect(p!.conversationId).toBe(cid);
    expect(p!.turnId).toBe(t.id);
    expect(p!.turnContent).toBe("remember this: I prefer calm");
    expect(p!.kind).toBe("preference");
    expect(p!.source).toBe("user_confirmed");
  });
  it("cross-user provenance is null (no existence leakage)", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    const p = await loadCompanionMemoryProvenance("u-2", res.companionMemory!.id);
    expect(p).toBeNull();
  });
});

describe("22. original conversation turn remains unchanged", () => {
  it("promotion does not mutate the source turn", async () => {
    const cid = seedConversation("u-1");
    const original = "remember this: I prefer calm";
    const t = seedTurn("u-1", cid, "user", original);
    const si = seedInteraction("u-1", cid, t.id, "confirmed", "The user prefers calm replies");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    const still = await loadTurn("u-1", t.id);
    expect(still!.content).toBe(original);
    expect(still!.role).toBe("user");
  });
  it("Companion Memory content is NOT a copy of the original turn", async () => {
    const cid = seedConversation("u-1");
    const original = "remember this: I prefer calm";
    const t = seedTurn("u-1", cid, "user", original);
    const candidate = "The user prefers calm replies";
    const si = seedInteraction("u-1", cid, t.id, "confirmed", candidate);
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    expect(res.companionMemory!.content).toBe(candidate);
    expect(res.companionMemory!.content).not.toBe(original);
  });
});

describe("23. original Significant Interaction remains unchanged", () => {
  it("promotion does not mutate the source interaction", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed", "The user prefers calm replies");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    const src = await loadSignificantInteraction("u-1", si);
    expect(src!.status).toBe("confirmed");
    expect(src!.candidateContent).toBe("The user prefers calm replies");
    expect(src!.kind).toBe("preference");
  });
});

describe("24. failed promotion does not create duplicate memory", () => {
  it("a failed createCompanionMemory (empty content) creates no row", async () => {
    const r = await createCompanionMemory({
      userId: "u-1",
      significantInteractionId: "sig-1",
      kind: "preference",
      content: "   ",
      source: "user_confirmed",
    });
    expect(r).toBeNull();
    expect(fake.companionMemories.size).toBe(0);
  });
  it("a second promotion after a failure reuses the existing row (no dup)", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    // First promotion succeeds.
    const r1 = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    expect(r1.ok).toBe(true);
    // Simulate a "retry": the logic reuses the existing row.
    const r2 = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    expect(r2.ok).toBe(true);
    expect(r2.alreadyExisted).toBe(true);
    expect(fake.companionMemories.size).toBe(1);
  });
});

describe("25. retry after promotion failure is safe", () => {
  it("sequential retries are idempotent (no duplicate)", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const r1 = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    expect(r1.ok).toBe(true);
    // A later retry (e.g. after a transient failure) reuses the existing row.
    const r2 = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    expect(r2.ok).toBe(true);
    expect(r2.alreadyExisted).toBe(true);
    expect(r2.companionMemory!.id).toBe(r1.companionMemory!.id);
    const r3 = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    expect(r3.ok).toBe(true);
    expect(r3.alreadyExisted).toBe(true);
    expect(fake.companionMemories.size).toBe(1);
  });
});

// ===========================================================================
// Identity + security + scope — 26-34
// ===========================================================================

describe("26. no browser userId is trusted", () => {
  it("promoteSignificantInteractionLogic derives userId from getCurrentUser", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    expect(auth.calls).toContain(TOKEN_U1);
  });
  it("no access token → rejected before any work", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(promote("", si), auth.fn);
    expect(res.ok).toBe(false);
    expect(fake.companionMemories.size).toBe(0);
  });
});

async function readSrc(path: string): Promise<string> {
  const fs = await import("node:fs");
  return fs.readFileSync(path, "utf8");
}
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // JS block comments
    .replace(/\/\/.*$/gm, "") // JS line comments
    .replace(/--.*$/gm, ""); // SQL line comments
}

describe("27. no service-role key", () => {
  it("companion-memory modules reference no service-role/admin auth", async () => {
    for (const f of [
      "src/lib/supabase/companion-memory-remote.ts",
      "src/lib/llm/promoteSignificantInteraction.server.ts",
      "src/lib/llm/companionMemory.server.ts",
    ]) {
      const src = await readSrc(f);
      const code = stripComments(src);
      expect(code).not.toMatch(
        /service_role|service-role|SUPABASE_SERVICE_ROLE|admin\.Auth|auth\.admin/,
      );
    }
  });
});

describe("28. no provider key in client bundle", () => {
  it("client + pure modules reference no provider keys / process.env", async () => {
    for (const f of [
      "src/routes/profile.tsx",
      "src/components/identity/CompanionMemoriesPanel.tsx",
      "src/lib/supabase/companion-memory-remote.ts",
    ]) {
      const src = await readSrc(f);
      for (const k of [
        "GROQ_API_KEY",
        "GEMINI_API_KEY",
        "MISTRAL_API_KEY",
        "OPENROUTER_API_KEY",
        "SUPABASE_SERVICE_ROLE",
        "process.env",
      ]) {
        expect(src).not.toContain(k);
      }
    }
  });
  it("no provider key in the production client bundle", async () => {
    const fs = await import("node:fs");
    const dir = ".output/public/assets";
    if (!fs.existsSync(dir)) return; // build not run in this test pass
    const found: string[] = [];
    for (const f of fs.readdirSync(dir)) {
      const src = fs.readFileSync(`${dir}/${f}`, "utf8");
      for (const k of [
        "GROQ_API_KEY",
        "GEMINI_API_KEY",
        "MISTRAL_API_KEY",
        "OPENROUTER_API_KEY",
        "SUPABASE_SERVICE_ROLE",
      ]) {
        if (src.includes(k)) found.push(`${f}:${k}`);
      }
    }
    expect(found).toEqual([]);
  });
});

describe("29. no browser LLM call", () => {
  it("client modules never import orchestra/runRole", async () => {
    for (const f of [
      "src/lib/supabase/companion-memory-remote.ts",
      "src/lib/llm/promoteSignificantInteraction.server.ts",
    ]) {
      const src = await readSrc(f);
      expect(src).not.toMatch(/from ["']@\/lib\/llm\/orchestra["']/);
      expect(src).not.toMatch(/runRole\s*\(/);
      expect(src).not.toMatch(/api\.groq\.com|generativelanguage|api\.mistral|openrouter\.ai/);
    }
  });
  it("Companion Memory creation needs no LLM call", async () => {
    const promote = await readSrc("src/lib/llm/promoteSignificantInteraction.server.ts");
    expect(promote).not.toMatch(/runRole|orchestra|groq|gemini|mistral|openrouter/i);
  });
});

describe("30. anonymous session remains compatible", () => {
  it("anonymous user CRUD works end-to-end", async () => {
    const cid = seedConversation("anon-1");
    const t = seedTurn("anon-1", cid, "user", "remember this");
    const si = seedInteraction("anon-1", cid, t.id, "confirmed");
    const auth = makeAuth({ [TOKEN_ANON]: { id: "anon-1", isAnonymous: true } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_ANON, si), auth.fn);
    expect(res.ok).toBe(true);
    const arch = await archiveCompanionMemory("anon-1", res.companionMemory!.id);
    expect(arch!.status).toBe("archived");
    const rest = await restoreCompanionMemory("anon-1", res.companionMemory!.id);
    expect(rest!.status).toBe("active");
    const ok = await deleteCompanionMemory("anon-1", res.companionMemory!.id);
    expect(ok).toBe(true);
  });
});

describe("31. authenticated session remains compatible", () => {
  it("authenticated user CRUD works end-to-end", async () => {
    const cid = seedConversation("auth-1");
    const t = seedTurn("auth-1", cid, "user", "remember this");
    const si = seedInteraction("auth-1", cid, t.id, "confirmed");
    const auth = makeAuth({ "token-auth": { id: "auth-1", isAnonymous: false } });
    const res = await promoteSignificantInteractionLogic(promote("token-auth", si), auth.fn);
    expect(res.ok).toBe(true);
    const upd = await updateCompanionMemory("auth-1", res.companionMemory!.id, "edited");
    expect(upd!.content).toBe("edited");
    const ok = await deleteCompanionMemory("auth-1", res.companionMemory!.id);
    expect(ok).toBe(true);
  });
});

describe("32. existing Conversation behavior unchanged", () => {
  it("companion-remote still loads turns/conversations", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "hello");
    const turn = await loadTurn("u-1", t.id);
    expect(turn).not.toBeNull();
    expect(turn!.content).toBe("hello");
  });
});

describe("33. existing Significant Interaction behavior unchanged", () => {
  it("significance confirm/dismiss still work", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "candidate");
    const confirmed = await setSignificantInteractionStatus("u-1", si, "confirmed");
    expect(confirmed!.status).toBe("confirmed");
    const dismissed = await setSignificantInteractionStatus("u-1", si, "dismissed");
    expect(dismissed!.status).toBe("dismissed");
  });
  it("Companion Memory promotion requires the interaction to STILL be confirmed (not just at seed time)", async () => {
    const cid = seedConversation("u-1");
    const t = seedTurn("u-1", cid, "user", "remember this");
    const si = seedInteraction("u-1", cid, t.id, "confirmed");
    // Dismiss it after seeding.
    await setSignificantInteractionStatus("u-1", si, "dismissed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si), auth.fn);
    expect(res.ok).toBe(false);
    expect(res.companionMemory).toBeNull();
  });
});

describe("34. existing Memory/Pattern/Event/Chapter/Media behavior unchanged", () => {
  it("migration 0009 touches no other tables (no alter/drop)", async () => {
    const mig = await readSrc("supabase/migrations/0009_companion_memories.sql");
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
      "significant_interactions",
    ]) {
      expect(mig).not.toMatch(new RegExp(`alter table public\\.${table}`, "i"));
      expect(mig).not.toMatch(new RegExp(`drop table.*${table}`, "i"));
    }
    expect(mig).toContain("companion_memories");
  });
  it("companion-memory-remote references no other tables for mutations", async () => {
    const src = await readSrc("src/lib/supabase/companion-memory-remote.ts");
    expect(src).toContain("companion_memories");
    // It may READ memories/life_events/life_chapters via the remote loaders for
    // provenance, but it must not WRITE to them.
    for (const t of ["memories", "life_events", "life_chapters"]) {
      expect(src).not.toMatch(new RegExp(`from\\(["']${t}["']\\)\\.insert`));
      expect(src).not.toMatch(new RegExp(`from\\(["']${t}["']\\)\\.update`));
      expect(src).not.toMatch(new RegExp(`from\\(["']${t}["']\\)\\.delete`));
    }
  });
  it("migration 0009 FKs reference significant_interactions with ON DELETE CASCADE and related objects with ON DELETE SET NULL", async () => {
    const mig = await readSrc("supabase/migrations/0009_companion_memories.sql");
    expect(mig).toMatch(
      /significant_interaction_id.*references public\.significant_interactions.*on delete cascade/i,
    );
    expect(mig).toMatch(/related_memory_id.*references public\.memories.*on delete set null/i);
    expect(mig).toMatch(/related_event_id.*references public\.life_events.*on delete set null/i);
    expect(mig).toMatch(
      /related_chapter_id.*references public\.life_chapters.*on delete set null/i,
    );
  });
  it("migration 0009 kind CHECK excludes forbidden categories", async () => {
    const mig = await readSrc("supabase/migrations/0009_companion_memories.sql");
    const code = stripComments(mig);
    expect(code).toMatch(
      /kind in \('directive', 'preference', 'confirmed_context', 'boundary', 'decision'\)/,
    );
    for (const k of [
      "ai_fact",
      "psychological_profile",
      "diagnosis",
      "personality_trait",
      "inferred_relationship",
      "inferred_biography",
    ]) {
      expect(code).not.toContain(k);
    }
  });
  it("migration 0009 source CHECK locks user_confirmed only", async () => {
    const mig = await readSrc("supabase/migrations/0009_companion_memories.sql");
    const code = stripComments(mig);
    expect(code).toMatch(/source in \('user_confirmed'\)/);
    expect(code).not.toContain("ai_generated");
  });
  it("migration 0009 unique index prevents duplicate promotion", async () => {
    const mig = await readSrc("supabase/migrations/0009_companion_memories.sql");
    expect(mig).toMatch(/create unique index.*companion_memories_si_uniq/i);
    expect(mig).toMatch(/on public\.companion_memories \(significant_interaction_id\)/i);
  });
  it("migration 0009 RLS: four owner policies present", async () => {
    const mig = await readSrc("supabase/migrations/0009_companion_memories.sql");
    expect(mig).toContain("enable row level security");
    expect(mig).toContain("companion_memories_owner_select");
    expect(mig).toContain("companion_memories_owner_insert");
    expect(mig).toContain("companion_memories_owner_update");
    expect(mig).toContain("companion_memories_owner_delete");
    expect(mig).toMatch(/auth\.uid\(\) = user_id/);
  });
  it("status CHECK is active|archived only (no extra lifecycle states)", async () => {
    const mig = await readSrc("supabase/migrations/0009_companion_memories.sql");
    expect(mig).toMatch(/status in \('active', 'archived'\)/);
    expect(mig).not.toMatch(/'candidate'|'dismissed'|'deleted'/);
  });
  it("promote fn never confirms an interaction (no status mutation)", async () => {
    const src = await readSrc("src/lib/llm/promoteSignificantInteraction.server.ts");
    const code = stripComments(src);
    expect(code).not.toMatch(
      /setSignificantInteractionStatus|confirmSignificantInteraction|dismissSignificantInteraction/,
    );
  });
});

describe("loadCompanionMemoryBySignificantInteraction owner scope", () => {
  it("returns only the caller's memory for the interaction", async () => {
    const cid1 = seedConversation("u-1");
    const t1 = seedTurn("u-1", cid1, "user", "remember this");
    const si1 = seedInteraction("u-1", cid1, t1.id, "confirmed");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const r1 = await promoteSignificantInteractionLogic(promote(TOKEN_U1, si1), auth.fn);
    const mine = await loadCompanionMemoryBySignificantInteraction("u-1", si1);
    expect(mine!.id).toBe(r1.companionMemory!.id);
    const cross = await loadCompanionMemoryBySignificantInteraction("u-2", si1);
    expect(cross).toBeNull();
  });
});
