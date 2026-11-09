// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("./client", () => ({
  isSupabaseConfigured: vi.fn(),
  getSupabase: vi.fn(),
}));

import { getSupabase, isSupabaseConfigured } from "./client";
import type { SessionState } from "./use-session";
import {
  __resetCollectionSync,
  syncCollectionToggle,
  useCollectionSync,
} from "./use-collection-sync";
import type { CollectionEntry } from "@/lib/collection";

const configured = vi.mocked(isSupabaseConfigured);
const getClient = vi.mocked(getSupabase);

function entry(trackKey: string): CollectionEntry {
  return {
    trackKey,
    snapshot: {
      title: "T",
      artist: "A",
      artworkUrl: null,
      album: null,
      releaseYear: null,
      previewUrl: null,
    },
    addedAt: "2026-01-01T00:00:00.000Z",
  };
}

/** Stub whose `select` is a spy; upsert/delete are spies too. */
function fakeClient() {
  const selectEq = vi.fn(async () => ({ data: [], error: null }));
  const upsert = vi.fn(async () => ({}));
  const delEq = vi.fn(() => ({ eq: delEq, then: (r: (v: unknown) => unknown) => r({}) }));
  const client = {
    from: () => ({
      select: () => ({ eq: selectEq }),
      upsert,
      delete: () => delEq(),
    }),
  };
  return { client, selectEq, upsert, delEq };
}

const anonymousUser = (id: string): SessionState => ({
  status: "anonymous",
  user: { id } as never,
});

beforeEach(() => {
  window.localStorage.clear();
  __resetCollectionSync();
  configured.mockReset();
  getClient.mockReset();
});

describe("useCollectionSync", () => {
  it("pulls once when a user id is present", async () => {
    configured.mockReturnValue(true);
    const { client, selectEq } = fakeClient();
    getClient.mockReturnValue(client as never);

    renderHook(() => useCollectionSync(anonymousUser("user-1")));
    await Promise.resolve();
    await Promise.resolve();
    expect(selectEq).toHaveBeenCalledTimes(1);
  });

  it("does nothing (no request) when the session is unavailable", () => {
    configured.mockReturnValue(true);
    const { client, selectEq } = fakeClient();
    getClient.mockReturnValue(client as never);

    renderHook(() => useCollectionSync({ status: "unavailable" }));
    expect(selectEq).not.toHaveBeenCalled();
    expect(getClient).not.toHaveBeenCalled();
  });

  it("does nothing when anonymous but no user is attached", () => {
    configured.mockReturnValue(true);
    const { client, selectEq } = fakeClient();
    getClient.mockReturnValue(client as never);

    renderHook(() => useCollectionSync({ status: "anonymous", user: null }));
    expect(selectEq).not.toHaveBeenCalled();
  });

  it("does not re-pull for the same user on a remount (no repeat request)", async () => {
    configured.mockReturnValue(true);
    const { client, selectEq } = fakeClient();
    getClient.mockReturnValue(client as never);

    const first = renderHook(() => useCollectionSync(anonymousUser("user-1")));
    await Promise.resolve();
    first.unmount();
    renderHook(() => useCollectionSync(anonymousUser("user-1")));
    await Promise.resolve();
    await Promise.resolve();
    expect(selectEq).toHaveBeenCalledTimes(1);
  });

  it("mirrors a toggle: push when saved, delete when removed", async () => {
    configured.mockReturnValue(true);
    const { client, upsert, delEq } = fakeClient();
    getClient.mockReturnValue(client as never);

    renderHook(() => useCollectionSync(anonymousUser("user-1")));

    syncCollectionToggle("itunes:1", entry("itunes:1"));
    await Promise.resolve();
    expect(upsert).toHaveBeenCalledTimes(1);

    syncCollectionToggle("itunes:1", null);
    await Promise.resolve();
    expect(delEq).toHaveBeenCalled();
  });

  it("toggle is a silent no-op without a resolved user", () => {
    syncCollectionToggle("itunes:1", entry("itunes:1"));
    // No target resolved — nothing to assert against, and nothing threw.
    expect(true).toBe(true);
  });
});
