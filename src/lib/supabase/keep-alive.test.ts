import { afterEach, describe, expect, it, vi } from "vitest";

import { keepAliveLogic } from "./keep-alive";

type FakeClient = {
  from: (table: string) => {
    select: (
      columns: string,
      options: { count: "exact"; head: true },
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
};

function fakeClient(error: { message: string } | null = null) {
  const select = vi.fn().mockResolvedValue({ error });
  const from = vi.fn(() => ({ select }));
  const clientImpl = vi.fn((): FakeClient => ({ from }));
  return { clientImpl, from, select };
}

describe("keepAliveLogic", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("pings journeys with a zero-row HEAD count when configured", async () => {
    process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    process.env.VITE_SUPABASE_ANON_KEY = "anon-key";
    const { clientImpl, from, select } = fakeClient();

    const result = await keepAliveLogic({ clientImpl });

    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.ms).toBeGreaterThanOrEqual(0);
    expect(clientImpl).toHaveBeenCalledWith("https://example.supabase.co", "anon-key");
    expect(from).toHaveBeenCalledWith("journeys");
    expect(select).toHaveBeenCalledWith("id", { count: "exact", head: true });
  });

  it("skips cleanly when Supabase env vars are missing (no throw, no client)", async () => {
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    const { clientImpl } = fakeClient();

    const result = await keepAliveLogic({ clientImpl });

    expect(result).toEqual({ ok: false, reason: "supabase-not-configured", ms: 0 });
    expect(clientImpl).not.toHaveBeenCalled();
  });

  it("reports a query failure without throwing", async () => {
    process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    process.env.VITE_SUPABASE_ANON_KEY = "anon-key";
    const { clientImpl } = fakeClient({ message: "relation does not exist" });

    const result = await keepAliveLogic({ clientImpl });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("query-failed: relation does not exist");
  });

  it("reports a thrown exception without letting it escape", async () => {
    process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    process.env.VITE_SUPABASE_ANON_KEY = "anon-key";
    const clientImpl = vi.fn(() => {
      throw new Error("network down");
    });

    const result = await keepAliveLogic({ clientImpl });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("exception: network down");
  });

  it("measures elapsed time with the injected clock", async () => {
    process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
    process.env.VITE_SUPABASE_ANON_KEY = "anon-key";
    const { clientImpl } = fakeClient();
    let tick = 0;
    const nowImpl = () => (tick++ === 0 ? 100 : 137);

    const result = await keepAliveLogic({ clientImpl, nowImpl });

    expect(result.ms).toBe(37);
  });
});
