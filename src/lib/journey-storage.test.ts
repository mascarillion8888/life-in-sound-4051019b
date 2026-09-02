import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  JOURNEY_STORAGE_KEY,
  clearJourney,
  hasJourneyProgress,
  isValidSong,
  loadJourney,
  mergeJourneys,
  saveJourney,
} from "./journey-storage";
import type { Song } from "./song/types";

function song(over: Partial<Song> = {}): Song {
  return {
    provider: "musicbrainz",
    providerId: "11111111-2222-3333-4444-555555555555",
    title: "Upside Down",
    artist: "Jack Johnson",
    album: null,
    artworkUrl: null,
    previewUrl: null,
    releaseYear: null,
    genre: null,
    mood: null,
    isrc: null,
    ...over,
  };
}

describe("journey-storage localStorage layer", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips a journey through localStorage", () => {
    const progress = { current: 3, answers: { 1: "Song A", 2: "Song B" }, songs: {} };
    saveJourney(progress);
    expect(loadJourney()).toEqual(progress);
  });

  it("returns null when nothing is stored", () => {
    expect(loadJourney()).toBeNull();
  });

  it("drops invalid answers while keeping valid ones", () => {
    localStorage.setItem(
      JOURNEY_STORAGE_KEY,
      JSON.stringify({
        current: 2,
        answers: { 1: "Keep", bad: "Drop", 2: "" },
      }),
    );
    const loaded = loadJourney();
    expect(loaded).toEqual({ current: 2, answers: { 1: "Keep" }, songs: {} });
  });

  it("clamps a bad current value back to 1", () => {
    localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify({ current: -5, answers: {} }));
    expect(loadJourney()).toEqual({ current: 1, answers: {}, songs: {} });
  });

  it("clearJourney removes the stored entry", () => {
    saveJourney({ current: 4, answers: { 1: "x" }, songs: {} });
    expect(loadJourney()).not.toBeNull();
    clearJourney();
    expect(loadJourney()).toBeNull();
  });

  it("hasJourneyProgress detects meaningful progress", () => {
    expect(hasJourneyProgress(null)).toBe(false);
    expect(hasJourneyProgress({ current: 1, answers: {}, songs: {} })).toBe(false);
    expect(hasJourneyProgress({ current: 2, answers: {}, songs: {} })).toBe(true);
    expect(hasJourneyProgress({ current: 1, answers: { 1: "x" }, songs: {} })).toBe(true);
  });
});

