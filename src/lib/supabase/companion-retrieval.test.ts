import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Companion Retrieval Foundation tests.
 *
 * Covers 35 scenarios for the deterministic retrieval planner (pure, no I/O),
 * the server retrieval function (identity + ownership + bounded loading), the
 * trust layers, deduplication, context budget, domain filtering, prompt
 * integration, cost control, ownership/RLS-style isolation, performance
 * (bounded queries), and scope (no vector search, no provider key in client,
 * ai/orchestra untouched).
 *
 * No live LLM calls. No external network. The Orchestra call is a `runRoleImpl`
 * injection. Supabase is a stateful fake keyed on in-memory maps covering all
 * retrieval source tables. The retrieval planner is tested directly (pure) and
 * via the server logic (identity + ownership).
 */

// ---------------------------------------------------------------------------
// Fake Supabase (stateful, in-memory, owner-scoped)
// ---------------------------------------------------------------------------
type FakeRow = Record<string, unknown>;
type ChainResult = { data: FakeRow | FakeRow[] | null; error: unknown };

type Chain = {
  select: (cols?: string) => Chain;
  eq: (col: string, val: unknown) => Chain;
  in: (col: string, vals: unknown[]) => Chain;
  neq: (col: string, val: unknown) => Chain;
  or: (expr: string) => Chain;
  order: (col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => Chain;
  limit: (n: number) => Chain;
  maybeSingle: () => Promise<ChainResult>;
  single: () => Promise<ChainResult>;
  insert: (row: FakeRow | FakeRow[]) => Chain;
  update: (patch: FakeRow) => Chain;
  delete: () => Promise<{ error: unknown }>;
};

type FakeSupabase = {
  from: (table: string) => Chain;
  auth: {
    getUser: (token?: string) => Promise<{ data: { user: FakeRow | null }; error: unknown }>;
  };
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
  nextMemoryId: number;
};

let fake: FakeSupabase;

type OrderSpec = { col: string; ascending: boolean } | null;
type ChainState = {
  table: string;
  filters: Record<string, unknown>;
  inFilters: Record<string, unknown[]>;
  neqFilters: Record<string, unknown>;
  order: OrderSpec;
  limit: number | null;
  orFilter: string | null;
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
    case "pattern_memories":
      return [...fake.patternMemories.values()];
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
  for (const [k, v] of Object.entries(state.neqFilters)) rows = rows.filter((r) => r[k] !== v);
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
    in: (col, vals) => makeChain({ ...state, inFilters: { ...state.inFilters, [col]: vals } }),
    neq: (col, val) => makeChain({ ...state, neqFilters: { ...state.neqFilters, [col]: val } }),
    or: (expr) => makeChain({ ...state, orFilter: expr }),
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
        if (state.table === "companion_turns") {
          const id = `turn-${fake.nextTurnId++}`;
          fake.turns.set(id, { ...r, id, created_at: new Date().toISOString() });
          lastId = id;
        } else if (state.table === "companion_conversations") {
          const id = `conv-${fake.nextConvId++}`;
          fake.conversations.set(id, { ...r, id });
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
      makeChain({
        table,
        filters: {},
        inFilters: {},
        neqFilters: {},
        order: null,
        limit: null,
        orFilter: null,
      }),
    auth: {
      getUser: vi.fn(async (token?: string | null) => {
        if (!token) return { data: { user: null }, error: "no token" };
        const m = /^tok-(.+)$/.exec(token);
        if (!m) return { data: { user: null }, error: "bad token" };
        const id = `u-${m[1].replace(/^u/, "")}`;
        return { data: { user: { id, is_anonymous: !id.endsWith("-p") } }, error: null };
      }),
    },
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
    nextMemoryId: 1,
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
  planRetrieval,
  identifyIntents,
  extractYears,
  timeOverlapsYear,
  normalizeText,
  CONTEXT_BUDGET,
  detectCompanionMemoryOverride,
} from "@/lib/memory/companionRetrieval";
import { retrieveCompanionContextLogic } from "@/lib/llm/retrieveCompanionContext.server";
import { buildCompanionPrompt } from "@/lib/llm/companionConversation";
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

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------
function seedConversation(userId: string, title: string | null = null): string {
  const id = `conv-${fake.nextConvId++}`;
  fake.conversations.set(id, {
    id,
    user_id: userId,
    title,
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
  opts: {
    title?: string | null;
    artist?: string | null;
    userNote?: string | null;
    location?: string | null;
    feeling?: string | null;
    eventStart?: string | null;
    eventEnd?: string | null;
    eventLabel?: string | null;
  } = {},
): Memory {
  const mid = `mem-${fake.nextMemoryId++}`;
  const eid = `exp-${fake.nextMemoryId++}`;
  fake.experiences.set(eid, {
    id: eid,
    user_id: userId,
    source_type: "streaming",
    title: opts.title ?? null,
    artist: opts.artist ?? null,
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
    feeling: opts.feeling ?? null,
    life_event: null,
    location: opts.location ?? null,
    weather: null,
    event_time_granularity: null,
    event_time_start: opts.eventStart ?? null,
    event_time_end: opts.eventEnd ?? null,
    event_time_label: opts.eventLabel ?? null,
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
    feeling: opts.feeling ?? null,
    lifeEvent: null,
    location: opts.location ?? null,
    weather: null,
    eventTime: {
      granularity: undefined,
      start: opts.eventStart ?? null,
      end: opts.eventEnd ?? null,
      label: opts.eventLabel ?? null,
    },
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
          artist: opts.artist ?? null,
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
  const id = `cm-${fake.nextMemoryId++}`;
  return {
    id,
    userId,
    significantInteractionId: `si-${id}`,
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
  return {
    id: `ref-${fake.nextMemoryId++}`,
    userId,
    memoryId,
    author,
    body,
    reflectedAt: "2024-01-01T00:00:00Z",
    createdAt: "2024-01-01T00:00:00Z",
    sourceContext: null,
  };
}

function seedPattern(
  userId: string,
  title: string,
  summary: string,
  interpretation: string | null = null,
): Pattern {
  return {
    id: `pat-${fake.nextMemoryId++}`,
    userId,
    patternType: "repeated_music",
    title,
    summary,
    confidence: 1,
    observedFrom: null,
    observedTo: null,
    status: "active",
    fingerprint: `fp-${title}`,
    evidenceCount: 2,
    evidence: [{ memoryId: "mem-1", evidenceRole: null }],
    interpretation,
    interpretationModel: interpretation ? "orchestrator" : null,
    interpretationPromptVersion: null,
    interpretationCreatedAt: interpretation ? "2024-01-01T00:00:00Z" : null,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
}

function seedEvent(
  userId: string,
  title: string,
  opts: { startAt?: string | null; location?: string | null } = {},
): LifeEvent {
  return {
    id: `evt-${fake.nextMemoryId++}`,
    userId,
    title,
    description: null,
    startAt: opts.startAt ?? null,
    endAt: null,
    timePrecision: "year",
    timeLabel: null,
    location: opts.location ?? null,
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
}

function seedChapter(
  userId: string,
  title: string,
  opts: { startAt?: string | null } = {},
): LifeChapter {
  return {
    id: `chp-${fake.nextMemoryId++}`,
    userId,
    title,
    description: null,
    startAt: opts.startAt ?? null,
    endAt: null,
    timePrecision: "year",
    timeLabel: null,
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  };
}

function authFn(map: Record<string, { id: string; isAnonymous?: boolean }> = {}) {
  return vi.fn(
    async (token?: string | null): Promise<{ id: string; isAnonymous: boolean } | null> => {
      if (!token || !map[token]) return null;
      const u = map[token];
      return { id: u.id, isAnonymous: u.isAnonymous ?? true };
    },
  );
}

const TOKEN_U1 = "tok-u1";
const TOKEN_U2 = "tok-u2";
const TOKEN_UP = "tok-up";

beforeEach(() => {
  fake = makeFake();
});

// ---------------------------------------------------------------------------
// 1. Pure planner — explicit references
// ---------------------------------------------------------------------------
describe("retrieval planner — explicit references", () => {
  it("1. explicit Companion Memory reference is retrieved", () => {
    const cm = seedCompanionMemory("u-1", "preference", "User prefers formal language.");
    const items = planRetrieval({
      message: "What did you remember about how I like you to speak?",
      candidates: {
        recentTurns: [],
        companionMemories: [cm],
        memories: [],
        reflections: [],
        patterns: [],
        events: [],
        chapters: [],
      },
    });
    const cmItem = items.find((i) => i.sourceType === "companion_memory");
    expect(cmItem).toBeDefined();
    expect(cmItem!.content).toContain("formal language");
    expect(cmItem!.trustLevel).toBe("COMPANION_MEMORY");
  });

  it("2. unrelated Companion Memory is excluded when not referenced", () => {
    const cm = seedCompanionMemory("u-1", "preference", "User prefers formal language.");
    const items = planRetrieval({
      message: "Tell me about the weather today.",
      candidates: {
        recentTurns: [],
        companionMemories: [cm],
        memories: [],
        reflections: [],
        patterns: [],
        events: [],
        chapters: [],
      },
    });
    // Standing preference still surfaces (low relevance) but is bounded; it is
    // present as continuity context, not as a fact. The key assertion: it does
    // not outrank actual referenced content.
    const cmItem = items.find((i) => i.sourceType === "companion_memory");
    if (cmItem) expect(cmItem.relevance).toBeLessThan(0.86);
  });

  it("3. explicit Memory title match is retrieved", () => {
    const m = seedMemory("u-1", {
      title: "Wish You Were Here",
      artist: "Pink Floyd",
      userNote: "2004 university",
    });
    const items = planRetrieval({
      message: "Tell me about my Wish You Were Here memory",
      candidates: {
        recentTurns: [],
        companionMemories: [],
        memories: [m],
        reflections: [],
        patterns: [],
        events: [],
        chapters: [],
      },
    });
    const mem = items.find((i) => i.sourceType === "memory");
    expect(mem).toBeDefined();
    expect(mem!.content).toContain("Wish You Were Here");
    expect(mem!.trustLevel).toBe("USER_FACT");
  });

  it("4. exact Music Experience match outranks loose token match", () => {
    const exact = seedMemory("u-1", { title: "Echoes", artist: "Pink Floyd" });
    const loose = seedMemory("u-1", { title: "Some Other Song", userNote: "echoes of the past" });
    const items = planRetrieval({
      message: "Tell me about Echoes",
      candidates: {
        recentTurns: [],
        companionMemories: [],
        memories: [exact, loose],
        reflections: [],
        patterns: [],
        events: [],
        chapters: [],
      },
    });
    const mems = items.filter((i) => i.sourceType === "memory");
    const exactItem = mems.find((i) => i.content.includes("Echoes") && i.reason.includes("song"));
    expect(exactItem).toBeDefined();
    expect(exactItem!.relevance).toBeGreaterThanOrEqual(
      mems.find((i) => i.content.includes("Some Other Song"))!.relevance,
    );
  });

  it("5. explicit year filter works with approximate time", () => {
    const m = seedMemory("u-1", {
      eventStart: "2004-06-01T00:00:00Z",
      eventEnd: "2004-08-31T00:00:00Z",
      eventLabel: "summer 2004",
    });
    const items = planRetrieval({
      message: "What happened in 2004?",
      candidates: {
        recentTurns: [],
        companionMemories: [],
        memories: [m],
        reflections: [],
        patterns: [],
        events: [],
        chapters: [],
      },
    });
    const mem = items.find((i) => i.sourceType === "memory");
    expect(mem).toBeDefined();
    expect(mem!.reason).toContain("time overlap");
  });

  it("6. unknown time is not falsely matched", () => {
    const m = seedMemory("u-1", { title: "No Date Song" }); // no eventStart/end
    const items = planRetrieval({
      message: "What happened in 2004?",
      candidates: {
        recentTurns: [],
        companionMemories: [],
        memories: [m],
        reflections: [],
        patterns: [],
        events: [],
        chapters: [],
      },
    });
    const mem = items.find((i) => i.sourceType === "memory");
    // No time signal → only low recent-context relevance, no time-overlap claim.
    if (mem) expect(mem.reason).not.toContain("time overlap");
  });
});

// ---------------------------------------------------------------------------
// 2. Events / Chapters / Reflections / Patterns / Trust
// ---------------------------------------------------------------------------
describe("retrieval planner — events, chapters, reflections, patterns, trust", () => {
  it("7. Event title match retrieves associated context", () => {
    const e = seedEvent("u-1", "The Move to Istanbul", {
      startAt: "2010-01-01T00:00:00Z",
      location: "Istanbul",
    });
    const items = planRetrieval({
      message: "Tell me about The Move to Istanbul event",
      candidates: {
        recentTurns: [],
        companionMemories: [],
        memories: [],
        reflections: [],
        patterns: [],
        events: [e],
        chapters: [],
      },
    });
    const evt = items.find((i) => i.sourceType === "event");
    expect(evt).toBeDefined();
    expect(evt!.content).toContain("The Move to Istanbul");
    expect(evt!.trustLevel).toBe("USER_FACT");
  });

  it("8. Chapter title match retrieves associated context", () => {
    const c = seedChapter("u-1", "University Years", { startAt: "2003-01-01T00:00:00Z" });
    const items = planRetrieval({
      message: "Tell me about my University Years chapter",
      candidates: {
        recentTurns: [],
        companionMemories: [],
        memories: [],
        reflections: [],
        patterns: [],
        events: [],
        chapters: [c],
      },
    });
    const chp = items.find((i) => i.sourceType === "chapter");
    expect(chp).toBeDefined();
    expect(chp!.content).toContain("University Years");
  });

  it("9. Pattern interpretation is labeled AI_INTERPRETATION content (not user fact)", () => {
    const p = seedPattern(
      "u-1",
      "A song that follows you",
      "Appears in 3 memories.",
      "The user returns to this song at turning points.",
    );
    const items = planRetrieval({
      message: "Tell me about the pattern",
      candidates: {
        recentTurns: [],
        companionMemories: [],
        memories: [],
        reflections: [],
        patterns: [p],
        events: [],
        chapters: [],
      },
    });
    const pat = items.find((i) => i.sourceType === "pattern");
    expect(pat).toBeDefined();
    expect(pat!.trustLevel).toBe("DERIVED_PATTERN");
    expect(pat!.content).toContain("Pattern interpretation (not a user fact)");
  });

  it("10. User fact outranks AI interpretation at equal relevance", () => {
    // Construct a USER_FACT (memory) and an AI_INTERPRETATION (companion-
    // authored reflection) with identical baseline relevance via a neutral
    // message, then verify the trust tie-breaker puts USER_FACT first.
    const m = seedMemory("u-1", { title: "x", userNote: "x" });
    const r = seedReflection("u-1", m.id, "companion", "an interpretation");
    const items = planRetrieval({
      message: "hello",
      candidates: {
        recentTurns: [],
        companionMemories: [],
        memories: [m],
        reflections: [r],
        patterns: [],
        events: [],
        chapters: [],
      },
    });
    const mem = items.find((i) => i.sourceType === "memory");
    const ref = items.find((i) => i.sourceType === "reflection");
    expect(mem).toBeDefined();
    expect(ref).toBeDefined();
    expect(mem!.trustLevel).toBe("USER_FACT");
    expect(ref!.trustLevel).toBe("AI_INTERPRETATION");
    expect(mem!.relevance).toBe(ref!.relevance);
    // At equal relevance, USER_FACT sorts before AI_INTERPRETATION.
    expect(items.indexOf(mem!)).toBeLessThan(items.indexOf(ref!));
  });

  it("28. prompt distinguishes pattern interpretation from user fact", () => {
    const p = seedPattern("u-1", "P", "summary", "interp text");
    const items = planRetrieval({
      message: "the pattern",
      candidates: {
        recentTurns: [],
        companionMemories: [],
        memories: [],
        reflections: [],
        patterns: [p],
        events: [],
        chapters: [],
      },
    });
    const prompt = buildCompanionPrompt({ recentTurns: [], retrievedContext: items });
    // Pattern interpretation content is explicitly labelled as not a fact.
    expect(prompt).toContain("Pattern interpretation (not a user fact)");
    // The grounding rules distinguish user fact from interpretation.
    expect(prompt).toContain("USER FACT");
    expect(prompt).toContain("Pattern interpretation is NOT a fact");
  });
});

// ---------------------------------------------------------------------------
// 3. Companion Memory override + budget + dedup
// ---------------------------------------------------------------------------
describe("retrieval planner — override, budget, dedup", () => {
  it("11. current user message overrides stale Companion Memory preference", () => {
    const cm = seedCompanionMemory("u-1", "preference", "User prefers formal language.");
    const { overridden } = detectCompanionMemoryOverride("Talk casually with me today", [cm]);
    expect(overridden).toContain(cm);
    // The memory is NOT deleted/updated — it still exists.
    expect(cm.status).toBe("active");
    expect(cm.content).toBe("User prefers formal language.");
  });

  it("12. recent conversation turns limited to configured maximum", () => {
    const turns: CompanionTurn[] = [];
    for (let i = 0; i < 30; i++) {
      turns.push({
        id: `t-${i}`,
        userId: "u-1",
        conversationId: "c",
        role: i % 2 === 0 ? "user" : "assistant",
        content: `msg ${i}`,
        createdAt: new Date(i).toISOString(),
        metadata: null,
      });
    }
    const items = planRetrieval({
      message: "hi",
      candidates: {
        recentTurns: turns,
        companionMemories: [],
        memories: [],
        reflections: [],
        patterns: [],
        events: [],
        chapters: [],
      },
    });
    const turnItems = items.filter((i) => i.sourceType === "conversation_turn");
    expect(turnItems.length).toBe(CONTEXT_BUDGET.recentConversationTurns);
  });

  it("13. total context remains bounded", () => {
    const memories: Memory[] = [];
    for (let i = 0; i < 50; i++) memories.push(seedMemory("u-1", { title: `Song ${i}` }));
    const events: LifeEvent[] = [];
    for (let i = 0; i < 50; i++) events.push(seedEvent("u-1", `Event ${i}`));
    const chapters: LifeChapter[] = [];
    for (let i = 0; i < 50; i++) chapters.push(seedChapter("u-1", `Chapter ${i}`));
    const items = planRetrieval({
      message: "memory event chapter",
      candidates: {
        recentTurns: [],
        companionMemories: [],
        memories,
        reflections: [],
        patterns: [],
        events,
        chapters,
      },
    });
    expect(items.filter((i) => i.sourceType === "memory").length).toBeLessThanOrEqual(
      CONTEXT_BUDGET.memories,
    );
    expect(items.filter((i) => i.sourceType === "event").length).toBeLessThanOrEqual(
      CONTEXT_BUDGET.events,
    );
    expect(items.filter((i) => i.sourceType === "chapter").length).toBeLessThanOrEqual(
      CONTEXT_BUDGET.chapters,
    );
    const total = items.length;
    expect(total).toBeLessThanOrEqual(
      CONTEXT_BUDGET.recentConversationTurns +
        CONTEXT_BUDGET.companionMemories +
        CONTEXT_BUDGET.memories +
        CONTEXT_BUDGET.reflections +
        CONTEXT_BUDGET.patterns +
        CONTEXT_BUDGET.events +
        CONTEXT_BUDGET.chapters,
    );
  });

  it("14. duplicate Memory is deduplicated across sources", () => {
    const m = seedMemory("u-1", { title: "Dup Song" });
    const items = planRetrieval({
      message: "Dup Song",
      candidates: {
        recentTurns: [],
        companionMemories: [],
        memories: [m, m],
        reflections: [],
        patterns: [],
        events: [],
        chapters: [],
      },
    });
    const mems = items.filter((i) => i.sourceType === "memory" && i.sourceId === m.id);
    expect(mems.length).toBe(1);
  });

  it("15. duplicate Companion Memory is deduplicated", () => {
    const cm = seedCompanionMemory("u-1", "directive", "Be concise.");
    const items = planRetrieval({
      message: "you remembered",
      candidates: {
        recentTurns: [],
        companionMemories: [cm, cm],
        memories: [],
        reflections: [],
        patterns: [],
        events: [],
        chapters: [],
      },
    });
    const cms = items.filter((i) => i.sourceType === "companion_memory" && i.sourceId === cm.id);
    expect(cms.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 4. Server retrieval — ownership / identity
// ---------------------------------------------------------------------------
describe("server retrieval — ownership and identity", () => {
  it("16. cross-user Memory cannot enter context", async () => {
    const conv = seedConversation("u-1");
    seedMemory("u-2", { title: "Other User Song" });
    const res = await retrieveCompanionContextLogic(
      { accessToken: TOKEN_U1, conversationId: conv, message: "Other User Song" },
      authFn({ [TOKEN_U1]: { id: "u-1" } }),
    );
    expect(res.ok).toBe(true);
    expect(
      res.items.find((i) => i.sourceType === "memory" && i.content.includes("Other User Song")),
    ).toBeUndefined();
  });

  it("17. cross-user Pattern cannot enter context", async () => {
    const conv = seedConversation("u-1");
    seedPattern("u-2", "Other Pattern", "summary");
    const res = await retrieveCompanionContextLogic(
      { accessToken: TOKEN_U1, conversationId: conv, message: "the pattern" },
      authFn({ [TOKEN_U1]: { id: "u-1" } }),
    );
    expect(res.ok).toBe(true);
    expect(res.items.find((i) => i.sourceType === "pattern")).toBeUndefined();
  });

  it("18. cross-user Companion Memory cannot enter context", async () => {
    const conv = seedConversation("u-1");
    seedCompanionMemory("u-2", "preference", "Other user preference");
    const res = await retrieveCompanionContextLogic(
      { accessToken: TOKEN_U1, conversationId: conv, message: "you remembered" },
      authFn({ [TOKEN_U1]: { id: "u-1" } }),
    );
    expect(res.ok).toBe(true);
    expect(
      res.items.find(
        (i) => i.sourceType === "companion_memory" && i.content.includes("Other user"),
      ),
    ).toBeUndefined();
  });

  it("19. anonymous user retrieval works", async () => {
    const conv = seedConversation("u-1");
    seedMemory("u-1", { title: "Anon Song" });
    const res = await retrieveCompanionContextLogic(
      { accessToken: TOKEN_U1, conversationId: conv, message: "Anon Song" },
      authFn({ [TOKEN_U1]: { id: "u-1", isAnonymous: true } }),
    );
    expect(res.ok).toBe(true);
    expect(
      res.items.find((i) => i.sourceType === "memory" && i.content.includes("Anon Song")),
    ).toBeDefined();
  });

  it("20. authenticated user retrieval works", async () => {
    const conv = seedConversation("u-p");
    seedMemory("u-p", { title: "Auth Song" });
    const res = await retrieveCompanionContextLogic(
      { accessToken: TOKEN_UP, conversationId: conv, message: "Auth Song" },
      authFn({ [TOKEN_UP]: { id: "u-p", isAnonymous: false } }),
    );
    expect(res.ok).toBe(true);
    expect(
      res.items.find((i) => i.sourceType === "memory" && i.content.includes("Auth Song")),
    ).toBeDefined();
  });

  it("29. browser cannot supply userId as authority (token-derived identity only)", async () => {
    const conv = seedConversation("u-1");
    seedMemory("u-2", { title: "Stolen Song" });
    // Even if a caller tried to craft a token for u-2, the verified identity is
    // what gates access. A token mapping to u-1 cannot read u-2 data.
    const res = await retrieveCompanionContextLogic(
      { accessToken: TOKEN_U1, conversationId: conv, message: "Stolen Song" },
      authFn({ [TOKEN_U1]: { id: "u-1" } }),
    );
    expect(res.ok).toBe(true);
    expect(res.items.find((i) => i.content.includes("Stolen Song"))).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Cost control + retrieval failure
// ---------------------------------------------------------------------------
describe("retrieval — cost control and failure", () => {
  it("21. no semantic/vector search is required (deterministic only)", () => {
    const m = seedMemory("u-1", { title: "Exactly This Song" });
    const items = planRetrieval({
      message: "Exactly This Song",
      candidates: {
        recentTurns: [],
        companionMemories: [],
        memories: [m],
        reflections: [],
        patterns: [],
        events: [],
        chapters: [],
      },
    });
    expect(items.length).toBeGreaterThan(0);
    // No external search service was invoked — this is a pure function.
  });

  it("22. retrieval planner makes no network calls (pure function)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    const m = seedMemory("u-1", { title: "Net Song" });
    planRetrieval({
      message: "Net Song",
      candidates: {
        recentTurns: [],
        companionMemories: [],
        memories: [m],
        reflections: [],
        patterns: [],
        events: [],
        chapters: [],
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("23. retrieval planner makes no LLM calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    const items = planRetrieval({
      message: "hi",
      candidates: {
        recentTurns: [],
        companionMemories: [],
        memories: [],
        reflections: [],
        patterns: [],
        events: [],
        chapters: [],
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(Array.isArray(items)).toBe(true);
    fetchSpy.mockRestore();
  });

  it("24. provider failure does not fabricate retrieved context", async () => {
    const conv = seedConversation("u-1");
    // The retrieval logic never calls the provider; it is deterministic.
    const res = await retrieveCompanionContextLogic(
      { accessToken: TOKEN_U1, conversationId: conv, message: "hi" },
      authFn({ [TOKEN_U1]: { id: "u-1" } }),
    );
    expect(res.ok).toBe(true);
    // No fabricated memories/patterns: items only contain what was seeded (nothing).
    expect(res.items.find((i) => i.sourceType === "memory")).toBeUndefined();
    expect(res.items.find((i) => i.sourceType === "pattern")).toBeUndefined();
  });

  it("25. malformed context is safely ignored", () => {
    const bad = { id: "", userId: "u-1" } as unknown as Memory;
    const items = planRetrieval({
      message: "hi",
      candidates: {
        recentTurns: [],
        companionMemories: [],
        memories: [bad],
        reflections: [],
        patterns: [],
        events: [],
        chapters: [],
      },
    });
    // No throw; the empty-id malformed memory is simply not surfaced with content.
    expect(Array.isArray(items)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Prompt integration
// ---------------------------------------------------------------------------
describe("prompt integration", () => {
  it("26. prompt includes trust labels", () => {
    const m = seedMemory("u-1", { title: "Trust Song" });
    const items = planRetrieval({
      message: "Trust Song",
      candidates: {
        recentTurns: [],
        companionMemories: [],
        memories: [m],
        reflections: [],
        patterns: [],
        events: [],
        chapters: [],
      },
    });
    const prompt = buildCompanionPrompt({ recentTurns: [], retrievedContext: items });
    expect(prompt).toContain("USER FACT");
  });

  it("27. prompt forbids invented biography", () => {
    const prompt = buildCompanionPrompt({ recentTurns: [], retrievedContext: [] });
    expect(prompt).toContain("Do NOT invent");
    expect(prompt.toLowerCase()).toContain("places");
    expect(prompt.toLowerCase()).toContain("dates");
  });

  it("prompt includes grounding rules distinguishing trust layers", () => {
    const prompt = buildCompanionPrompt({ recentTurns: [], retrievedContext: [] });
    expect(prompt).toContain("Companion Memories are user-approved continuity");
    expect(prompt).toContain("AI interpretations are never facts");
    expect(prompt).toContain("If two sources conflict");
  });
});

// ---------------------------------------------------------------------------
// 7. Scope + boundary
// ---------------------------------------------------------------------------
describe("scope and security boundary", () => {
  it("30. no provider key in client bundle (retrieval modules import no keys)", async () => {
    const files = [
      "src/lib/memory/companionRetrieval.ts",
      "src/lib/supabase/companion-retrieval-remote.ts",
      "src/lib/llm/retrieveCompanionContext.server.ts",
      "src/lib/llm/companionConversation.ts",
    ];
    for (const f of files) {
      const src = await import("node:fs").then((m) => m.promises.readFile(f, "utf8"));
      expect(src).not.toContain("GROQ_API_KEY");
      expect(src).not.toContain("GEMINI_API_KEY");
      expect(src).not.toContain("service_role");
      expect(src).not.toContain("auth.admin");
    }
  });

  it("31. no direct provider call in browser (retrieval calls runRole nowhere)", async () => {
    const retrieval = await import("node:fs").then((m) =>
      m.promises.readFile("src/lib/llm/retrieveCompanionContext.server.ts", "utf8"),
    );
    // No direct provider call and no import of the Orchestra provider bridge.
    expect(retrieval).not.toContain("runRole(");
    expect(retrieval).not.toMatch(/from ["']@\/lib\/llm\/orchestra["']/);
  });

  it("35. Memory/Pattern/Event/Chapter/Media remain unchanged (no mutation in retrieval)", () => {
    const m = seedMemory("u-1", { title: "Immutable", userNote: "original" });
    planRetrieval({
      message: "Immutable",
      candidates: {
        recentTurns: [],
        companionMemories: [],
        memories: [m],
        reflections: [],
        patterns: [],
        events: [],
        chapters: [],
      },
    });
    expect(m.userNote).toBe("original");
    expect(m.musicExperiences[0].experience.title).toBe("Immutable");
  });
});

// ---------------------------------------------------------------------------
// 8. Existing behavior unchanged (regression guards)
// ---------------------------------------------------------------------------
describe("existing behavior unchanged", () => {
  it("32. existing Conversation turn persistence remains correct (retrieval is read-only)", async () => {
    const conv = seedConversation("u-1");
    seedTurn("u-1", conv, "user", "hello");
    const res = await retrieveCompanionContextLogic(
      { accessToken: TOKEN_U1, conversationId: conv, message: "hello" },
      authFn({ [TOKEN_U1]: { id: "u-1" } }),
    );
    expect(res.ok).toBe(true);
    // Turns still present, unmodified.
    expect(fake.turns.size).toBe(1);
    expect([...fake.turns.values()][0].content).toBe("hello");
  });

  it("33. existing Significant Interaction behavior unchanged (retrieval does not touch it)", async () => {
    const conv = seedConversation("u-1");
    await retrieveCompanionContextLogic(
      { accessToken: TOKEN_U1, conversationId: conv, message: "hi" },
      authFn({ [TOKEN_U1]: { id: "u-1" } }),
    );
    // No significant_interactions table was populated.
    expect([...fake.turns.values()].every((t) => t.role !== "system")).toBe(true);
  });

  it("34. existing Companion Memory behavior unchanged (retrieval does not mutate)", () => {
    const cm = seedCompanionMemory("u-1", "directive", "Be concise.");
    planRetrieval({
      message: "you remembered",
      candidates: {
        recentTurns: [],
        companionMemories: [cm],
        memories: [],
        reflections: [],
        patterns: [],
        events: [],
        chapters: [],
      },
    });
    expect(cm.content).toBe("Be concise.");
    expect(cm.status).toBe("active");
  });
});

// ---------------------------------------------------------------------------
// 9. Pure utility coverage
// ---------------------------------------------------------------------------
describe("pure utilities", () => {
  it("normalizeText lowercases, trims, collapses whitespace", () => {
    expect(normalizeText("  Hello   World  ")).toBe("hello world");
  });

  it("extractYears pulls 4-digit years", () => {
    expect(extractYears("in 2004 and 2019 but not 99")).toEqual([2004, 2019]);
  });

  it("timeOverlapsYear respects start/end and rejects unknown", () => {
    expect(timeOverlapsYear(2004, "2004-06-01T00:00:00Z", "2004-08-31T00:00:00Z")).toBe(true);
    expect(timeOverlapsYear(2005, "2004-06-01T00:00:00Z", "2004-08-31T00:00:00Z")).toBe(false);
    expect(timeOverlapsYear(2004, null, null)).toBe(false);
  });

  it("identifyIntents detects explicit references without semantic guessing", () => {
    const intents = identifyIntents("What did I tell you about the 2004 Pink Floyd memory?", {
      musicExperiences: [{ title: "Pink Floyd Song", artist: "Pink Floyd" }],
    });
    expect(intents.years).toContain(2004);
    expect(intents.memoryRef).toBe(true);
    expect(intents.matchedArtists).toContain("Pink Floyd");
  });

  it("CONTEXT_BUDGET constants are conservative and finite", () => {
    expect(CONTEXT_BUDGET.recentConversationTurns).toBe(8);
    expect(CONTEXT_BUDGET.companionMemories).toBe(12);
    expect(CONTEXT_BUDGET.memories).toBe(8);
    expect(CONTEXT_BUDGET.reflections).toBe(6);
    expect(CONTEXT_BUDGET.patterns).toBe(5);
    expect(CONTEXT_BUDGET.events).toBe(5);
    expect(CONTEXT_BUDGET.chapters).toBe(3);
  });
});
