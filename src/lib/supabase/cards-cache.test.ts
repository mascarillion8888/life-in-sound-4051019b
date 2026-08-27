import { beforeEach, describe, expect, it, vi } from "vitest";

import { dbCache } from "@/lib/cache/supabaseCache";
import { invalidateCardsCache, loadRemoteCards } from "./cards-remote";

type SelectChain = {
  select: (cols: string) => {
    order: (
      col: string,
      opts: { ascending: boolean },
    ) => Promise<{ data: unknown[]; error: unknown }>;
  };
};

type FakeSupabase = { from: (table: string) => SelectChain; calls: string[] };

function makeFakeSupabase(opts: { rows?: unknown[]; error?: unknown }): FakeSupabase {
  const calls: string[] = [];
  const { rows = [], error } = opts;
  const fake: FakeSupabase = {
    calls,
    from: (table) => {
      calls.push(`from:${table}`);
      return {
        select: (cols) => {
          calls.push(`select:${cols}`);
          return {
            order: async (_col, _opts) => {
              calls.push("order");
              if (error) return { data: null as unknown as unknown[], error };
              return { data: rows, error: null };
            },
          };
        },
      };
    },
  };
  return fake;
}

let currentFake: FakeSupabase | null = null;
function setFake(fake: FakeSupabase | null) {
  currentFake = fake;
}

vi.mock("./client", () => ({
  getSupabase: () => currentFake,
}));

const RAW_CARD = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  track_key: "itunes:123",
  title: "Fragile",
  artist: "Sting",
  genre: "Gothic Folk",
  release_year: 1987,
  birth_year: 1978,
  encounter_age: 9,
  era_year: 1987,
  user_memory: null,
  scene: "gothic",
  lore: "A child hums along.",
  image_path: null,
  created_at: "2026-08-26T00:00:00Z",
};

describe("loadRemoteCards caching", () => {
  beforeEach(() => {
    dbCache.invalidate();
    setFake(null);
  });

  it("serves the second load from cache without a second Supabase call", async () => {
    const fake = makeFakeSupabase({ rows: [RAW_CARD] });
    setFake(fake);

    const first = await loadRemoteCards();
    const second = await loadRemoteCards();

    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
    // A single from/select/order round-trip — the second call never hit Supabase.
    expect(fake.calls.filter((c) => c.startsWith("from:"))).toHaveLength(1);
    expect(fake.calls.filter((c) => c.startsWith("select:"))).toHaveLength(1);
    expect(fake.calls.filter((c) => c === "order")).toHaveLength(1);
  });

  it("re-fetches after the cache is invalidated", async () => {
    const fake = makeFakeSupabase({ rows: [RAW_CARD] });
    setFake(fake);

    await loadRemoteCards();
    invalidateCardsCache();
    await loadRemoteCards();

    expect(fake.calls.filter((c) => c.startsWith("from:"))).toHaveLength(2);
  });

  it("caches an empty result so failures do not hammer Supabase", async () => {
    const fake = makeFakeSupabase({ error: new Error("rls denied") });
    setFake(fake);

    await loadRemoteCards();
    await loadRemoteCards();

    expect(fake.calls.filter((c) => c.startsWith("from:"))).toHaveLength(1);
  });
});
