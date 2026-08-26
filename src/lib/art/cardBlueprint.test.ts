import { describe, expect, it } from "vitest";

import {
  buildMultidimensionalPrompt,
  cardArtworkSceneForGenre,
  deterministicLore,
  eraDecadeLabel,
  historicalEraYear,
} from "./cardBlueprint";

describe("historicalEraYear", () => {
  it("adds birthYear + encounterAge into the encounter's historical year", () => {
    expect(
      historicalEraYear({
        artist: "Sting",
        songTitle: "Fragile",
        birthYear: 1978,
        encounterAge: 9,
      }),
    ).toBe(1987);
  });

  it("returns null when either dimension is missing", () => {
    expect(
      historicalEraYear({ artist: "Sting", songTitle: "Fragile", birthYear: 1978 }),
    ).toBeNull();
    expect(
      historicalEraYear({ artist: "Sting", songTitle: "Fragile", encounterAge: 9 }),
    ).toBeNull();
    expect(historicalEraYear({ artist: "Sting", songTitle: "Fragile" })).toBeNull();
  });

  it("floors fractional inputs", () => {
    expect(
      historicalEraYear({ artist: "a", songTitle: "b", birthYear: 1980.7, encounterAge: 12.9 }),
    ).toBe(1992);
  });
});

describe("eraDecadeLabel", () => {
  it("prefers the encounter era year over the release year", () => {
    expect(
      eraDecadeLabel({
        artist: "a",
        songTitle: "b",
        birthYear: 1978,
        encounterAge: 9,
        releaseYear: 1965,
      }),
    ).toBe("1980s");
  });

  it("falls back to the release year when the era is unknown", () => {
    expect(eraDecadeLabel({ artist: "a", songTitle: "b", releaseYear: 1994 })).toBe("1990s");
  });

  it("returns null when no year signal exists", () => {
    expect(eraDecadeLabel({ artist: "a", songTitle: "b" })).toBeNull();
  });
});

describe("buildMultidimensionalPrompt", () => {
  it("injects the exact subject blueprint with the encounter age", () => {
    const prompt = buildMultidimensionalPrompt({
      artist: "Sting",
      songTitle: "Fragile",
      birthYear: 1978,
      encounterAge: 9,
      genre: "Gothic Folk",
      releaseYear: 1987,
    });
    expect(prompt).toContain(
      "A silhouette of a child (aged 9) sitting in a wood-panelled bedroom with carved dark furniture wearing over-ear headphones, deeply absorbed in music.",
    );
    expect(prompt).toContain(
      "The child holds and gazes at a vinyl album sleeve: pure abstract typographic design",
    );
    expect(prompt).toContain("evoking Sting's aesthetic");
    expect(prompt).toContain(
      "Dark gothic woodcut engraving style, candlelit chiaroscuro, etched ink textures",
    );
    expect(prompt).toContain("nostalgic 1980s atmospheric room elements");
    expect(prompt).toContain("'Fragile'");
  });

  it("correlates genre to room, lighting and ambient objects", () => {
    const hiphop = buildMultidimensionalPrompt({
      artist: "Kendrick Lamar",
      songTitle: "HUMBLE.",
      genre: "Hip Hop",
      releaseYear: 2017,
    });
    expect(hiphop).toContain("home studio");
    expect(hiphop).toContain("plum glow");
    expect(hiphop).toContain("studio monitors");

    const soul = buildMultidimensionalPrompt({
      artist: "Aretha Franklin",
      songTitle: "Respect",
      genre: "Soul",
      releaseYear: 1967,
    });
    expect(soul).toContain("velvet curtains");
    expect(soul).toContain("amber lamp");
    expect(soul).toContain("turntable");
  });

  it("omits the age clause when encounterAge is unknown", () => {
    const prompt = buildMultidimensionalPrompt({ artist: "a", songTitle: "b" });
    expect(prompt).not.toContain("(aged");
    expect(prompt).toContain("A silhouette of a child sitting in a dimly lit bedroom");
  });

  it("omits the artist echo when the artist name is blank", () => {
    const prompt = buildMultidimensionalPrompt({ artist: "  ", songTitle: "b" });
    expect(prompt).toContain("pure abstract typographic design");
    expect(prompt).not.toContain("evoking");
  });

  it("weaves the user memory into the atmosphere when supplied", () => {
    const prompt = buildMultidimensionalPrompt({
      artist: "a",
      songTitle: "b",
      userMemory: "rain on the window that summer",
    });
    expect(prompt).toContain(
      "Personal memory woven into the scene: rain on the window that summer.",
    );
  });

  it("is deterministic — same encounter, same brief", () => {
    const encounter = {
      artist: "Nirvana",
      songTitle: "Smells Like Teen Spirit",
      genre: "grunge",
      releaseYear: 1991,
    };
    expect(buildMultidimensionalPrompt(encounter)).toBe(buildMultidimensionalPrompt(encounter));
  });

  it("never asks for a painted portrait or card text inside the painting", () => {
    const prompt = buildMultidimensionalPrompt({
      artist: "Sting",
      songTitle: "Fragile",
      genre: "Gothic Folk",
    });
    expect(prompt).not.toContain("framed fine-art portrait");
    expect(prompt).toContain("no photographic face, portrait or human figure");
    expect(prompt).toContain("no painted artist portrait anywhere in the scene");
    expect(prompt).toContain("never draw card titles");
  });
});

