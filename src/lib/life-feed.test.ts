import { beforeEach, describe, expect, it } from "vitest";

import type { Song } from "./song/types";
import { questions } from "./questions";
import type { JourneyProgress } from "./journey-storage";
import {
  appendLifeFeedEntry,
  clearLifeFeed,
  feedEntryIntensity,
  graduateToLifeFeed,
  groupFeedEntries,
  isJourneyComplete,
  LIFE_FEED_STORAGE_KEY,
  lifeFeedMemories,
  lifeFeedSongs,
  loadLifeFeed,
  removeLifeFeedEntry,
  saveLifeFeed,
  updateLifeFeedEntry,
  type LifeFeedEntry,
} from "./life-feed";

function makeSong(title: string, artist = ""): Song {
  return {
    provider: "manual",
    providerId: `id-${title}`,
    title,
    artist,
    album: null,
    artworkUrl: null,
    isrc: null,
  };
}

function completeProgress(): JourneyProgress {
  const answers: Record<number, string> = {};
  const songs: Record<number, Song> = {};
  for (const q of questions) {
    answers[q.id] = `Song ${q.id}`;
    songs[q.id] = makeSong(`Song ${q.id}`, `Artist ${q.id}`);
  }
  return { current: questions.length + 1, answers, songs };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("isJourneyComplete", () => {
  it("is false for null or partial journeys", () => {
    expect(isJourneyComplete(null)).toBe(false);
    const partial = completeProgress();
    delete partial.answers[8];
    expect(isJourneyComplete(partial)).toBe(false);
  });

  it("is true once all 8 questions are answered", () => {
    expect(isJourneyComplete(completeProgress())).toBe(true);
  });
});

describe("graduateToLifeFeed", () => {
  it("refuses to graduate an incomplete journey", () => {
    const partial = completeProgress();
    delete partial.answers[8];
    expect(graduateToLifeFeed(partial)).toBeNull();
    expect(graduateToLifeFeed(null)).toBeNull();
  });

  it("graduates a completed journey into an empty feed", () => {
    const state = graduateToLifeFeed(completeProgress());
    expect(state).not.toBeNull();
    expect(state?.entries).toEqual([]);
    expect(Object.keys(state?.baseAnswers ?? {})).toHaveLength(questions.length);
  });
});

describe("append / remove / expand", () => {
  it("appends entries immutably and grows the map", () => {
    const base = graduateToLifeFeed(completeProgress());
    if (!base) throw new Error("base state required");

    const grown = appendLifeFeedEntry(base, {
      song: makeSong("New Song", "New Artist"),
      note: "heard it on the night ferry",
    });

    expect(base.entries).toHaveLength(0); // original untouched
    expect(grown.entries).toHaveLength(1);
    expect(grown.entries[0].note).toBe("heard it on the night ferry");
    expect(grown.entries[0].id.length).toBeGreaterThan(0);

    const map = lifeFeedSongs(grown);
    expect(map).toHaveLength(questions.length + 1);
    expect(map[map.length - 1].title).toBe("New Song");

    const memories = lifeFeedMemories(grown);
    expect(memories).toHaveLength(questions.length + 1);
    expect(memories[memories.length - 1]).toBe("heard it on the night ferry");
  });

  it("removes feed entries by id but never the base 8", () => {
    const base = graduateToLifeFeed(completeProgress());
    if (!base) throw new Error("base state required");
    const grown = appendLifeFeedEntry(base, { song: makeSong("Temp") });
    const pruned = removeLifeFeedEntry(grown, grown.entries[0].id);
    expect(pruned.entries).toHaveLength(0);
    expect(Object.keys(pruned.baseAnswers)).toHaveLength(questions.length);
  });
});

describe("updateLifeFeedEntry", () => {
  it("patches the note and insight in place, immutably", () => {
    const base = graduateToLifeFeed(completeProgress());
    if (!base) throw new Error("base state required");
    const grown = appendLifeFeedEntry(base, { song: makeSong("Patchable"), note: "original" });
    const id = grown.entries[0].id;

    const patched = updateLifeFeedEntry(grown, id, { note: "edited", insight: "a gemini line" });
    expect(grown.entries[0].note).toBe("original"); // original untouched
    expect(patched.entries[0].note).toBe("edited");
    expect(patched.entries[0].insight).toBe("a gemini line");
  });

  it("clears a note when patched with null", () => {
    const base = graduateToLifeFeed(completeProgress());
    if (!base) throw new Error("base state required");
    const grown = appendLifeFeedEntry(base, { song: makeSong("X"), note: "temp" });
    const cleared = updateLifeFeedEntry(grown, grown.entries[0].id, { note: null });
    expect(cleared.entries[0].note).toBeNull();
  });

  it("is a no-op for unknown ids", () => {
    const base = graduateToLifeFeed(completeProgress());
    if (!base) throw new Error("base state required");
    expect(updateLifeFeedEntry(base, "missing", { note: "x" })).toBe(base);
  });
});

describe("feedEntryIntensity", () => {
  it("is deterministic and within 0.35..0.95", () => {
    const base = graduateToLifeFeed(completeProgress());
    if (!base) throw new Error("base state required");
    const grown = appendLifeFeedEntry(base, {
      song: makeSong("Curve"),
      addedAt: "2026-08-22T10:00:00.000Z",
    });
    const entry = grown.entries[0];

    const first = feedEntryIntensity(entry);
    expect(first).toBe(feedEntryIntensity(entry));
    expect(first).toBeGreaterThanOrEqual(0.35);
    expect(first).toBeLessThanOrEqual(0.95);

    // Editing note/insight must NOT move the curve point.
    const edited = updateLifeFeedEntry(grown, entry.id, { note: "new", insight: "new" });
    expect(feedEntryIntensity(edited.entries[0])).toBe(first);
  });
});

describe("groupFeedEntries", () => {
  function makeEntry(title: string, addedAt: string): LifeFeedEntry {
    return {
      id: `e-${title}-${addedAt}`,
      song: makeSong(title),
      note: null,
      insight: null,
      addedAt,
    };
  }

  it("groups short spans into weekly chapters, chronological order", () => {
    const entries = [
      makeEntry("later", "2026-08-20T09:00:00.000Z"),
      makeEntry("earlier", "2026-08-03T09:00:00.000Z"),
    ];
    const chapters = groupFeedEntries(entries);
    expect(chapters.every((c) => c.granularity === "weekly")).toBe(true);
    expect(chapters[0].label).toMatch(/^Week \d+, 2026$/);
    // Chronological: August 3 chapter comes before August 20.
    expect(chapters[0].entries[0].song.title).toBe("earlier");
    expect(chapters[chapters.length - 1].entries[0].song.title).toBe("later");
  });

  it("groups long spans into monthly chapters", () => {
    const chapters = groupFeedEntries([
      makeEntry("a", "2026-01-05T09:00:00.000Z"),
      makeEntry("b", "2026-05-05T09:00:00.000Z"),
    ]);
    expect(chapters.every((c) => c.granularity === "monthly")).toBe(true);
    expect(chapters.map((c) => c.label)).toEqual(["January 2026", "May 2026"]);
  });

  it("collects undated entries in a trailing chapter and returns [] for none", () => {
    expect(groupFeedEntries([])).toEqual([]);
    const chapters = groupFeedEntries([makeEntry("ghost", "not-a-date")]);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].label).toBe("Undated moments");
  });
});

