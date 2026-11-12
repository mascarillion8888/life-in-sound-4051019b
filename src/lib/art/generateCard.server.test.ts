import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

import {
  buildLorePrompt,
  generateCardLoreCore,
  persistCardCore,
  type GenerateCardInput,
} from "./generateCard.server";

const invalidateCardsCacheMock = vi.fn();
vi.mock("@/lib/supabase/cards-remote", () => ({
  invalidateCardsCache: () => invalidateCardsCacheMock(),
}));

// Fake Supabase client: auth.getUser resolves, quota count is under limit,
// insert has no error (flipped per-test via createClient's mock implementation).
// Deliberately typed by hand (not inferred) so per-test `from` reassignment is
// assignable without fighting the real SupabaseClient generics.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function branch(table: string, insertError?: unknown): any {
  if (table !== "cards") {
    return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
  }
  return {
    select: vi.fn((_cols: string, _opts?: unknown) => ({
      gte: vi.fn().mockResolvedValue({ data: null, error: null, count: 0 }),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insert: vi.fn().mockResolvedValue({ error: insertError ?? null }) as any,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeSession(insertError?: unknown): any {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    from: (table: string) => branch(table, insertError),
    storage: {
      from: vi.fn(() => ({ upload: vi.fn().mockResolvedValue({ error: null }) })),
    },
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => fakeSession()),
}));

// Access the real mocked module export (reference is fine after hoisting).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createClientAny = createClient as any;

/** Drive the mocked createClient's implementation directly. */
function mockCreate(fn: typeof fakeSession) {
  createClientAny.mockImplementation(fn);
}

// Runs after every test in this file regardless of describe block.
afterEach(() => {
  invalidateCardsCacheMock.mockReset();
});

/** Flip the cards-table insert to fail for the current test. */
export function makeInsertFail(insertError: unknown) {
  mockCreate(() => fakeSession(insertError));
}

const ENCOUNTER: GenerateCardInput = {
  trackKey: "itunes:123",
  artist: "Sting",
  songTitle: "Fragile",
  genre: "Gothic Folk",
  releaseYear: 1987,
  birthYear: 1978,
  encounterAge: 9,
  userMemory: null,
  accessToken: null,
};

describe("generateCardLoreCore", () => {
  beforeEach(() => {
    vi.stubEnv("GROQ_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("falls back to the deterministic 2-sentence lore without a provider key", async () => {
    const lore = await generateCardLoreCore(ENCOUNTER);
    const sentences = lore.split(/(?<=[.!?])\s+/).filter(Boolean);
    expect(sentences).toHaveLength(2);
  });

  it("uses the LLM snippet when the provider answers", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const llmText = "A child hums along in the lamplight. The song never leaves the room.";
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: llmText } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const lore = await generateCardLoreCore(ENCOUNTER, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(lore).toBe(llmText);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(body.messages[1].content).toContain("Fragile");
    expect(body.messages[1].content).toContain("Sting");
    expect(body.messages[1].content).toContain("age 9");
    expect(body.messages[1].content).toContain("1987");
  });

  it("rejects degenerate LLM output and falls back", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const lore = await generateCardLoreCore(ENCOUNTER, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(lore).not.toBe("ok");
    expect(lore.length).toBeGreaterThan(40);
  });

  it("falls back when the provider call fails", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const lore = await generateCardLoreCore(ENCOUNTER, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(lore.length).toBeGreaterThan(40);
  });

  it("falls through OpenRouter -> Groq when the OpenRouter call times out", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    vi.stubEnv("GROQ_API_KEY", "groq-key");
    vi.useFakeTimers();

    const groqText = "A child hums along in the lamplight. The song stays in the room.";
    const fetchImpl = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes("openrouter.ai")) {
        // Never resolves on its own; only the request timeout settles it.
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        });
      }
      return Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content: groqText } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });

    const promise = generateCardLoreCore(ENCOUNTER, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await vi.advanceTimersByTimeAsync(20_001);
    const lore = await promise;

    expect(lore).toBe(groqText);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("openrouter.ai");
    expect(String(fetchImpl.mock.calls[1][0])).toContain("groq.com");

    vi.useRealTimers();
  });
});

describe("persistCardCore", () => {
  const VPREV = new Map<string, string | undefined>([
    ["VITE_SUPABASE_URL", process.env.VITE_SUPABASE_URL],
    ["VITE_SUPABASE_ANON_KEY", process.env.VITE_SUPABASE_ANON_KEY],
  ]);
  // These tests are about configuration logic, not the ambient machine env.
  // Pin the process env DELETED for the whole suite so a developer laptop
  // with real Supabase creds cannot flip "skips silently without env config".
  beforeEach(() => {
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    // Ensure createClient keeps its fake-session implementation even after
    // the shared afterEach's restoreAllMocks().
    mockCreate(() => fakeSession());
  });
  afterEach(() => {
    for (const [k, v] of VPREV) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  it("skips silently without an access token", async () => {
    const ok = await persistCardCore(ENCOUNTER, "lore", "gothic", null, {
      supabaseUrl: "https://example.supabase.co",
      anonKey: "anon",
    });
    expect(ok).toBe(false);
  });

  it("skips silently without Supabase env config", async () => {
    const ok = await persistCardCore(
      { ...ENCOUNTER, accessToken: "token" },
      "lore",
      "gothic",
      null,
      { supabaseUrl: undefined, anonKey: undefined },
    );
    expect(ok).toBe(false);
  });

  it("invalidates the card list cache after a successful insert", async () => {
    const ok = await persistCardCore(
      { ...ENCOUNTER, accessToken: "token" },
      "lore",
      "gothic",
      "data:image/png;base64,AA==",
      { supabaseUrl: "https://example.supabase.co", anonKey: "anon" },
    );
    expect(ok).toBe(true);
    expect(invalidateCardsCacheMock).toHaveBeenCalledTimes(1);
  });

  it("does not invalidate the cache when the insert fails", async () => {
    makeInsertFail(new Error("constraint violation"));

    const ok = await persistCardCore(
      { ...ENCOUNTER, accessToken: "token" },
      "lore",
      "gothic",
      null,
      { supabaseUrl: "https://example.supabase.co", anonKey: "anon" },
    );
    expect(ok).toBe(false);
    expect(invalidateCardsCacheMock).not.toHaveBeenCalled();
  });
});

describe("buildLorePrompt", () => {
  it("carries the tanı-yasağı (non-diagnostic) + anti-cliché identity rules", () => {
    const prompt = buildLorePrompt({
      artist: "Sting",
      songTitle: "Fragile",
      encounterAge: 9,
    });
    expect(prompt).toContain("never diagnose, label, or pathologize");
    expect(prompt).toContain("not a clinical case");
    expect(prompt).toContain("never a generic fortune-cookie compliment");
  });

  it("weaves an optional personal memory into the snippet", () => {
    const prompt = buildLorePrompt({
      artist: "Sting",
      songTitle: "Fragile",
      encounterAge: 9,
      userMemory: "rain on the window that summer",
    });
    expect(prompt).toContain(
      "Honour this personal memory from the listener: rain on the window that summer",
    );
  });

  it("adds the discovered-later hint only when the flag is true", () => {
    const withHint = buildLorePrompt({
      artist: "Sting",
      songTitle: "Fragile",
      encounterAge: 15,
      discoveredLater: true,
    });
    expect(withHint).toContain("older song the listener met later in life");

    const withoutHint = buildLorePrompt({
      artist: "Sting",
      songTitle: "Fragile",
      encounterAge: 15,
      discoveredLater: false,
    });
    expect(withoutHint).not.toContain("older song the listener met later in life");
  });
});
