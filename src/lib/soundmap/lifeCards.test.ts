import { describe, expect, it } from "vitest";

import {
  buildLifeCards,
  DEFAULT_LIFE_CARD_STRINGS,
  LIFE_CARD_COUNT,
  TR_LIFE_CARD_STRINGS,
} from "./lifeCards";

describe("buildLifeCards", () => {
  it("returns exactly 8 cards with 1-based song indexes", () => {
    const cards = buildLifeCards();
    expect(cards).toHaveLength(LIFE_CARD_COUNT);
    expect(cards.map((c) => c.songIndex)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(cards.map((c) => c.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("is English-first by default", () => {
    const cards = buildLifeCards();
    expect(cards[0].eraTitle).toBe("FIRST SPARK");
    expect(cards[0].ageRange).toBe("Ages 5-9");
    expect(cards[0].typeLine).toBe("Legendary Life Era");
    expect(cards[0].narrative).toBe(DEFAULT_LIFE_CARD_STRINGS.narratives[0]);
  });

  it("uses the built-in Turkish copy for locale tr", () => {
    const cards = buildLifeCards({ locale: "tr" });
    expect(cards[0].eraTitle).toBe("İLK KIVILCIM");
    expect(cards[0].ageRange).toBe("5–9 Yaş");
    expect(cards[0].typeLine).toBe("Efsanevi Hayat Dönemi");
    expect(cards[7].narrative).toBe(TR_LIFE_CARD_STRINGS.narratives[7]);
  });

  it("falls back to English for any non-Turkish locale", () => {
    const cards = buildLifeCards({ locale: "de" });
    expect(cards[2].eraTitle).toBe("REBELLION");
  });

  it("honours a full dictionary override", () => {
    const t = {
      eraTitles: Array.from({ length: 8 }, (_, i) => `ERA ${i}`),
      typeLine: "Custom Type",
    };
    const cards = buildLifeCards({ t });
    expect(cards[3].eraTitle).toBe("ERA 3");
    expect(cards[0].typeLine).toBe("Custom Type");
    // Non-overridden fields stay at the locale base.
    expect(cards[0].narrative).toBe(DEFAULT_LIFE_CARD_STRINGS.narratives[0]);
  });

  it("rejects malformed overrides (wrong array length) and keeps the base", () => {
    const cards = buildLifeCards({ t: { eraTitles: ["ONLY ONE"] } });
    expect(cards[0].eraTitle).toBe("FIRST SPARK");
  });

  it("carries the era stats (intensity/tag/tone) and no fabricated song data", () => {
    const cards = buildLifeCards();
    expect(cards[4]).toMatchObject({ tag: "Strength", tone: "gold", intensity: 0.85 });
    expect(cards[5]).toMatchObject({ tag: "Darkness", tone: "violet", intensity: 0.25 });
    // No song fields exist on the card — nothing to fake.
    expect(cards[0]).not.toHaveProperty("title");
    expect(cards[0]).not.toHaveProperty("artworkUrl");
  });
});
