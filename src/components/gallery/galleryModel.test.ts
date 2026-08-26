import { describe, expect, it } from "vitest";

import type { CardRow } from "@/lib/supabase/cards-remote";

import { applyGalleryView, availableScenes, filterCards, sortCards } from "./galleryModel";

function card(id: string, overrides: Partial<CardRow> = {}): CardRow {
  return {
    id,
    trackKey: `key:${id}`,
    title: `Song ${id}`,
    artist: "Artist",
    genre: null,
    releaseYear: null,
    birthYear: null,
    encounterAge: null,
    eraYear: null,
    userMemory: null,
    scene: "gothic",
    lore: null,
    imagePath: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const CARDS: CardRow[] = [
  card("a", { createdAt: "2026-03-01T00:00:00Z", scene: "gothic", eraYear: 1987, encounterAge: 9 }),
  card("b", { createdAt: "2026-01-01T00:00:00Z", scene: "soul", eraYear: 1972, encounterAge: 30 }),
  card("c", { createdAt: "2026-02-01T00:00:00Z", scene: "gothic" }),
];

describe("sortCards", () => {
  it("newest first by default", () => {
    expect(sortCards(CARDS, "newest").map((c) => c.id)).toEqual(["a", "c", "b"]);
  });

  it("oldest first", () => {
    expect(sortCards(CARDS, "oldest").map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("era ascending, unknown eras sink to the end", () => {
    expect(sortCards(CARDS, "era").map((c) => c.id)).toEqual(["b", "a", "c"]);
  });

  it("age ascending, unknown ages sink to the end", () => {
    expect(sortCards(CARDS, "age").map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("never mutates the input", () => {
    const before = CARDS.map((c) => c.id);
    sortCards(CARDS, "oldest");
    expect(CARDS.map((c) => c.id)).toEqual(before);
  });
});

describe("filterCards + availableScenes", () => {
  it("'all' returns everything; a scene id narrows to that scene", () => {
    expect(filterCards(CARDS, "all")).toHaveLength(3);
    expect(filterCards(CARDS, "soul").map((c) => c.id)).toEqual(["b"]);
    expect(filterCards(CARDS, "gothic").map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("lists scenes in first-appearance order without duplicates", () => {
    expect(availableScenes(CARDS)).toEqual(["gothic", "soul"]);
  });

  it("composes filter + sort", () => {
    const view = applyGalleryView(CARDS, "oldest", "gothic");
    expect(view.map((c) => c.id)).toEqual(["c", "a"]);
  });
});
