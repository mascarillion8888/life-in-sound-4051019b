import { describe, expect, it } from "vitest";

import { resolveEncounterAge } from "./encounterAge";

describe("resolveEncounterAge", () => {
  it("(a) uses the real age when it fits the card's band", () => {
    expect(
      resolveEncounterAge({ ageRange: "Ages 18-24", birthYear: 1967, releaseYear: 1987 }),
    ).toBe(20);
  });

  it("(b) falls back to the band when the derived age is negative", () => {
    expect(
      resolveEncounterAge({ ageRange: "Ages 18-24", birthYear: 1999, releaseYear: 1987 }),
    ).toBe(21);
  });

  it("(c) falls back to the band when birthYear is missing", () => {
    expect(resolveEncounterAge({ ageRange: "Ages 18-24", releaseYear: 1987 })).toBe(21);
    expect(
      resolveEncounterAge({ ageRange: "Ages 18-24", birthYear: null, releaseYear: 1987 }),
    ).toBe(21);
  });

  it("(d) falls back to the band when the derived age is outside it", () => {
    expect(resolveEncounterAge({ ageRange: "Ages 5-9", birthYear: 1960, releaseYear: 2000 })).toBe(
      7,
    );
  });

  it("(e) falls back to the band when releaseYear is missing", () => {
    expect(resolveEncounterAge({ ageRange: "Ages 18-24", birthYear: 1967 })).toBe(21);
    expect(
      resolveEncounterAge({ ageRange: "Ages 18-24", birthYear: 1967, releaseYear: null }),
    ).toBe(21);
  });

  it("accepts the derived age within the ±2 tolerance around the band", () => {
    // band 18-24 → accepted window is [16, 26]
    expect(
      resolveEncounterAge({ ageRange: "Ages 18-24", birthYear: 1970, releaseYear: 1986 }),
    ).toBe(16);
    expect(
      resolveEncounterAge({ ageRange: "Ages 18-24", birthYear: 1960, releaseYear: 1986 }),
    ).toBe(26);
  });

  it("rejects a derived age just outside the ±2 tolerance", () => {
    // derived 15 and 27 are outside [16, 26] → band midpoint
    expect(
      resolveEncounterAge({ ageRange: "Ages 18-24", birthYear: 1971, releaseYear: 1986 }),
    ).toBe(21);
    expect(
      resolveEncounterAge({ ageRange: "Ages 18-24", birthYear: 1959, releaseYear: 1986 }),
    ).toBe(21);
  });

  it("never resolves an age over 100", () => {
    // derived 110 — rejected on both the life bound and the band window
    expect(resolveEncounterAge({ ageRange: "Ages 40+", birthYear: 1900, releaseYear: 2010 })).toBe(
      40,
    );
  });

  it("handles the open-ended '40+' band", () => {
    expect(resolveEncounterAge({ ageRange: "Ages 40+", birthYear: 1980, releaseYear: 2021 })).toBe(
      41,
    );
    expect(resolveEncounterAge({ ageRange: "Ages 40+", birthYear: 1980, releaseYear: 2030 })).toBe(
      40,
    );
  });

  it("returns null when the band carries no numbers", () => {
    expect(resolveEncounterAge({ ageRange: "Now", birthYear: 1990, releaseYear: 2020 })).toBeNull();
    expect(
      resolveEncounterAge({ ageRange: "Şimdi", birthYear: 1990, releaseYear: 2020 }),
    ).toBeNull();
  });
});
