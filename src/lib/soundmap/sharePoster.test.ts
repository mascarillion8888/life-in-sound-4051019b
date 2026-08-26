import { describe, expect, it } from "vitest";

import type { CardRow } from "@/lib/supabase/cards-remote";

import { discoveryScore, eraCaption, POSTER_H, POSTER_W, wrapText } from "./sharePoster";

function card(overrides: Partial<CardRow> = {}): CardRow {
  return {
    id: "id",
    trackKey: "itunes:123",
    title: "Fragile",
    artist: "Sting",
    genre: null,
    releaseYear: 1987,
    birthYear: 1978,
    encounterAge: 9,
    eraYear: 1987,
    userMemory: null,
    scene: "gothic",
    lore: null,
    imagePath: null,
    createdAt: "2026-08-26T00:00:00Z",
    ...overrides,
  };
}

describe("poster format", () => {
  it("targets the Instagram Story format 1080x1920", () => {
    expect(POSTER_W).toBe(1080);
    expect(POSTER_H).toBe(1920);
  });
});

describe("discoveryScore", () => {
  it("is deterministic and within 40..99", () => {
    const a = discoveryScore("itunes:123");
    expect(a).toBe(discoveryScore("itunes:123"));
    expect(a).toBeGreaterThanOrEqual(40);
    expect(a).toBeLessThan(100);
    expect(discoveryScore("itunes:456")).not.toBe(discoveryScore("itunes:999"));
  });
});

describe("eraCaption", () => {
  it("combines era year and encounter age, uppercased", () => {
    expect(eraCaption(card())).toBe("1987 · AGE 9");
  });

  it("falls back to the release year when era year is unknown", () => {
    expect(eraCaption(card({ eraYear: null, encounterAge: null }))).toBe("1987");
  });

  it("returns empty when no time signal exists", () => {
    expect(eraCaption(card({ eraYear: null, releaseYear: null, encounterAge: null }))).toBe("");
  });
});

describe("wrapText", () => {
  // Fixed-width measure: 1 unit per character.
  const measure = (s: string) => s.length;

  it("wraps greedily within the width", () => {
    const lines = wrapText(measure, "aaa bbb ccc ddd", 7, 4);
    expect(lines).toEqual(["aaa bbb", "ccc ddd"]);
  });

  it("never exceeds maxLines and ellipsizes the overflow", () => {
    const lines = wrapText(measure, "one two three four five six seven eight", 11, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    expect(measure(lines[1])).toBeLessThanOrEqual(11);
  });

  it("keeps short text on one line", () => {
    expect(wrapText(measure, "short", 100, 3)).toEqual(["short"]);
  });

  it("handles empty input", () => {
    expect(wrapText(measure, "", 100, 3)).toEqual([]);
  });
});
