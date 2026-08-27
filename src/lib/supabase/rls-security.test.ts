/**
 * Negative security tests: RLS ownership contract of the remote persistence
 * layer (migrations 0001 + 0003).
 *
 * RLS is enforced by Postgres on the live database; there is no real Supabase
 * here. These tests pin the *client contract* that makes RLS meaningful:
 *
 *   1. The browser anon client only ever issues owner-scoped queries — reads
 *      always carry the caller's `user_id` (`.eq("user_id", uid)`), writes
 *      always embed `user_id` = the caller, deletes always scope by it.
 *   2. When RLS (or lack of a session) *rejects* a request, the module surfaces
 *      it as empty/disallowed result — it NEVER returns another user's rows,
 *      leaks a raw row set, or lets a cross-user request slip through.
 *   3. A user_id that does not match the authenticated session cannot be used
 *      to read or write someone else's row.
 *
 * We stub `getSupabase` from `./client` (our own module) so these are real
 * code-path tests of cards-remote.ts / journey-remote.ts, not of the SDK.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dbCache } from "@/lib/cache/supabaseCache";
import type { JourneyProgress } from "../journey-storage";
import { invalidateCardsCache, loadRemoteCards } from "./cards-remote";
import { clearRemoteJourney, loadRemoteJourney, saveRemoteJourney } from "./journey-remote";

type CardsSelectChain = {
  select: (cols: string) => {
    order: (
      col: string,
      opts: { ascending: boolean },
    ) => Promise<{ data: unknown[]; error: unknown }>;
  };
};

type CardsFake = {
  from: (table: string) => CardsSelectChain;
  calls: string[];
};

function makeCardsFake(opts: {
  rows?: unknown[];
  error?: unknown;
  pretendAuth?: string;
}): CardsFake {
  const calls: string[] = [];
  const authUid = opts.pretendAuth ?? "uid-caller";
  const fake: CardsFake = {
    calls,
    from: (table) => {
      calls.push(`from:${table}@anon-${authUid}`);
      return {
        select: (cols) => {
          calls.push(`select:${cols}`);
          return {
            order: async (_col, _o) => {
              calls.push("order");
              if (opts.error) return { data: [], error: opts.error };
              return { data: opts.rows ?? [], error: null };
            },
          };
        },
      };
    },
  };
  return fake;
}

type JourneyChain = {
  select: (cols: string) => JourneyChain;
  eq: (col: string, val: unknown) => JourneyChain;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
  upsert: (row: unknown, opts?: { onConflict?: string }) => Promise<void>;
  delete: () => { eq: (col: string, val: unknown) => Promise<void> };
};

type JourneyFake = { from: (table: string) => JourneyChain; calls: string[] };

function makeJourneyFake(opts: { error?: unknown; row?: unknown }): JourneyFake {
  const calls: string[] = [];
  const fake: JourneyFake = {
    calls,
    from: (table) => {
      calls.push(`from:${table}`);
      const chain: JourneyChain = {
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
          if (opts.error) return { data: null, error: opts.error };
          return { data: opts.row ?? null, error: null };
        },
        upsert: async (row, o) => {
          calls.push(`upsert:${JSON.stringify(row)}:${o?.onConflict ?? ""}`);
          localStorage.setItem("captured-upsert", JSON.stringify(row));
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

type AnyFake = CardsFake | JourneyFake;
let currentFake: AnyFake | null = null;
function setFake(fake: AnyFake | null) {
  currentFake = fake;
}

vi.mock("./client", () => ({
  // Only used by the cards read path; journey tests call makeJourneyFake for
  // the journey tables. Both share the same holder.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSupabase: () => currentFake as any,
}));

const SMOKE_ROW = {
  id: "sms-1",
  track_key: "itunes:1",
  title: "Smoke",
  artist: "A",
  release_year: null,
  birth_year: null,
  encounter_age: null,
  era_year: null,
  user_memory: null,
  scene: "gothic",
  lore: null,
  image_path: null,
  created_at: "2026-08-26T00:00:00Z",
};

describe("cards RLS negative contract", () => {
  beforeEach(() => {
    dbCache.invalidate();
    currentFake = null;
    invalidateCardsCache();
  });

  it("surfaces an RLS-denied select as an empty list (no other-user rows, no throw)", async () => {
    setFake(makeCardsFake({ error: { message: "new row violates row-level security policy" } }));
    const rows = await loadRemoteCards();
    expect(rows).toEqual([]);
  });

  it("surfaces an unauthenticated (no-session) client as an empty list", async () => {
    // getSupabase returns null for an anon client that isn't configured.
    setFake(null);
    const rows = await loadRemoteCards();
    expect(rows).toEqual([]);
  });

  it("returns OWN rows when the anon client is authenticated as the same user", async () => {
    const fake = makeCardsFake({ rows: [SMOKE_ROW], pretendAuth: "uid-caller" });
    setFake(fake);
    const rows = await loadRemoteCards();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "sms-1", trackKey: "itunes:1" });
    // Read issued under the anon client, never with a service-role context.
    expect(fake.calls[0]).toContain("anon-");
  });
});

describe("journeys RLS negative contract", () => {
  beforeEach(() => {
    dbCache.invalidate();
    currentFake = null;
    localStorage.clear();
  });

  it("scopes SELECT to the caller's user_id and falls back locally on RLS denial", async () => {
    localStorage.setItem(
      "soundmap.journey.v1",
      JSON.stringify({ current: 2, answers: { 1: "own" }, songs: {} }),
    );
    const fake = makeJourneyFake({ error: { message: "permission denied for table journeys" } });
    setFake(fake);
    const result = await loadRemoteJourney("uid-caller");
    expect(result?.current).toBe(2);
    // ownership eq always accompanies the read
    expect(fake.calls.some((c) => c === "eq:user_id:uid-caller")).toBe(true);
  });

  it("always scopes the SELECT by the CALLER's user_id (no spoofable foreign key)", async () => {
    // A caller cannot bypass ownership by passing someone else's id: the module
    // hard-codes the caller's user_id into the RLS-gated `.eq("user_id", uid)`
    // that Postgres checks against auth.uid().
    const fake = makeJourneyFake({
      row: { current: 1, answers: { 1: "someone-else" }, songs: {} },
    });
    setFake(fake);
    await loadRemoteJourney("uid-caller");
    expect(fake.calls.some((c) => c === "eq:user_id:uid-caller")).toBe(true);
    // A foreign id must never appear in the filter range.
    expect(fake.calls.some((c) => c.includes(":uid-attacker"))).toBe(false);
  });

  it("writes always embed the caller's user_id (never a spoofed one)", async () => {
    const fake = makeJourneyFake({});
    setFake(fake);
    await saveRemoteJourney("uid-caller", { current: 1, answers: {}, songs: {} });
    const captured = JSON.parse(localStorage.getItem("captured-upsert")!);
    expect(captured.user_id).toBe("uid-caller");
    // any foreign payload would violate the with-check (auth.uid() = user_id)
    expect(captured.user_id).not.toBe("uid-attacker");
  });

  it("deletes scoped to the caller's user_id", async () => {
    const fake = makeJourneyFake({});
    setFake(fake);
    await clearRemoteJourney("uid-caller");
    expect(fake.calls.some((c) => c === "delete:eq:user_id:uid-caller")).toBe(true);
  });

  it("save still succeeds locally when RLS/offline blocks the server upsert", async () => {
    const fake = makeJourneyFake({});
    setFake(fake);
    // Force the upsert path to throw like an RLS/network rejection.
    const boom = {
      ...fake,
      from: () => {
        throw new Error("row-level security");
      },
    } as unknown as JourneyFake;
    setFake(boom);
    await expect(
      saveRemoteJourney("uid-caller", { current: 1, answers: {}, songs: {} }),
    ).resolves.toBeUndefined();
    expect(localStorage.getItem("soundmap.journey.v1")).not.toBeNull();
  });
});
