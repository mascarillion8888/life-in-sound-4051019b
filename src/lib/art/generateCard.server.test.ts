import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

import {
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
  const cardsBranch = branch("cards", insertError);
  const storageBranch = { upload: vi.fn().mockResolvedValue({ error: null }) };
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }) },
    from: (table: string) => (table === "cards" ? cardsBranch : branch(table, insertError)),
    storage: { from: vi.fn(() => storageBranch) },
  };
}

type InsertRow = {
  id: string;
  user_id: string;
  track_key: string;
  title: string;
  artist: string;
  genre: string | null;
  release_year: number | null;
  birth_year: number | null;
  encounter_age: number | null;
  user_memory: string | null;
  scene: string;
  lore: string;
  image_path: string | null;
  image_url?: unknown;
};

/** Capture the cards.insert row — the single shared cards-branch insert mock. */
function lastInsertRow(): InsertRow | undefined {
  const session = createClientAny.mock.results.at(-1)?.value;
  const cardsBranch = session?.from?.("cards");
  return cardsBranch?.insert?.mock.calls.at(-1)?.[0] as InsertRow | undefined;
}
function storageUploadCalls(): { path: string; contentType: string }[] {
  const session = createClientAny.mock.results.at(-1)?.value;
  const upload = session?.storage?.from?.().upload;
  if (!upload) return [];
  return (upload.mock.calls as unknown as [string, unknown, { contentType?: string }][]).map(
    ([path, , options]) => ({
      path,
      contentType: options?.contentType ?? "",
    }),
  );
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

  it("persists the generated painting path (no external album URL) on success", async () => {
    const ok = await persistCardCore(
      { ...ENCOUNTER, accessToken: "token" },
      "lore",
      "gothic",
      "data:image/png;base64,AA==",
      { supabaseUrl: "https://example.supabase.co", anonKey: "anon" },
    );
    expect(ok).toBe(true);
    const row = lastInsertRow();
    expect(row).toBeDefined();
    // The freshly generated painting lands in the private bucket as
    // "<user_id>/<uuid>.png" — never a provider album-art URL.
    expect(row!.image_path).toMatch(/^user-1\/[0-9a-f-]{36}\.png$/);
    const uploads = storageUploadCalls();
    expect(uploads).toHaveLength(1);
    expect(uploads[0].contentType).toBe("image/png");
    expect(row!.image_path).toBe(uploads[0].path);
    expect(String(row!.image_path)).not.toContain("http");
  });

  it("stores image_path null when no painting was generated (never a cover URL)", async () => {
    const ok = await persistCardCore(
      { ...ENCOUNTER, accessToken: "token" },
      "lore",
      "gothic",
      null,
      { supabaseUrl: "https://example.supabase.co", anonKey: "anon" },
    );
    expect(ok).toBe(true);
    expect(lastInsertRow()?.image_path).toBeNull();
    expect(storageUploadCalls()).toHaveLength(0);
  });

  it("refuses an album-art HTTP URL as the painting (image_path stays null)", async () => {
    // A provider cover leaking into `image` (e.g. a Spotify/iTunes artwork
    // URL) must never be written to the DB — the card face keeps the gothic
    // placeholder instead of a stuck album photo.
    const ok = await persistCardCore(
      { ...ENCOUNTER, accessToken: "token" },
      "lore",
      "gothic",
      "https://example.com/album/michael-jackson-cover.jpg",
      { supabaseUrl: "https://example.supabase.co", anonKey: "anon" },
    );
    expect(ok).toBe(true);
    expect(lastInsertRow()?.image_path).toBeNull();
    expect(lastInsertRow()?.image_url).toBeUndefined();
    expect(storageUploadCalls()).toHaveLength(0);
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
