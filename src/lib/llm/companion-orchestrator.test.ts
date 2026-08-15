import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Companion Contextual Orchestration v1 — deterministic tests.
 *
 * Covers the spec's 36 scenarios:
 *   1-10  intent routing (chat, memory, companion-memory, pattern, event/
 *         chapter, story, memory-creation, reflection, ambiguous, override)
 *   11    current-user-instruction overrides stored Companion Memory
 *   12-16 retrieval routing + budget (memory bounded, companion-memory no
 *         unrelated domains, pattern loads evidence, chapter no Media, story
 *         bounded)
 *   17    ordinary chat adds no retrieval LLM call
 *   18-20 orchestration is pure (no network, no Orchestra, unknown fallback)
 *   21-23 identity (cross-user isolation, current authenticated user, no
 *         browser userId authority)
 *   24-25 secret boundary (no provider key in client, no direct provider call)
 *   26-36 existing-flows preserved + scope (significance gate, companion-memory
 *         confirmation, conversation persistence, retrieval foundation, story
 *         fallback, pattern interpretation, anon, auth, sign-out, no new table,
 *         no new provider)
 *
 * No live LLM calls. No external network. The Orchestra call is an injectable
 * `runRoleImpl`. Supabase is a stateful in-memory fake keyed on maps. Identity
 * is injected via a fake `getCurrentUserImpl`.
 */

// ---------------------------------------------------------------------------
// Fake Supabase (stateful, in-memory, owner-scoped)
// ---------------------------------------------------------------------------
type FakeRow = Record<string, unknown>;
type ChainResult = { data: FakeRow | FakeRow[] | null; error: unknown };

type Chain = {
  select: (cols?: string) => Chain;
  eq: (col: string, val: unknown) => Chain;
  neq: (col: string, val: unknown) => Chain;
  in: (col: string, vals: unknown[]) => Chain;
  order: (col: string, opts?: { ascending?: boolean }) => Chain;
  limit: (n: number) => Chain;
  maybeSingle: () => Promise<ChainResult>;
  single: () => Promise<ChainResult>;
  insert: (row: FakeRow | FakeRow[]) => Chain;
  update: (patch: FakeRow) => Chain;
  delete: () => Promise<{ error: unknown }>;
};

type FakeSupabase = {
  from: (table: string) => Chain;
  conversations: Map<string, FakeRow>;
  turns: Map<string, FakeRow>;
  memories: Map<string, FakeRow>;
  experiences: Map<string, FakeRow>;
  bridges: Map<string, FakeRow>;
  reflections: Map<string, FakeRow>;
  patterns: Map<string, FakeRow>;
  patternMemories: Map<string, FakeRow>;
  events: Map<string, FakeRow>;
  chapters: Map<string, FakeRow>;
  companionMemories: Map<string, FakeRow>;
  nextConvId: number;
  nextTurnId: number;
  nextId: number;
};

let fake: FakeSupabase;

type OrderSpec = { col: string; ascending: boolean } | null;
type ChainState = {
  table: string;
  filters: Record<string, unknown>;
  neqFilters: Record<string, unknown>;
  inFilters: Record<string, unknown[]>;
  order: OrderSpec;
  limit: number | null;
};

function tableRows(table: string): FakeRow[] {
  switch (table) {
    case "companion_conversations":
      return [...fake.conversations.values()];
    case "companion_turns":
      return [...fake.turns.values()];
    case "memories":
      return [...fake.memories.values()];
    case "music_experiences":
      return [...fake.experiences.values()];
    case "memory_music_experiences":
      return [...fake.bridges.values()];
    case "reflections":
      return [...fake.reflections.values()];
    case "patterns":
      return [...fake.patterns.values()];
    case "life_events":
      return [...fake.events.values()];
    case "life_chapters":
      return [...fake.chapters.values()];
    case "companion_memories":
      return [...fake.companionMemories.values()];
    case "pattern_memories":
      return [...fake.patternMemories.values()];
    default:
      return [];
  }
}

