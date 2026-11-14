import { describe, expect, it } from "vitest";

import type { JourneyProgress } from "@/lib/journey-storage";
import { buildLifeCards } from "@/lib/soundmap/lifeCards";
import type { Song } from "@/lib/song/types";
import {
  POSTER_MODEL_VERSION,
  POSTER_OUTPUT_SIZE,
  composePosterModel,
  posterModelId,
  providerSafePosterModel,
  type ComposePosterInput,
} from "./posterModel";

const song = (over: Partial<Song> = {}): Song => ({
  provider: "itunes",
  providerId: "1",
  title: "A Song",
  artist: "An Artist",
  album: null,
  artworkUrl: null,
  isrc: null,
  ...over,
});

const progress = (songs: Record<number, Song>): JourneyProgress => ({
  current: 1,
  answers: {},
  songs,
});

/** A rich base input: two cards, both with songs and every optional field set. */
function baseInput(over: Partial<ComposePosterInput> = {}): ComposePosterInput {
  return {
    progress: progress({
      1: song({
        providerId: "1",
        title: "First",
        artist: "Artist One",
        releaseYear: 1987,
        genre: "R&B/Soul",
        mood: "Nostalgic",
        period: "childhood",
      }),
      2: song({
        providerId: "2",
        title: "Second",
        artist: "Artist Two",
        releaseYear: 2004,
        genre: "rock",
        mood: "Euphoric",
        period: "teen",
      }),
    }),
    cards: buildLifeCards(),
    loreLines: { 0: "A lore line", 1: "Another lore line" },
    notes: { 0: "A private note", 1: "  " },
    birthYear: 1980,
    language: "tr",
    ...over,
  };
}

describe("constants", () => {
  it("exposes the approved 2:3 output size and the version tag", () => {
    expect(POSTER_OUTPUT_SIZE).toEqual({ width: 2048, height: 3072 });
    expect(POSTER_MODEL_VERSION).toBe("poster-v1");
  });
});

describe("composePosterModel — ordering", () => {
  it("orders entries by card index even when the cards arrive shuffled", () => {
    const cards = buildLifeCards();
    const model = composePosterModel(baseInput({ cards: [...cards].reverse() }));
    expect(model.entries.map((e) => e.cardIndex)).toEqual([0, 1]);
    expect(model.entries.map((e) => e.track.title)).toEqual(["First", "Second"]);
  });

  it("carries the card's era title as the stage title", () => {
    const model = composePosterModel(baseInput());
    const [first] = model.entries;
    expect(first.stageTitle).toBe(buildLifeCards()[0].eraTitle);
  });
});

describe("composePosterModel — nothing is invented (null, not a guess)", () => {
  // One row per nullable field: the song/lore/note simply does not supply it.
  it.each<[string, ComposePosterInput]>([
    ["releaseYear", baseInput({ progress: progress({ 1: song() }) })],
    ["genre", baseInput({ progress: progress({ 1: song() }) })],
    ["mood", baseInput({ progress: progress({ 1: song() }) })],
    ["period", baseInput({ progress: progress({ 1: song() }) })],
    ["loreLine", baseInput({ loreLines: {} })],
    ["userNote", baseInput({ notes: {} })],
  ])("keeps %s null when the input does not supply it", (field, input) => {
    const [entry] = composePosterModel(input).entries;
    expect(entry[field as keyof typeof entry]).toBeNull();
  });

  it("treats empty/whitespace strings as missing", () => {
    const input = baseInput({
      progress: progress({ 1: song({ genre: "  ", mood: "" }) }),
      loreLines: { 0: "   " },
      notes: { 0: "" },
    });
    const [entry] = composePosterModel(input).entries;
    expect(entry.genre).toBeNull();
    expect(entry.mood).toBeNull();
    expect(entry.loreLine).toBeNull();
    expect(entry.userNote).toBeNull();
  });

  it("derives decade from the release year and stays null without one", () => {
    const withYear = composePosterModel(
      baseInput({ progress: progress({ 1: song({ releaseYear: 1994 }) }) }),
    );
    const withoutYear = composePosterModel(baseInput({ progress: progress({ 1: song() }) }));
    expect(withYear.entries[0].decade).toBe("1990s");
    expect(withoutYear.entries[0].decade).toBeNull();
  });

  it("canonicalises the genre with the existing normalizeGenre mapping", () => {
    const model = composePosterModel(baseInput());
    expect(model.entries[0].genre).toBe("soul"); // "R&B/Soul" → soul
  });

  it("defaults birthYear to null and language to en when absent", () => {
    const model = composePosterModel(baseInput({ birthYear: undefined, language: undefined }));
    expect(model.birthYear).toBeNull();
    expect(model.generatedFromLanguage).toBe("en");
  });
});