describe("journey-storage structured Song persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("saves and loads a structured Song round-trip", () => {
    const progress = {
      current: 1,
      answers: { 1: "Upside Down" },
      songs: { 1: song() },
    };
    saveJourney(progress);
    expect(loadJourney()).toEqual(progress);
  });

  it("preserves nullable Song fields (album, artwork, isrc) when present", () => {
    const full = song({
      album: "Sing-A-Longs",
      artworkUrl: "https://example.com/art.jpg",
      isrc: "USCA10123456",
    });
    saveJourney({ current: 1, answers: { 1: full.title }, songs: { 1: full } });
    const loaded = loadJourney();
    expect(loaded?.songs[1]).toEqual(full);
  });

  it("rejects a malformed Song entry (missing artist) and keeps valid ones", () => {
    const valid = song();
    const malformed = {
      provider: "musicbrainz",
      providerId: "x",
      title: "No Artist",
    } as Partial<Song>;
    localStorage.setItem(
      JOURNEY_STORAGE_KEY,
      JSON.stringify({
        current: 1,
        answers: { 1: "Upside Down", 2: "No Artist" },
        songs: { 1: valid, 2: malformed },
      }),
    );
    const loaded = loadJourney();
    expect(loaded?.songs).toEqual({ 1: valid });
    // The malformed entry is dropped; its title string in answers is untouched.
    expect(loaded?.answers[2]).toBe("No Artist");
  });

  it("coerces a Song with non-string nullable fields to null", () => {
    const weird = {
      ...song(),
      album: 123,
      artworkUrl: undefined,
      isrc: null,
    };
    localStorage.setItem(
      JOURNEY_STORAGE_KEY,
      JSON.stringify({ current: 1, answers: { 1: "x" }, songs: { 1: weird } }),
    );
    const loaded = loadJourney();
    expect(loaded?.songs[1]).toEqual({ ...song(), album: null, artworkUrl: null, isrc: null });
  });

  it("isValidSong accepts a full Song and rejects garbage", () => {
    expect(isValidSong(song())).toBe(true);
    expect(isValidSong(null)).toBe(false);
    expect(isValidSong({})).toBe(false);
    expect(isValidSong({ provider: "musicbrainz" })).toBe(false);
    expect(isValidSong({ ...song(), title: "" })).toBe(false);
  });

  it("isValidSong accepts a manual entry with an empty artist (per Song contract)", () => {
    // Manual entries the user did not split into artist + title legitimately
    // carry artist: "" — dropping them on load would lose the selected song and
    // leave a stale title-only answer behind.
    expect(isValidSong({ ...song(), provider: "manual", artist: "" })).toBe(true);
    // artist must still be a string — non-string values are rejected.
    expect(isValidSong({ ...song(), artist: null })).toBe(false);
    expect(isValidSong({ ...song(), artist: undefined })).toBe(false);
  });

  it("round-trips a manual song (empty artist) through localStorage without losing it", () => {
    const manual: Song = {
      provider: "manual",
      providerId: "manual-id",
      title: "My Childhood Song",
      artist: "",
      album: null,
      artworkUrl: null,
      previewUrl: null,
      releaseYear: null,
      genre: null,
      mood: null,
      isrc: null,
    };
    saveJourney({ current: 1, answers: { 1: manual.title }, songs: { 1: manual } });
    const loaded = loadJourney();
    expect(loaded?.songs[1]).toEqual(manual);
  });

  it("returns songs: {} when the stored songs field is absent", () => {
    localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify({ current: 1, answers: { 1: "x" } }));
    expect(loadJourney()?.songs).toEqual({});
  });

  it("preserves the verified flag on round-trip and coerces garbage to absent", () => {
    const verified = song({ provider: "itunes", providerId: "14617433", verified: true });
    saveJourney({ current: 1, answers: { 1: verified.title }, songs: { 1: verified } });
    expect(loadJourney()?.songs[1].verified).toBe(true);

    const garbage = { ...song(), verified: "yes" };
    localStorage.setItem(
      JOURNEY_STORAGE_KEY,
      JSON.stringify({ current: 1, answers: { 1: "x" }, songs: { 1: garbage } }),
    );
    expect(loadJourney()?.songs[1].verified).toBeUndefined();
  });
});

describe("mergeJourneys reconciliation", () => {
  it("returns the non-null side when one is null", () => {
    const a = { current: 2, answers: { 1: "x" }, songs: {} };
    expect(mergeJourneys(a, null)).toEqual(a);
    expect(mergeJourneys(null, a)).toEqual(a);
    expect(mergeJourneys(null, null)).toBeNull();
  });

  it("prefers the snapshot with more answers", () => {
    const smaller = { current: 5, answers: { 1: "x" }, songs: {} };
    const bigger = { current: 1, answers: { 1: "x", 2: "y", 3: "z" }, songs: {} };
    expect(mergeJourneys(smaller, bigger)).toEqual(bigger);
  });

  it("breaks ties toward the higher current", () => {
    const low = { current: 2, answers: { 1: "x" }, songs: {} };
    const high = { current: 5, answers: { 1: "y" }, songs: {} };
    expect(mergeJourneys(low, high)).toEqual(high);
  });

  it("carries the winner's structured songs through the merge", () => {
    const withSongs = {
      current: 1,
      answers: { 1: "Upside Down", 2: "B" },
      songs: { 1: song() },
    };
    const withoutSongs = { current: 1, answers: { 1: "A" }, songs: {} };
    // withSongs has more answers → it wins, and its songs come along.
    expect(mergeJourneys(withoutSongs, withSongs)).toEqual(withSongs);
  });
});
