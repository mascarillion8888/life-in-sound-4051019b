import { beforeEach, describe, expect, it } from "vitest";

import type { Song } from "./song/types";
import { questions } from "./questions";
import type { JourneyProgress } from "./journey-storage";
import {
  appendLifeFeedEntry,
  clearLifeFeed,
  graduateToLifeFeed,
  isJourneyComplete,
  LIFE_FEED_STORAGE_KEY,
  lifeFeedMemories,
  lifeFeedSongs,
  loadLifeFeed,
  removeLifeFeedEntry,
  saveLifeFeed,
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