describe("cardArtworkSceneForGenre", () => {
  it("maps genre keywords to their scene family", () => {
    expect(cardArtworkSceneForGenre({ artist: "a", songTitle: "b", genre: "Doom Metal" })).toBe(
      "gothic",
    );
    expect(
      cardArtworkSceneForGenre({ artist: "a", songTitle: "b", genre: "East Coast Hip Hop" }),
    ).toBe("hiphop");
    expect(cardArtworkSceneForGenre({ artist: "a", songTitle: "b", genre: "Motown Soul" })).toBe(
      "soul",
    );
  });

  it("soul family wins over jazz when both could match", () => {
    expect(
      cardArtworkSceneForGenre({ artist: "a", songTitle: "b", genre: "soul jazz fusion" }),
    ).toBe("soul");
  });

  it("falls back to the decade ladder on the encounter era year", () => {
    expect(
      cardArtworkSceneForGenre({ artist: "a", songTitle: "b", birthYear: 1960, encounterAge: 5 }),
    ).toBe("jazz");
    expect(
      cardArtworkSceneForGenre({ artist: "a", songTitle: "b", birthYear: 1960, encounterAge: 15 }),
    ).toBe("soul");
    expect(
      cardArtworkSceneForGenre({ artist: "a", songTitle: "b", birthYear: 1975, encounterAge: 20 }),
    ).toBe("grunge");
    expect(
      cardArtworkSceneForGenre({ artist: "a", songTitle: "b", birthYear: 1990, encounterAge: 25 }),
    ).toBe("hiphop");
  });

  it("uses the release year when the era year is unknown, gothic when both are", () => {
    expect(cardArtworkSceneForGenre({ artist: "a", songTitle: "b", releaseYear: 1984 })).toBe(
      "synth",
    );
    expect(cardArtworkSceneForGenre({ artist: "a", songTitle: "b" })).toBe("gothic");
  });
});

describe("deterministicLore", () => {
  it("produces a friendly 2-sentence snippet", () => {
    const lore = deterministicLore({ artist: "Sting", songTitle: "Fragile", encounterAge: 9 });
    const sentences = lore.split(/(?<=[.!?])\s+/).filter(Boolean);
    expect(sentences).toHaveLength(2);
    expect(lore.length).toBeGreaterThan(40);
  });

  it("is track-seeded and stable", () => {
    const a = deterministicLore({ artist: "Sting", songTitle: "Fragile", encounterAge: 9 });
    const b = deterministicLore({ artist: "Sting", songTitle: "Fragile", encounterAge: 9 });
    const c = deterministicLore({ artist: "Sting", songTitle: "Russians", encounterAge: 9 });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