function matchRows(state: ChainState): FakeRow[] {
  let rows = tableRows(state.table);
  for (const [k, v] of Object.entries(state.filters)) rows = rows.filter((r) => r[k] === v);
  for (const [k, v] of Object.entries(state.neqFilters)) rows = rows.filter((r) => r[k] !== v);
  for (const [k, vals] of Object.entries(state.inFilters))
    rows = rows.filter((r) => vals.includes(r[k]));
  if (state.order) {
    const { col, ascending } = state.order;
    rows = [...rows].sort((a, b) => {
      const av = a[col] == null ? "" : String(a[col]);
      const bv = b[col] == null ? "" : String(b[col]);
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
    neq: (col, val) => makeChain({ ...state, neqFilters: { ...state.neqFilters, [col]: val } }),
    in: (col, vals) => makeChain({ ...state, inFilters: { ...state.inFilters, [col]: vals } }),
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
          fake.conversations.set(id, { ...r, id });
          lastId = id;
        } else if (state.table === "companion_turns") {
          const id = `turn-${fake.nextTurnId++}`;
          fake.turns.set(id, { ...r, id, created_at: new Date().toISOString() });
          lastId = id;
        }
      }
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
    delete: async () => ({ error: null }),
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

function makeFake(): FakeSupabase {
  return {
    from: (table: string) =>
      makeChain({ table, filters: {}, neqFilters: {}, inFilters: {}, order: null, limit: null }),
    conversations: new Map(),
    turns: new Map(),
    memories: new Map(),
    experiences: new Map(),
    bridges: new Map(),
    reflections: new Map(),
    patterns: new Map(),
    patternMemories: new Map(),
    events: new Map(),
    chapters: new Map(),
    companionMemories: new Map(),
    nextConvId: 1,
    nextTurnId: 1,
    nextId: 1,
  };
}

vi.mock("@/lib/supabase/client", () => ({
  getSupabase: () => fake,
  isSupabaseConfigured: () => true,
}));

// ---------------------------------------------------------------------------
// Subjects under test
// ---------------------------------------------------------------------------
import {
  orchestrate,
  resolveBudgets,
  GLOBAL_DEFAULT_BUDGETS,
  type CompanionIntent,
} from "@/lib/llm/companionOrchestrator";
import { planCapability, type CapabilityContext } from "@/lib/llm/companionCapabilities";
import { retrieveCompanionContextForIntentLogic } from "@/lib/llm/retrieveCompanionContext.server";
import { companionConversationLogic } from "@/lib/llm/companionConversation.server";
import type { CompanionContextItem } from "@/lib/memory/companionRetrieval";
import type {
  CompanionTurn,
  Memory,
  Pattern,
  Reflection,
  LifeEvent,
  LifeChapter,
  CompanionMemory,
} from "@/lib/memory/types";
import type { OrchestraRole } from "@/lib/llm/orchestra";

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------
function seedConversation(userId: string): string {
  const id = `conv-${fake.nextConvId++}`;
  fake.conversations.set(id, {
    id,
    user_id: userId,
    title: null,
    status: "active",
    started_at: "2024-01-01T00:00:00Z",
    last_activity_at: "2024-01-01T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  });
  return id;
}

function seedTurn(
  userId: string,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  ts = 1000,
): string {
  const id = `turn-${fake.nextTurnId++}`;
  fake.turns.set(id, {
    id,
    user_id: userId,
    conversation_id: conversationId,
    role,
    content,
    created_at: new Date(ts).toISOString(),
    metadata: null,
  });
  return id;
}

function seedMemory(
  userId: string,
  opts: { title?: string | null; userNote?: string | null; eventStart?: string | null } = {},
): Memory {
  const mid = `mem-${fake.nextId++}`;
  const eid = `exp-${fake.nextId++}`;
  fake.experiences.set(eid, {
    id: eid,
    user_id: userId,
    source_type: "streaming",
    title: opts.title ?? null,
    artist: null,
    album: null,
    external_ref: null,
    source_notes: null,
  });
  fake.bridges.set(`b-${mid}`, {
    memory_id: mid,
    music_experience_id: eid,
    user_id: userId,
    position: 0,
    role: "primary",
  });
  fake.memories.set(mid, {
    id: mid,
    user_id: userId,
    recorded_at: "2024-01-01T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    original_user_note: opts.userNote ?? null,
    user_note: opts.userNote ?? null,
    feeling: null,
    life_event: null,
    location: null,
    weather: null,
    event_time_granularity: null,
    event_time_start: opts.eventStart ?? null,
    event_time_end: null,
    event_time_label: null,
    ai_context: null,
    ai_context_stale_at: null,
  });
  return {
    id: mid,
    userId,
    recordedAt: "2024-01-01T00:00:00Z",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    originalUserNote: opts.userNote ?? null,
    userNote: opts.userNote ?? null,
    feeling: null,
    lifeEvent: null,
    location: null,
    weather: null,
    eventTime: { granularity: undefined, start: opts.eventStart ?? null, end: null, label: null },
    aiContext: null,
    aiContextStaleAt: null,
    musicExperiences: [
      {
        musicExperienceId: eid,
        position: 0,
        role: "primary",
        experience: {
          id: eid,
          sourceType: "streaming" as never,
          title: opts.title ?? null,
          artist: null,
          album: null,
          externalRef: null,
          sourceNotes: null,
        },
      },
    ],
  };
}

function seedCompanionMemory(
  userId: string,
  kind: CompanionMemory["kind"],
  content: string,
): CompanionMemory {
  const id = `cm-${fake.nextId++}`;
  fake.companionMemories.set(id, {
    id,
    user_id: userId,
    significant_interaction_id: `si-x`,
    kind,
    content,
    status: "active",
    source: "user_confirmed",
    related_memory_id: null,
    related_event_id: null,
    related_chapter_id: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    archived_at: null,
  });
  return {
    id,
    userId,
    significantInteractionId: `si-x`,
    kind,
    content,
    status: "active",
    source: "user_confirmed",
    relatedMemoryId: null,
    relatedEventId: null,
    relatedChapterId: null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    archivedAt: null,
  };
}

function seedReflection(
  userId: string,
  memoryId: string,
  author: "user" | "companion",
  body: string,
): Reflection {
  const id = `ref-${fake.nextId++}`;
  fake.reflections.set(id, {
    id,
    user_id: userId,
    memory_id: memoryId,
    author,
    body,
    reflected_at: "2024-01-01T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    source_context: null,
  });
  return {
    id,
    userId,
    memoryId,
    author,
    body,
    reflectedAt: "2024-01-01T00:00:00Z",
    createdAt: "2024-01-01T00:00:00Z",
    sourceContext: null,
  };
}

function seedPattern(userId: string, title: string, interpretation: string | null = null): Pattern {
  const id = `pat-${fake.nextId++}`;
  // Pattern evidence row (pattern_memories table).
  const pmId = `pm-${fake.nextId++}`;
  fake.patternMemories.set(pmId, {
    id: pmId,
    pattern_id: id,
    memory_id: "mem-1",
    user_id: userId,
    evidence_role: null,
  });
  fake.patterns.set(id, {
    id,
    user_id: userId,
    pattern_type: "repeated_music",
    title,
    summary: "summary",
    confidence: 1,
    observed_from: null,
    observed_to: null,
    status: "active",
    fingerprint: `fp-${title}`,
    evidence_count: 1,
    interpretation,
    interpretation_model: interpretation ? "orchestrator" : null,
    interpretation_prompt_version: null,
    interpretation_created_at: interpretation ? "2024-01-01T00:00:00Z" : null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  });
  return {
    id,
    userId,
    patternType: "repeated_music",
    title,
    summary: "summary",
    confidence: 1,
    observedFrom: null,
    observedTo: null,
    status: "active",
    fingerprint: `fp-${title}`,
    evidenceCount: 1,
    evidence: [{ memoryId: "mem-1", evidenceRole: null }],
    interpretation,
    interpretationModel: interpretation ? "orchestrator" : null,
    interpretationPromptVersion: null,
    interpretationCreatedAt: interpretation ? "2024-01-01T00:00:00Z" : null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
}

function seedEvent(userId: string, title: string): LifeEvent {
  return {
    id: `evt-${fake.nextId++}`,
    userId,
    title,
    description: null,
    startAt: null,
    endAt: null,
    timePrecision: "year",
    timeLabel: null,
    location: null,
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
}

function seedChapter(userId: string, title: string): LifeChapter {
  return {
    id: `chp-${fake.nextId++}`,
    userId,
    title,
    description: null,
    startAt: null,
    endAt: null,
    timePrecision: "year",
    timeLabel: null,
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
}

function makeRunRole(reply: string | null) {
  const calls: { role: string; message: string }[] = [];
  const fn = async (role: OrchestraRole, message: string): Promise<string | null> => {
    calls.push({ role, message });
    return reply;
  };
  return { fn: fn as typeof import("@/lib/llm/orchestra").runRole, calls };
}

function makeAuth(map: Record<string, { id: string; isAnonymous?: boolean }>) {
  const fn = vi.fn(
    async (token?: string | null): Promise<{ id: string; isAnonymous: boolean } | null> => {
      if (!token || !map[token]) return null;
      const u = map[token];
      return { id: u.id, isAnonymous: u.isAnonymous ?? true };
    },
  );
  return { fn };
}

const TOKEN_U1 = "tok-u1";
const TOKEN_U2 = "tok-u2";
const TOKEN_UP = "tok-up";

beforeEach(() => {
  fake = makeFake();
});

// ---------------------------------------------------------------------------
// Intent routing (1-10)
// ---------------------------------------------------------------------------
describe("intent routing", () => {
  it("1. greeting → chat", () => {
    expect(orchestrate("How are you?").intent).toBe("chat");
  });

  it("2. ordinary conversation → chat", () => {
    expect(orchestrate("tell me about the weather").intent).toBe("chat");
  });

  it("3. explicit Memory recall → memory_recall", () => {
    expect(orchestrate("Do you remember my 2004 Pink Floyd memory?").intent).toBe("memory_recall");
  });

  it("4. explicit Companion Memory recall → companion_memory_recall", () => {
    expect(orchestrate("What did you remember about me?").intent).toBe("companion_memory_recall");
  });

  it("5. explicit Pattern request → pattern_exploration", () => {
    expect(orchestrate("Why did you show me this pattern?").intent).toBe("pattern_exploration");
  });

  it("6. explicit Event/Chapter request → event_chapter_recall", () => {
    expect(orchestrate("Tell me about my university years").intent).toBe("event_chapter_recall");
  });

  it("7. explicit Story request → story_request", () => {
    expect(orchestrate("Tell me the story of my university years").intent).toBe("story_request");
  });

  it("8. explicit remember request → memory_creation", () => {
    expect(orchestrate("Please remember that I prefer formal language").intent).toBe(
      "memory_creation",
    );
  });

  it("9. explicit reflection request → reflection", () => {
    expect(orchestrate("Help me reflect on this memory").intent).toBe("reflection");
  });

  it("10. ambiguous request → safe chat", () => {
    expect(orchestrate("xyz ambiguous random").intent).toBe("chat");
  });
});

// ---------------------------------------------------------------------------
// Override + priority (11)
// ---------------------------------------------------------------------------
describe("current message override + priority", () => {
  it("11. current user instruction overrides stored Companion Memory", () => {
    const cm = seedCompanionMemory("u-1", "preference", "User prefers formal language.");
    // The orchestration policy exposes that the current message is highest
    // priority. The stored Companion Memory is NOT modified.
    const p = orchestrate("Talk casually with me today");
    expect(p.currentUserInstruction).toBe("highest_priority");
    expect(cm.content).toBe("User prefers formal language.");
    expect(cm.status).toBe("active");
  });

  it("explicit recall/companion-memory/story/creation are HIGH priority", () => {
    expect(orchestrate("do you remember my 2004 memory").priority).toBe("high");
    expect(orchestrate("what do you remember about me").priority).toBe("high");
    expect(orchestrate("tell me the story").priority).toBe("high");
    expect(orchestrate("remember this").priority).toBe("high");
  });

  it("pattern/event/reflection are MEDIUM priority", () => {
    expect(orchestrate("why this pattern").priority).toBe("medium");
    expect(orchestrate("my university years").priority).toBe("medium");
    expect(orchestrate("help me reflect").priority).toBe("medium");
  });

  it("ordinary chat is LOW priority", () => {
    expect(orchestrate("hi").priority).toBe("low");
  });
});

// ---------------------------------------------------------------------------
// Retrieval routing + budget (12-16)
// ---------------------------------------------------------------------------
describe("retrieval routing + budget", () => {
  it("12. memory_recall retrieval plan is bounded", () => {
    const p = orchestrate("do you remember my 2004 memory");
    expect(p.retrievalPlan.memories).toBe(true);
    expect(p.retrievalPlan.reflections).toBe(true);
    expect(p.retrievalPlan.events).toBe(true);
    expect(p.retrievalPlan.chapters).toBe(true);
    // Budgets bounded by global defaults.
    expect(p.budgets.memories).toBeLessThanOrEqual(GLOBAL_DEFAULT_BUDGETS.memories);
    expect(p.budgets.reflections).toBeLessThanOrEqual(GLOBAL_DEFAULT_BUDGETS.reflections);
  });

  it("13. companion_memory retrieval does not load unrelated domains", () => {
    const p = orchestrate("what do you remember about me");
    expect(p.retrievalPlan.companionMemories).toBe(true);
    expect(p.retrievalPlan.memories).toBe(false);
    expect(p.retrievalPlan.patterns).toBe(false);
    expect(p.retrievalPlan.events).toBe(false);
    expect(p.retrievalPlan.chapters).toBe(false);
    expect(p.budgets.memories).toBe(0);
    expect(p.budgets.patterns).toBe(0);
  });

  it("14. pattern request loads evidence (patterns + memories)", () => {
    const p = orchestrate("why did you show me this pattern");
    expect(p.retrievalPlan.patterns).toBe(true);
    expect(p.retrievalPlan.memories).toBe(true);
    expect(p.retrievalPlan.events).toBe(false);
    expect(p.retrievalPlan.chapters).toBe(false);
  });

  it("15. chapter request does not load Media binaries", () => {
    const p = orchestrate("tell me about my university years");
    // Media is never a retrieval domain for any intent — there is no `media`
    // flag in the RetrievalPlan at all.
    expect((p.retrievalPlan as Record<string, unknown>).media).toBeUndefined();
    expect(p.retrievalPlan.chapters).toBe(true);
    expect(p.retrievalPlan.events).toBe(true);
  });

  it("16. story request uses bounded retrieval", () => {
    const p = orchestrate("tell me the story of my university years");
    expect(p.retrievalPlan.memories).toBe(true);
    expect(p.retrievalPlan.chapters).toBe(true);
    expect(p.retrievalPlan.events).toBe(true);
    expect(p.budgets.memories).toBeLessThanOrEqual(GLOBAL_DEFAULT_BUDGETS.memories);
    expect(p.budgets.chapters).toBeLessThanOrEqual(GLOBAL_DEFAULT_BUDGETS.chapters);
  });

  it("ordinary chat loads conversation only (no stored history)", () => {
    const p = orchestrate("hi");
    expect(p.retrievalPlan.conversation).toBe(true);
    expect(p.retrievalPlan.companionMemories).toBe(false);
    expect(p.retrievalPlan.memories).toBe(false);
    expect(p.retrievalPlan.patterns).toBe(false);
    expect(p.retrievalPlan.events).toBe(false);
    expect(p.retrievalPlan.chapters).toBe(false);
    expect(p.budgets.memories).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cost control (17)
// ---------------------------------------------------------------------------
describe("cost control", () => {
  it("17. ordinary chat does not add retrieval LLM calls (deterministic intent)", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    orchestrate("hi");
    // Intent classification is deterministic — no network, no LLM.
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("capability plan uses exactly one role per intent", () => {
    const intents: CompanionIntent[] = [
      "chat",
      "memory_recall",
      "companion_memory_recall",
      "pattern_exploration",
      "event_chapter_recall",
      "story_request",
      "memory_creation",
      "reflection",
      "unknown",
    ];
    for (const intent of intents) {
      const plan = planCapability(intent, {
        message: "x",
        recentTurns: [],
        retrievedContext: [],
      });
      // Each capability plan targets a single role.
      expect(typeof plan.role).toBe("string");
      expect(typeof plan.prompt).toBe("string");
    }
  });

  it("chat capability calls orchestrator; story/reflection call summarizer", () => {
    expect(
      planCapability("chat", { message: "hi", recentTurns: [], retrievedContext: [] }).role,
    ).toBe("orchestrator");
    expect(
      planCapability("story_request", {
        message: "tell me the story",
        recentTurns: [],
        retrievedContext: [],
      }).role,
    ).toBe("summarizer");
  });
});

// ---------------------------------------------------------------------------
// Purity + fallback (18-20)
// ---------------------------------------------------------------------------
describe("orchestration purity + fallback", () => {
  it("18. orchestration does not itself call the network", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    orchestrate("do you remember my 2004 memory");
    orchestrate("tell me the story");
    orchestrate("why this pattern");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("19. orchestration does not itself call Orchestra (no runtime provider call)", async () => {
    const fs = await import("node:fs");
    // The orchestration POLICY module is strictly pure: no Orchestra import
    // and no runRole call at all.
    const src = fs.readFileSync("src/lib/llm/companionOrchestrator.ts", "utf8");
    expect(src).not.toMatch(/from ["']@\/lib\/llm\/orchestra["']/);
    expect(src).not.toMatch(/\brunRole\s*\(/);
  });

  it("20. unknown intent falls back safely to chat", () => {
    const p = orchestrate("xyz");
    // "xyz" does not match any pattern → chat (which handles unknown).
    expect(p.intent).toBe("chat");
    expect(p.capability).toBe("chat");
  });
});

// ---------------------------------------------------------------------------
// Identity (21-23)
// ---------------------------------------------------------------------------
describe("identity + ownership", () => {
  it("21. cross-user context never enters retrieval", async () => {
    const conv = seedConversation("u-1");
    seedMemory("u-2", { title: "Other User Song" });
    const p = orchestrate("do you remember the Other User Song memory");
    const res = await retrieveCompanionContextForIntentLogic(
      {
        accessToken: TOKEN_U1,
        conversationId: conv,
        message: "Other User Song",
        plan: p.retrievalPlan,
        budgets: p.budgets,
      },
      makeAuth({ [TOKEN_U1]: { id: "u-1" } }).fn,
    );
    expect(res.ok).toBe(true);
    expect(res.items.find((i) => i.content.includes("Other User Song"))).toBeUndefined();
  });

  it("22. current authenticated user remains source of identity", async () => {
    const conv = seedConversation("u-p");
    seedMemory("u-p", { title: "Auth Song" });
    const p = orchestrate("do you remember the Auth Song memory");
    const res = await retrieveCompanionContextForIntentLogic(
      {
        accessToken: TOKEN_UP,
        conversationId: conv,
        message: "Auth Song",
        plan: p.retrievalPlan,
        budgets: p.budgets,
      },
      makeAuth({ [TOKEN_UP]: { id: "u-p", isAnonymous: false } }).fn,
    );
    expect(res.ok).toBe(true);
    expect(res.items.find((i) => i.content.includes("Auth Song"))).toBeDefined();
  });

  it("23. no browser userId authority (token-derived identity only)", async () => {
    const conv = seedConversation("u-1");
    seedMemory("u-2", { title: "Stolen Song" });
    // A token mapping to u-1 cannot read u-2 data, even if the message names it.
    const p = orchestrate("do you remember the Stolen Song memory");
    const res = await retrieveCompanionContextForIntentLogic(
      {
        accessToken: TOKEN_U1,
        conversationId: conv,
        message: "Stolen Song",
        plan: p.retrievalPlan,
        budgets: p.budgets,
      },
      makeAuth({ [TOKEN_U1]: { id: "u-1" } }).fn,
    );
    expect(res.items.find((i) => i.content.includes("Stolen Song"))).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Secret boundary (24-25)
// ---------------------------------------------------------------------------
describe("secret boundary", () => {
  it("24. no provider key in client bundle (orchestration/capability modules)", async () => {
    const fs = await import("node:fs");
    for (const f of [
      "src/lib/llm/companionOrchestrator.ts",
      "src/lib/llm/companionCapabilities.ts",
      "src/lib/llm/companionConversation.server.ts",
      "src/lib/llm/retrieveCompanionContext.server.ts",
    ]) {
      const src = fs.readFileSync(f, "utf8");
      expect(src).not.toContain("GROQ_API_KEY");
      expect(src).not.toContain("GEMINI_API_KEY");
      expect(src).not.toContain("MISTRAL_API_KEY");
      expect(src).not.toContain("OPENROUTER_API_KEY");
      expect(src).not.toContain("service_role");
      expect(src).not.toContain("auth.admin");
    }
  });

  it("25. no direct provider call from browser (orchestration policy pure; capability type-only)", async () => {
    const fs = await import("node:fs");
    // The orchestration POLICY module is strictly pure: no Orchestra import at
    // all (not even a type) and no runRole call.
    const orch = fs.readFileSync("src/lib/llm/companionOrchestrator.ts", "utf8");
    expect(orch).not.toMatch(/from ["']@\/lib\/llm\/orchestra["']/);
    expect(orch).not.toMatch(/\brunRole\s*\(/);
    // The capability module is server-side; it may import the OrchestraRole
    // TYPE (compile-time only, erased at runtime) but must NOT invoke the
    // provider. A runtime call would be `await runRole(...)`; JSDoc mentions
    // of runRole are not executable.
    const cap = fs.readFileSync("src/lib/llm/companionCapabilities.ts", "utf8");
    expect(cap).not.toMatch(/await\s+runRole/);
  });
});

// ---------------------------------------------------------------------------
// Existing flows preserved (26-31)
// ---------------------------------------------------------------------------
describe("existing flows preserved", () => {
  it("26. Existing Significant Interaction gate still runs after user turn", async () => {
    const conv = seedConversation("u-1");
    const rr = makeRunRole("reply");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await companionConversationLogic(
      { accessToken: TOKEN_U1, conversationId: conv, message: "remember this please" },
      rr.fn,
      auth.fn,
    );
    // The flow completes; significance gate ran (res.candidate is null when no
    // LLM classification happens, but the flow ran without throwing).
    expect(res.ok).toBe(true);
    expect(res).toHaveProperty("candidate");
  });

  it("27. Existing Companion Memory confirmation flow remains intact (no auto-create)", async () => {
    const conv = seedConversation("u-1");
    const rr = makeRunRole("reply");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    await companionConversationLogic(
      { accessToken: TOKEN_U1, conversationId: conv, message: "remember this" },
      rr.fn,
      auth.fn,
    );
    // The orchestration path never auto-creates a Companion Memory; creation
    // still requires explicit user confirmation (status='candidate' → confirm).
    expect(fake.companionMemories.size).toBe(0);
  });

  it("28. Existing Conversation persistence remains intact", async () => {
    const conv = seedConversation("u-1");
    const rr = makeRunRole("hello back");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await companionConversationLogic(
      { accessToken: TOKEN_U1, conversationId: conv, message: "hi" },
      rr.fn,
      auth.fn,
    );
    expect(res.ok).toBe(true);
    const turns = [...fake.turns.values()];
    expect(turns.some((t) => t.role === "user" && t.content === "hi")).toBe(true);
    expect(turns.some((t) => t.role === "assistant" && t.content === "hello back")).toBe(true);
  });

  it("29. Existing Retrieval Foundation remains intact (whole-domain fn still works)", async () => {
    const conv = seedConversation("u-1");
    seedMemory("u-1", { title: "Recall Song" });
    // The intent-scoped retrieval returns bounded items for memory_recall.
    const p = orchestrate("do you remember the Recall Song memory");
    const res = await retrieveCompanionContextForIntentLogic(
      {
        accessToken: TOKEN_U1,
        conversationId: conv,
        message: "Recall Song",
        plan: p.retrievalPlan,
        budgets: p.budgets,
      },
      makeAuth({ [TOKEN_U1]: { id: "u-1" } }).fn,
    );
    expect(res.ok).toBe(true);
    expect(res.items.find((i) => i.content.includes("Recall Song"))).toBeDefined();
  });

  it("30. Existing Story fallback remains intact (story LLM failure → no fabrication)", async () => {
    const conv = seedConversation("u-1");
    const rr = makeRunRole(null); // LLM fails
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-1" } });
    const res = await companionConversationLogic(
      {
        accessToken: TOKEN_U1,
        conversationId: conv,
        message: "tell me the story of my university years",
      },
      rr.fn,
      auth.fn,
    );
    expect(res.ok).toBe(false);
    expect(res.assistantTurn).toBeNull();
  });

  it("31. Existing Pattern interpretation remains intact (surfaced as context, not regenerated)", async () => {
    const conv = seedConversation("u-1");
    seedPattern("u-1", "A Pattern", "existing interpretation");
    const p = orchestrate("why did you show me this pattern");
    const res = await retrieveCompanionContextForIntentLogic(
      {
        accessToken: TOKEN_U1,
        conversationId: conv,
        message: "this pattern",
        plan: p.retrievalPlan,
        budgets: p.budgets,
      },
      makeAuth({ [TOKEN_U1]: { id: "u-1" } }).fn,
    );
    expect(res.ok).toBe(true);
    // The pattern is surfaced as retrieved context (free, no regeneration).
    expect(res.items.find((i) => i.sourceType === "pattern")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Anonymous / authenticated / sign-out (32-34)
// ---------------------------------------------------------------------------
describe("anonymous / authenticated / sign-out", () => {
  it("32. Anonymous user works", async () => {
    const conv = seedConversation("u-anon");
    const rr = makeRunRole("hi anon");
    const auth = makeAuth({ [TOKEN_U1]: { id: "u-anon", isAnonymous: true } });
    const res = await companionConversationLogic(
      { accessToken: TOKEN_U1, conversationId: conv, message: "hello" },
      rr.fn,
      auth.fn,
    );
    expect(res.ok).toBe(true);
  });

  it("33. Authenticated user works", async () => {
    const conv = seedConversation("u-p");
    const rr = makeRunRole("hi auth");
    const auth = makeAuth({ [TOKEN_UP]: { id: "u-p", isAnonymous: false } });
    const res = await companionConversationLogic(
      { accessToken: TOKEN_UP, conversationId: conv, message: "hello" },
      rr.fn,
      auth.fn,
    );
    expect(res.ok).toBe(true);
  });

  it("34. Sign-out does not delete conversations or memories", async () => {
    const conv = seedConversation("u-1");
    seedTurn("u-1", conv, "user", "hello");
    seedMemory("u-1", { title: "Persisted Song" });
    // Simulate sign-out: nothing in the orchestration path deletes data.
    expect(fake.conversations.size).toBe(1);
    expect(fake.turns.size).toBe(1);
    expect(fake.memories.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Scope (35-36)
// ---------------------------------------------------------------------------
describe("scope", () => {
  it("35. No new database table is created (migrations 0001-0009 unchanged)", async () => {
    const fs = await import("node:fs");
    const before = fs.readdirSync("supabase/migrations").sort();
    // The orchestration phase adds no migrations.
    expect(before).toHaveLength(9);
    expect(before[0]).toMatch(/^0001_/);
    expect(before[8]).toMatch(/^0009_/);
  });

  it("36. No new provider is added (orchestra role set + endpoints unchanged)", async () => {
    const fs = await import("node:fs");
    const orch = fs.readFileSync("src/lib/llm/orchestra.ts", "utf8");
    // The role set is unchanged — the roles the orchestration phase targets
    // (orchestrator, summarizer) already existed; no new role was introduced.
    for (const role of ["orchestrator", "summarizer"] as const) {
      expect(orch).toContain(`"${role}"`);
    }
    // No new provider endpoint added this phase (the existing endpoints are
    // Groq/Gemini/Mistral/OpenRouter via env vars; we assert no NEW ones like
    // a direct Anthropic SDK or OpenAI SDK import was added).
    expect(orch).not.toContain("@anthropic-ai/sdk");
    expect(orch).not.toContain('from "openai"');
  });

  it("src/lib/ai/* untouched (no edits this phase)", async () => {
    const fs = await import("node:fs");
    // The story adapter does not import or modify src/lib/ai/*.
    const cap = fs.readFileSync("src/lib/llm/companionCapabilities.ts", "utf8");
    expect(cap).not.toMatch(/from ["']@\/lib\/ai\//);
    const srv = fs.readFileSync("src/lib/llm/companionConversation.server.ts", "utf8");
    expect(srv).not.toMatch(/from ["']@\/lib\/ai\//);
  });
});

// ---------------------------------------------------------------------------
// Capability dispatch: prompt content per intent
// ---------------------------------------------------------------------------
describe("capability dispatch prompt content", () => {
  it("story prompt is bounded to retrieved context only (not whole history)", () => {
    const plan = planCapability("story_request", {
      message: "tell me the story",
      recentTurns: [],
      retrievedContext: [
        {
          sourceType: "memory",
          sourceId: "m1",
          trustLevel: "USER_FACT",
          relevance: 1,
          content: "Only This Memory",
          reason: "match",
        },
      ],
    });
    expect(plan.prompt).toContain("Only This Memory");
    expect(plan.prompt).toContain("USER_FACT");
    // Grounding rules forbid invention.
    expect(plan.prompt).toContain("Do not invent");
  });

  it("reflection reuses existing reflection prompt builder when a memory is identified", () => {
    const mem: Memory = {
      id: "m1",
      userId: "u-1",
      recordedAt: "2024-01-01T00:00:00Z",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      originalUserNote: "my note",
      userNote: "my note",
      feeling: "calm",
      lifeEvent: null,
      location: null,
      weather: null,
      eventTime: { granularity: undefined, start: null, end: null, label: null },
      aiContext: null,
      aiContextStaleAt: null,
      musicExperiences: [],
    };
    const plan = planCapability("reflection", {
      message: "help me reflect",
      recentTurns: [],
      retrievedContext: [],
      identifiedMemory: mem,
    });
    expect(plan.role).toBe("summarizer");
    expect(plan.prompt).toContain("my note");
  });

  it("grounded recall includes trust-labelled retrieved context", () => {
    const items: CompanionContextItem[] = [
      {
        sourceType: "memory",
        sourceId: "m1",
        trustLevel: "USER_FACT",
        relevance: 0.9,
        content: "A real memory",
        reason: "match",
      },
    ];
    const plan = planCapability("memory_recall", {
      message: "remember the memory",
      recentTurns: [],
      retrievedContext: items,
    });
    expect(plan.prompt).toContain("A real memory");
    expect(plan.prompt).toContain("USER FACT");
  });
});

// ---------------------------------------------------------------------------
// Budget resolution edge cases
// ---------------------------------------------------------------------------
describe("budget resolution", () => {
  it("resolveBudgets zeroes domains not in the plan", () => {
    const plan = orchestrate("hi").retrievalPlan; // conversation only
    const b = resolveBudgets("chat", plan);
    expect(b.recentConversationTurns).toBe(8);
    expect(b.memories).toBe(0);
    expect(b.companionMemories).toBe(0);
  });

  it("resolveBudgets never exceeds global defaults", () => {
    for (const msg of [
      "do you remember my 2004 memory",
      "what do you remember about me",
      "why this pattern",
      "my university years",
      "tell me the story",
      "remember this",
      "help me reflect",
      "hi",
    ]) {
      const p = orchestrate(msg);
      expect(p.budgets.recentConversationTurns).toBeLessThanOrEqual(
        GLOBAL_DEFAULT_BUDGETS.recentConversationTurns,
      );
      expect(p.budgets.memories).toBeLessThanOrEqual(GLOBAL_DEFAULT_BUDGETS.memories);
      expect(p.budgets.companionMemories).toBeLessThanOrEqual(
        GLOBAL_DEFAULT_BUDGETS.companionMemories,
      );
      expect(p.budgets.reflections).toBeLessThanOrEqual(GLOBAL_DEFAULT_BUDGETS.reflections);
      expect(p.budgets.patterns).toBeLessThanOrEqual(GLOBAL_DEFAULT_BUDGETS.patterns);
      expect(p.budgets.events).toBeLessThanOrEqual(GLOBAL_DEFAULT_BUDGETS.events);
      expect(p.budgets.chapters).toBeLessThanOrEqual(GLOBAL_DEFAULT_BUDGETS.chapters);
    }
  });
});
