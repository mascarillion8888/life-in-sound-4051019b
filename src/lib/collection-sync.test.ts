import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  COLLECTION_STORAGE_KEY,
  MAX_COLLECTION_ENTRIES,
  type CollectionEntry,
  emptyCollection,
  loadCollection,
  saveCollection,
} from "./collection";
import { mergeCollections, pullAndMerge, pushEntry, removeEntry } from "./collection-sync";

function entry(trackKey: string, addedAt: string, title = trackKey): CollectionEntry {
  return {
    trackKey,
    snapshot: {
      title,
      artist: "Artist",
      artworkUrl: null,
      album: null,
      releaseYear: null,
      previewUrl: null,
    },
    addedAt,
  };
}

/**
 * Minimal Supabase stub. `select` resolves to the supplied rows (or rejects to
 * simulate a network failure); `upsert`/`delete` are spies returning `{}`.
 */
function fakeClient(
  rows: unknown[] | (() => Promise<unknown>),
  overrides: { upsert?: unknown; del?: unknown } = {},
) {
  const upsert = vi.fn(async (_rows: unknown[], _options?: unknown) => overrides.upsert ?? {});
  const del = vi.fn(() => {
    const chain = { eq: () => chain, then: (r: (v: unknown) => unknown) => r(overrides.del ?? {}) };
    return chain;
  });
  const client = {
    from: () => ({
      select: () => ({
        eq: () =>
          typeof rows === "function" ? rows() : Promise.resolve({ data: rows, error: null }),
      }),
      upsert,
      delete: del,
    }),
  };
  return { client, upsert, del };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("mergeCollections", () => {
  it("unions by trackKey and keeps the newer addedAt on a clash", () => {
    const local = [entry("a", "2026-01-01T00:00:00.000Z"), entry("b", "2026-01-02T00:00:00.000Z")];
    const remote = [
      entry("b", "2026-03-01T00:00:00.000Z", "remote-b"), // newer → wins
      entry("c", "2026-01-03T00:00:00.000Z"),
    ];
    const merged = mergeCollections(local, remote);
    const keys = merged.entries.map((e) => e.trackKey);
    expect(keys).toHaveLength(3);
    expect(merged.entries.find((e) => e.trackKey === "b")?.snapshot.title).toBe("remote-b");
  });

  it("orders newest-first", () => {
    const merged = mergeCollections(
      [entry("old", "2026-01-01T00:00:00.000Z")],
      [entry("new", "2026-05-01T00:00:00.000Z")],
    );
    expect(merged.entries.map((e) => e.trackKey)).toEqual(["new", "old"]);
  });

  it(`caps the union at ${MAX_COLLECTION_ENTRIES} (newest kept)`, () => {
    const many = Array.from({ length: MAX_COLLECTION_ENTRIES + 10 }, (_, i) =>
      entry(`k${i}`, `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`),
    );
    const merged = mergeCollections(many, []);
    expect(merged.entries).toHaveLength(MAX_COLLECTION_ENTRIES);
    expect(merged.entries[0].trackKey).toBe(`k${MAX_COLLECTION_ENTRIES + 9}`);
  });

  it("handles empty inputs", () => {
    expect(mergeCollections([], []).entries).toEqual([]);
    expect(mergeCollections([entry("a", "2026-01-01T00:00:00.000Z")], []).entries).toHaveLength(1);
  });
});

describe("pullAndMerge", () => {
  it("merges the remote copy into local and persists the union locally", async () => {
    saveCollection({ entries: [entry("local", "2026-01-01T00:00:00.000Z")], updatedAt: "" });
    const { client } = fakeClient([
      {
        track_key: "remote",
        snapshot: { title: "R", artist: "A" },
        added_at: "2026-02-01T00:00:00.000Z",
      },
    ]);
    const merged = await pullAndMerge(client as never, "user-1");
    expect(merged.entries.map((e) => e.trackKey).sort()).toEqual(["local", "remote"]);
    expect(loadCollection().entries).toHaveLength(2);
  });

  it("upserts local-only entries to the server", async () => {
    saveCollection({ entries: [entry("local-only", "2026-01-01T00:00:00.000Z")], updatedAt: "" });
    const { client, upsert } = fakeClient([]);
    await pullAndMerge(client as never, "user-1");
    expect(upsert).toHaveBeenCalledTimes(1);
    const rows = upsert.mock.calls[0][0] as Array<{ track_key: string }>;
    expect(rows.map((r) => r.track_key)).toEqual(["local-only"]);
  });

  it("leaves the local state untouched when Supabase errors", async () => {
    const local = { entries: [entry("keep", "2026-01-01T00:00:00.000Z")], updatedAt: "x" };
    saveCollection(local);
    const { client } = fakeClient(() => Promise.reject(new Error("network")));
    const merged = await pullAndMerge(client as never, "user-1");
    expect(merged.entries).toEqual(local.entries);
    expect(loadCollection().entries).toEqual(local.entries);
  });

  it("does nothing when there is no user id", async () => {
    const { client, upsert } = fakeClient([]);
    const merged = await pullAndMerge(client as never, null);
    expect(upsert).not.toHaveBeenCalled();
    expect(merged.entries).toEqual([]);
  });

  it("does nothing when there is no client", async () => {
    saveCollection(emptyCollection());
    const merged = await pullAndMerge(null, "user-1");
    expect(merged.entries).toEqual([]);
  });
});

describe("pushEntry / removeEntry", () => {
  it("pushEntry upserts one row", async () => {
    const { client, upsert } = fakeClient([]);
    pushEntry(client as never, "user-1", entry("a", "2026-01-01T00:00:00.000Z"));
    await Promise.resolve();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect((upsert.mock.calls[0][0] as Array<{ track_key: string }>)[0].track_key).toBe("a");
  });

  it("removeEntry deletes the matching row", async () => {
    const { client, del } = fakeClient([]);
    removeEntry(client as never, "user-1", "a");
    await Promise.resolve();
    expect(del).toHaveBeenCalledTimes(1);
  });

  it("swallows a rejected upsert (fire-and-forget never throws)", async () => {
    const { client, upsert } = fakeClient([], { upsert: Promise.reject(new Error("boom")) });
    expect(() =>
      pushEntry(client as never, "user-1", entry("a", "2026-01-01T00:00:00.000Z")),
    ).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(upsert).toHaveBeenCalled();
  });

  it("is a no-op without a user id", () => {
    const { client, upsert, del } = fakeClient([]);
    pushEntry(client as never, null, entry("a", "2026-01-01T00:00:00.000Z"));
    removeEntry(client as never, null, "a");
    expect(upsert).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });
});

describe("collection sync storage contract", () => {
  it("writes the merged union under the collection key only", async () => {
    saveCollection(emptyCollection());
    const { client } = fakeClient([
      {
        track_key: "r",
        snapshot: { title: "T", artist: "A" },
        added_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    await pullAndMerge(client as never, "user-1");
    expect(window.localStorage.getItem(COLLECTION_STORAGE_KEY)).toBeTruthy();
  });
});
