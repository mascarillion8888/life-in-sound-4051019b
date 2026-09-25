import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  COLLECTION_STORAGE_KEY,
  MAX_COLLECTION_ENTRIES,
  emptyCollection,
  isInCollection,
  loadCollection,
  saveCollection,
  snapshotFromSong,
  toggleInCollection,
} from "./collection";
import type { Song } from "./song/types";

function song(over: Partial<Song> = {}): Song {
  return {
    provider: "itunes",
    providerId: "14617433",
    title: "Fragile",
    artist: "Sting",
    album: "...Nothing Like the Sun",
    artworkUrl: "https://example.com/art.jpg",
    releaseYear: 1987,
    previewUrl: "https://example.com/preview.m4a",
    isrc: null,
    verified: true,
    ...over,
  };
}

describe("collection snapshot", () => {
  it("stores only the render-oriented Song slice — not the full Song contract", () => {
    const s = snapshotFromSong(song());
    expect(s).toEqual({
      title: "Fragile",
      artist: "Sting",
      artworkUrl: "https://example.com/art.jpg",
      album: "...Nothing Like the Sun",
      releaseYear: 1987,
      previewUrl: "https://example.com/preview.m4a",
    });
  });

  it("coerces absent optional fields to null", () => {
    const s = snapshotFromSong(song({ artworkUrl: null, releaseYear: null, previewUrl: null }));
    expect(s.artworkUrl).toBeNull();
    expect(s.releaseYear).toBeNull();
    expect(s.previewUrl).toBeNull();
  });
});

describe("collection toggle — idempotent add/remove", () => {
  it("starts out empty and is not in the collection", () => {
    expect(emptyCollection().entries).toEqual([]);
    expect(isInCollection(emptyCollection(), "itunes:14617433")).toBe(false);
  });

  it("adds a track and marks it in the collection (newest first)", () => {
    const state = toggleInCollection(emptyCollection(), "itunes:14617433", song());
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].trackKey).toBe("itunes:14617433");
    expect(state.entries[0].snapshot.title).toBe("Fragile");
    expect(isInCollection(state, "itunes:14617433")).toBe(true);
  });

  it("is idempotent — toggling an already-saved track removes it", () => {
    const added = toggleInCollection(emptyCollection(), "a", song({ providerId: "1" }));
    const removed = toggleInCollection(added, "a", song({ providerId: "1" }));
    expect(isInCollection(removed, "a")).toBe(false);
    expect(removed.entries).toEqual([]);
  });

  it("does not duplicate when a track is toggled out then back in — newest order preserved", () => {
    let state = toggleInCollection(emptyCollection(), "first", song({ providerId: "1" }));
    state = toggleInCollection(state, "second", song({ providerId: "2" }));
    state = toggleInCollection(state, "first", song({ providerId: "1" })); // remove
    state = toggleInCollection(state, "first", song({ providerId: "1" })); // re-add
    const keys = state.entries.map((e) => e.trackKey);
    expect(new Set(keys)).toEqual(new Set(["first", "second"]));
    expect(keys).toHaveLength(2); // no duplicate
  });

  it("no-ops when the trackKey is empty", () => {
    const base = emptyCollection();
    expect(toggleInCollection(base, "", song())).toBe(base);
  });

  it("no-ops when adding without a Song", () => {
    const base = emptyCollection();
    expect(toggleInCollection(base, "itunes:1", null)).toBe(base);
  });
});

describe("collection LRU cap", () => {
  it(`caps at ${MAX_COLLECTION_ENTRIES} — the oldest drops beyond the limit (newest stay)`, () => {
    let state = emptyCollection();
    for (let i = 0; i < MAX_COLLECTION_ENTRIES + 5; i++) {
      state = toggleInCollection(state, `key-${i}`, song({ providerId: `${i}` }));
    }
    expect(state.entries).toHaveLength(MAX_COLLECTION_ENTRIES);
    // Newest first: the most recently added is at index 0.
    expect(state.entries[0].trackKey).toBe(`key-${MAX_COLLECTION_ENTRIES + 4}`);
    // The five oldest (key-0..key-4) were evicted.
    expect(state.entries.some((e) => e.trackKey === "key-0")).toBe(false);
    expect(state.entries.some((e) => e.trackKey === "key-4")).toBe(false);
  });
});

describe("collection localStorage persistence (journey-independent)", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("loads empty when nothing is stored", () => {
    expect(loadCollection().entries).toEqual([]);
  });

  it("round-trips the collection through localStorage", () => {
    const state = toggleInCollection(emptyCollection(), "itunes:14617433", song());
    saveCollection(state);
    const loaded = loadCollection();
    expect(loaded.entries).toEqual(state.entries);
    expect(isInCollection(loaded, "itunes:14617433")).toBe(true);
  });

  it("is independent of the journey — stored under its own key only", () => {
    saveCollection(toggleInCollection(emptyCollection(), "k", song()));
    // The journey key is untouched by the collection save.
    expect(localStorage.getItem("soundmap.journey.v1")).toBeNull();
    expect(localStorage.getItem(COLLECTION_STORAGE_KEY)).not.toBeNull();
  });

  it("drops malformed entries on load while keeping valid ones", () => {
    localStorage.setItem(
      COLLECTION_STORAGE_KEY,
      JSON.stringify({
        entries: [
          {
            trackKey: "good",
            snapshot: { title: "A", artist: "B" },
            addedAt: "2026-01-01T00:00:00Z",
          },
          { trackKey: "bad" }, // no snapshot → dropped
          { snapshot: { title: "NoKey" } }, // no trackKey → dropped
        ],
        updatedAt: "2026-01-01T00:00:00Z",
      }),
    );
    const loaded = loadCollection();
    expect(loaded.entries).toHaveLength(1);
    expect(loaded.entries[0].trackKey).toBe("good");
  });

  it("enforces the LRU cap on load (defensive — hand-edited oversized key)", () => {
    const overflow = Array.from({ length: MAX_COLLECTION_ENTRIES + 3 }, (_, i) => ({
      trackKey: `key-${i}`,
      snapshot: { title: `T${i}`, artist: "" },
      addedAt: "2026-01-01T00:00:00Z",
    }));
    localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify({ entries: overflow }));
    expect(loadCollection().entries).toHaveLength(MAX_COLLECTION_ENTRIES);
  });
});
