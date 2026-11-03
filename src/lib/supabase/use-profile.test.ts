import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("./client", () => ({
  isSupabaseConfigured: vi.fn(),
  getSupabase: vi.fn(),
}));

import { getSupabase, isSupabaseConfigured } from "./client";
import { useProfile } from "./use-profile";

const configured = vi.mocked(isSupabaseConfigured);
const getClient = vi.mocked(getSupabase);

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Minimal supabase stub: select(...).eq(...).maybeSingle() and upsert(...). */
function fakeClient(maybeSingle: () => Promise<unknown>, upsert = vi.fn(async () => ({}))) {
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
      upsert,
    }),
  };
  return { client, upsert };
}

beforeEach(() => {
  window.localStorage.clear();
  configured.mockReset();
  getClient.mockReset();
});

describe("useProfile", () => {
  it("stays loading and decides nothing while the session is not ready", () => {
    configured.mockReturnValue(false);
    window.localStorage.setItem("lis.birthYear", "1985");
    const { result } = renderHook(() => useProfile(null, false));
    expect(result.current.loading).toBe(true);
    expect(result.current.birthYear).toBeNull();
  });

  it("settles from localStorage once ready with no backend and no user", async () => {
    configured.mockReturnValue(false);
    window.localStorage.setItem("lis.birthYear", "1985");
    const { result } = renderHook(() => useProfile(null, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.birthYear).toBe(1985);
    expect(result.current.skipped).toBe(false);
  });

  it("flips from loading to settled when ready changes on the same hook", async () => {
    configured.mockReturnValue(false);
    const { result, rerender } = renderHook(({ ready }) => useProfile(null, ready), {
      initialProps: { ready: false },
    });
    expect(result.current.loading).toBe(true);
    rerender({ ready: true });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.birthYear).toBeNull();
  });

  it("goes back to loading when a user id arrives later, then settles from the server", async () => {
    configured.mockReturnValue(true);
    const pending = deferred<{ data: { birth_year: number } }>();
    const { client } = fakeClient(() => pending.promise);
    getClient.mockReturnValue(client as never);

    const { result, rerender } = renderHook(({ id }) => useProfile(id, true), {
      initialProps: { id: null as string | null },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ id: "user-1" });
    await waitFor(() => expect(result.current.loading).toBe(true));

    await act(async () => {
      pending.resolve({ data: { birth_year: 1990 } });
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.birthYear).toBe(1990);
  });

  it("save stores the year locally and upserts it for the user", async () => {
    configured.mockReturnValue(true);
    const { client, upsert } = fakeClient(async () => ({ data: null }));
    getClient.mockReturnValue(client as never);

    const { result } = renderHook(() => useProfile("user-1", true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.save(1985);
    });
    expect(result.current.birthYear).toBe(1985);
    expect(window.localStorage.getItem("lis.birthYear")).toBe("1985");
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "user-1", birth_year: 1985 },
      { onConflict: "user_id" },
    );
  });

  it("skip remembers the choice without touching the birth year", async () => {
    configured.mockReturnValue(false);
    const { result } = renderHook(() => useProfile(null, true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.skip();
    });
    expect(result.current.skipped).toBe(true);
    expect(result.current.birthYear).toBeNull();
    expect(window.localStorage.getItem("lis.birthYearSkipped")).toBe("1");
  });
});