describe("persistence", () => {
  it("round-trips through localStorage", () => {
    const base = graduateToLifeFeed(completeProgress());
    if (!base) throw new Error("base state required");
    const grown = appendLifeFeedEntry(base, {
      song: makeSong("Persistent", "Artist"),
      note: "a note",
    });

    saveLifeFeed(grown);
    const loaded = loadLifeFeed();

    expect(loaded).not.toBeNull();
    expect(loaded?.entries).toHaveLength(1);
    expect(loaded?.entries[0].song.title).toBe("Persistent");
    expect(loaded?.entries[0].note).toBe("a note");
    expect(lifeFeedSongs(loaded!)).toHaveLength(questions.length + 1);
  });

  it("returns null when nothing is stored", () => {
    expect(loadLifeFeed()).toBeNull();
  });

  it("refuses stored feeds whose base journey is incomplete", () => {
    window.localStorage.setItem(
      LIFE_FEED_STORAGE_KEY,
      JSON.stringify({ baseAnswers: { 1: "only one" }, entries: [] }),
    );
    expect(loadLifeFeed()).toBeNull();
  });

  it("drops malformed entries on load", () => {
    const base = graduateToLifeFeed(completeProgress());
    if (!base) throw new Error("base state required");
    saveLifeFeed(base);

    const raw = JSON.parse(window.localStorage.getItem(LIFE_FEED_STORAGE_KEY)!);
    raw.entries = [
      { id: "ok", song: makeSong("Valid"), note: null, addedAt: new Date().toISOString() },
      { id: "bad", song: { title: "" }, note: null, addedAt: "now" },
      { garbage: true },
    ];
    window.localStorage.setItem(LIFE_FEED_STORAGE_KEY, JSON.stringify(raw));

    const loaded = loadLifeFeed();
    expect(loaded?.entries).toHaveLength(1);
    expect(loaded?.entries[0].id).toBe("ok");
  });

  it("clearLifeFeed removes only the feed", () => {
    const base = graduateToLifeFeed(completeProgress());
    if (!base) throw new Error("base state required");
    saveLifeFeed(base);
    clearLifeFeed();
    expect(loadLifeFeed()).toBeNull();
  });
});