describe("composePosterModel — entries without songs are skipped", () => {
  it("returns no entries for an empty journey", () => {
    const model = composePosterModel(baseInput({ progress: progress({}) }));
    expect(model.entries).toEqual([]);
  });

  it("keeps only the questions that actually have a song", () => {
    const model = composePosterModel(
      baseInput({ progress: progress({ 2: song({ title: "Only" }) }) }),
    );
    expect(model.entries.map((e) => e.track.title)).toEqual(["Only"]);
    expect(model.entries.map((e) => e.cardIndex)).toEqual([1]);
  });
});

describe("composePosterModel — determinism", () => {
  it("produces byte-identical JSON for the same input", () => {
    const a = composePosterModel(baseInput());
    const b = composePosterModel(baseInput());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.id).toBe(b.id);
  });

  it("exposes a stable key order (version, outputSize, entries, …)", () => {
    const model = composePosterModel(baseInput());
    expect(Object.keys(model)).toEqual([
      "id",
      "version",
      "outputSize",
      "entries",
      "generatedFromLanguage",
      "birthYear",
    ]);
    expect(Object.keys(model.entries[0])).toEqual([
      "cardIndex",
      "stageTitle",
      "track",
      "releaseYear",
      "period",
      "mood",
      "genre",
      "decade",
      "loreLine",
      "userNote",
      "noteForProvider",
    ]);
  });
});

describe("poster model id — changes when the inputs change", () => {
  const baseId = composePosterModel(baseInput()).id;

  it.each<[string, Partial<ComposePosterInput>]>([
    ["song title", { progress: progress({ 1: song({ title: "Changed" }) }) }],
    ["release year", { progress: progress({ 1: song({ releaseYear: 1999 }) }) }],
    ["mood", { progress: progress({ 1: song({ mood: "Dark" }) }) }],
    ["genre", { progress: progress({ 1: song({ genre: "jazz" }) }) }],
    ["period", { progress: progress({ 1: song({ period: "youth" }) }) }],
    ["lore line", { loreLines: { 0: "Different lore" } }],
    ["user note", { notes: { 0: "Different note" } }],
    ["birth year", { birthYear: 1990 }],
    ["language", { language: "en" }],
  ])("changes the id when %s changes", (_label, over) => {
    expect(composePosterModel(baseInput(over)).id).not.toBe(baseId);
  });

  it("changes the id when POSTER_MODEL_VERSION changes", () => {
    const model = composePosterModel(baseInput());
    const { id: _id, ...rest } = model;
    expect(posterModelId({ ...rest, version: "poster-v2" })).not.toBe(posterModelId(rest));
  });
});

describe("provider-safe view — the user note never leaves", () => {
  it("drops the note key entirely and never carries the note text", () => {
    const model = composePosterModel(baseInput());
    const safe = providerSafePosterModel(model);
    expect(safe.entries[0]).not.toHaveProperty("userNote");
    expect(JSON.stringify(safe)).not.toContain("A private note");
    expect(safe.entries[0].noteForProvider).toBe(false);
  });

  it("stays note-free even when the note is empty or whitespace", () => {
    const model = composePosterModel(baseInput({ notes: { 0: "   ", 1: "" } }));
    const safe = providerSafePosterModel(model);
    for (const entry of safe.entries) {
      expect(entry).not.toHaveProperty("userNote");
    }
  });

  it("keeps every other field intact", () => {
    const model = composePosterModel(baseInput());
    const safe = providerSafePosterModel(model);
    expect(safe.id).toBe(model.id);
    expect(safe.entries[0].track).toEqual(model.entries[0].track);
    expect(safe.entries[0].genre).toBe(model.entries[0].genre);
  });
});
