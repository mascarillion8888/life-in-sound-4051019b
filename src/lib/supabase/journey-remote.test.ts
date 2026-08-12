import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JourneyProgress } from "../journey-storage";

/**
 * Tests exercise the remote persistence layer's contract:
 *   - load reconciles server + local and writes the merged result back to local
 *   - save writes local first, then upserts to the server
 *   - clear deletes server + local
 *   - when Supabase is unavailable, everything degrades to localStorage
 *   - network/permission failures never throw — local cache is the fallback
 *
 * We stub the Supabase client returned by getSupabase() (our own module), so
 * these are real code-path tests of journey-remote.ts, not of the Supabase SDK.
 */

type Chain = {
  select: (cols: string) => Chain;
  eq: (col: string, val: unknown) => Chain;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  upsert: (row: unknown, opts?: { onConflict?: string }) => Promise<void>;
  delete: () => { eq: (col: string, val: unknown) => Promise<void> };
};

type FakeSupabase = {
  from: (table: string) => Chain;
  calls: string[];
};

function makeFakeSupabase(opts: {
  existing?: JourneyProgress | null;
  error?: unknown;
  throwOnFrom?: boolean;
}): FakeSupabase {
  const calls: string[] = [];
  const { existing, error, throwOnFrom } = opts;
  const fake: FakeSupabase = {
    calls,
    from: (table) => {
      calls.push(`from:${table}`);
      if (throwOnFrom) throw new Error("network down");
      const chain: Chain = {
        select: (cols) => {
          calls.push(`select:${cols}`);
          return chain;
        },
        eq: (col, val) => {
          calls.push(`eq:${col}:${String(val)}`);
          return chain;
        },
        maybeSingle: async () => {
          calls.push("maybeSingle");
          if (error) return { data: null, error };
          return {
            data: existing ? { current: existing.current, answers: existing.answers } : null,
            error: null,
          };
        },
        upsert: async (row, o) => {
          calls.push(`upsert:${JSON.stringify(row)}:${o?.onConflict ?? ""}`);
        },
        delete: () => ({
          eq: async (col, val) => {
            calls.push(`delete:eq:${col}:${String(val)}`);
          },
        }),
      };
      return chain;
    },
  };
  return fake;
}

// Module-level holder so a single top-level vi.mock factory can serve a
// different fake per test without doMock/dynamic-import timing issues.
let currentFake: FakeSupabase | null = null;
function setFake(fake: FakeSupabase | null) {
  currentFake = fake;
}

vi.mock("./client", () => ({
  getSupabase: () => currentFake,
}));

// Import after the mock is registered so journey-remote sees the stub.
import { clearRemoteJourney, loadRemoteJourney, saveRemoteJourney } from "./journey-remote";

describe("loadRemoteJourney", () => {
  beforeEach(() => {
    localStorage.clear();
    setFake(null);
  });

  it("reconciles server copy with local cache, keeping the fuller one", async () => {
    localStorage.setItem(
      "soundmap.journey.v1",
      JSON.stringify({ current: 1, answers: { 1: "local" } }),
    );
    const fake = makeFakeSupabase({
      existing: { current: 3, answers: { 1: "remote", 2: "remote2" } },
    });
    setFake(fake);

    const result = await loadRemoteJourney("user-1");

    expect(result).toEqual({
      current: 3,
      answers: { 1: "remote", 2: "remote2" },
    });
    // merged winner is cached locally
    const cached = JSON.parse(localStorage.getItem("soundmap.journey.v1")!);
    expect(cached.answers).toEqual({ 1: "remote", 2: "remote2" });
  });

  it("falls back to local cache on server error", async () => {
    localStorage.setItem(
      "soundmap.journey.v1",
      JSON.stringify({ current: 2, answers: { 1: "local-only" } }),
    );
    const fake = makeFakeSupabase({ error: new Error("rls denied") });
    setFake(fake);

    const result = await loadRemoteJourney("user-1");

    expect(result).toEqual({ current: 2, answers: { 1: "local-only" } });
  });

  it("returns local cache when Supabase is unavailable", async () => {
    localStorage.setItem(
      "soundmap.journey.v1",
      JSON.stringify({ current: 2, answers: { 1: "x" } }),
    );
    setFake(null);

    const result = await loadRemoteJourney("user-1");

    expect(result).toEqual({ current: 2, answers: { 1: "x" } });
  });
});

describe("saveRemoteJourney", () => {
  beforeEach(() => {
    localStorage.clear();
    setFake(null);
  });

  it("writes local first, then upserts to server with user_id", async () => {
    const fake = makeFakeSupabase({ existing: null });
    setFake(fake);

    await saveRemoteJourney("user-42", { current: 2, answers: { 1: "Song" } });

    // local written immediately
    const cached = JSON.parse(localStorage.getItem("soundmap.journey.v1")!);
    expect(cached).toEqual({ current: 2, answers: { 1: "Song" } });
    // upsert called with ownership user_id and onConflict
    expect(fake.calls.some((c) => c.startsWith("upsert:"))).toBe(true);
    expect(fake.calls.some((c) => c.includes('"user_id":"user-42"'))).toBe(true);
    expect(fake.calls.some((c) => c.endsWith(":user_id"))).toBe(true);
  });

  it("still writes local when Supabase is unavailable", async () => {
    setFake(null);

    await saveRemoteJourney("user-42", { current: 1, answers: { 1: "x" } });

    expect(localStorage.getItem("soundmap.journey.v1")).not.toBeNull();
  });

  it("does not throw on upsert failure", async () => {
    setFake(makeFakeSupabase({ existing: null, throwOnFrom: true }));

    await expect(
      saveRemoteJourney("user-42", { current: 1, answers: {} }),
    ).resolves.toBeUndefined();
    // local fallback still holds the data
    expect(localStorage.getItem("soundmap.journey.v1")).not.toBeNull();
  });
});

describe("clearRemoteJourney", () => {
  beforeEach(() => {
    localStorage.clear();
    setFake(null);
  });

  it("deletes server row and local cache", async () => {
    localStorage.setItem(
      "soundmap.journey.v1",
      JSON.stringify({ current: 2, answers: { 1: "x" } }),
    );
    const fake = makeFakeSupabase({ existing: null });
    setFake(fake);

    await clearRemoteJourney("user-9");

    expect(localStorage.getItem("soundmap.journey.v1")).toBeNull();
    expect(fake.calls.some((c) => c.startsWith("delete:eq:"))).toBe(true);
    expect(fake.calls.some((c) => c.includes("user_id:user-9"))).toBe(true);
  });

  it("clears local cache when Supabase unavailable", async () => {
    localStorage.setItem(
      "soundmap.journey.v1",
      JSON.stringify({ current: 2, answers: { 1: "x" } }),
    );
    setFake(null);

    await clearRemoteJourney("user-9");

    expect(localStorage.getItem("soundmap.journey.v1")).toBeNull();
  });
});
