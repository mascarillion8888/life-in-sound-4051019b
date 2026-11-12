import { describe, expect, it } from "vitest";

import { resolveEncounterAge } from "./encounterAge";

/**
 * Stage-first model: the journey's life-stage band is the encounter age, so
 * `value` is always the band midpoint and `derived` is always false. The song's
 * release year only feeds `releasedAtAge` and the `discoveredLater` flag.
 */
describe("resolveEncounterAge (stage-first)", () => {
  const cases: Array<{
    name: string;
    input: { ageRange: string; birthYear?: number | null; releaseYear?: number | null };
    expected: {
      value: number | null;
      releasedAtAge: number | null;
      discoveredLater: boolean;
    };
  }> = [
    {
      name: "born 1981 + 1999 song in the Childhood band: band value wins, no 'Young adult'",
      input: { ageRange: "Ages 5-9", birthYear: 1981, releaseYear: 1999 },
      expected: { value: 7, releasedAtAge: 18, discoveredLater: false },
    },
    {
      name: "born 1981 + 1977 song in the Teen band: released before birth → discovered later",
      input: { ageRange: "Ages 13-17", birthYear: 1981, releaseYear: 1977 },
      expected: { value: 15, releasedAtAge: null, discoveredLater: true },
    },
    {
      name: "born 1981 + 1990 song in the Childhood band: not discovered later",
      input: { ageRange: "Ages 5-9", birthYear: 1981, releaseYear: 1990 },
      expected: { value: 7, releasedAtAge: 9, discoveredLater: false },
    },
    {
      name: "missing birth year: band only, no release-based signals",
      input: { ageRange: "Ages 18-24", releaseYear: 1987 },
      expected: { value: 21, releasedAtAge: null, discoveredLater: false },
    },
    {
      name: "null birth year: band only",
      input: { ageRange: "Ages 18-24", birthYear: null, releaseYear: 1987 },
      expected: { value: 21, releasedAtAge: null, discoveredLater: false },
    },
    {
      name: "missing release year: band only",
      input: { ageRange: "Ages 18-24", birthYear: 1967 },
      expected: { value: 21, releasedAtAge: null, discoveredLater: false },
    },
    {
      name: "'Now' band (no numbers): value null",
      input: { ageRange: "Now" },
      expected: { value: null, releasedAtAge: null, discoveredLater: false },
    },
    {
      name: "'Şimdi' band (no numbers): value null",
      input: { ageRange: "Şimdi" },
      expected: { value: null, releasedAtAge: null, discoveredLater: false },
    },
    {
      name: "'Now' band with both years: still no value, but releasedAtAge is kept",
      input: { ageRange: "Now", birthYear: 1990, releaseYear: 2020 },
      expected: { value: null, releasedAtAge: 30, discoveredLater: false },
    },
    {
      name: "open band '40+': value 40, midpoint of the only number",
      input: { ageRange: "Ages 40+", birthYear: 1900, releaseYear: 2010 },
      expected: { value: 40, releasedAtAge: null, discoveredLater: false },
    },
    {
      name: "releasedAtAge keeps the 0 and 100 lifetime bounds",
      input: { ageRange: "Ages 40+", birthYear: 1990, releaseYear: 1990 },
      expected: { value: 40, releasedAtAge: 0, discoveredLater: true },
    },
  ];

  it.each(cases)("$name", ({ input, expected }) => {
    const result = resolveEncounterAge(input);
    expect(result.value).toBe(expected.value);
    expect(result.derived).toBe(false);
    expect(result.releasedAtAge).toBe(expected.releasedAtAge);
    expect(result.discoveredLater).toBe(expected.discoveredLater);
  });

  it("never marks an age as derived (the band is the source of truth)", () => {
    const inputs: Array<{ ageRange: string; birthYear?: number; releaseYear?: number }> = [
      { ageRange: "Ages 5-9", birthYear: 1967, releaseYear: 1987 },
      { ageRange: "Ages 5-9", birthYear: 1980, releaseYear: 1987 },
      { ageRange: "Ages 40+", birthYear: 1920, releaseYear: 2020 },
    ];
    for (const input of inputs) {
      expect(resolveEncounterAge(input).derived).toBe(false);
    }
  });

  it("accepts the lifetime bounds (0 and 100) as releasedAtAge", () => {
    expect(
      resolveEncounterAge({ ageRange: "Ages 40+", birthYear: 1990, releaseYear: 1990 })
        .releasedAtAge,
    ).toBe(0);
    expect(
      resolveEncounterAge({ ageRange: "Ages 40+", birthYear: 1920, releaseYear: 2020 })
        .releasedAtAge,
    ).toBe(100);
  });

  it("rejects a releasedAtAge outside the 0–100 lifetime range", () => {
    // 1987 - 1999 = -12 (song released before birth).
    expect(
      resolveEncounterAge({ ageRange: "Ages 18-24", birthYear: 1999, releaseYear: 1987 })
        .releasedAtAge,
    ).toBeNull();
    // 2010 - 1900 = 110.
    expect(
      resolveEncounterAge({ ageRange: "Ages 40+", birthYear: 1900, releaseYear: 2010 })
        .releasedAtAge,
    ).toBeNull();
  });

  // The "discovered later" rule is `releaseYear <= birthYear + bandLower - 8`.
  // Teen band (lower 13) with birth year 1981 → threshold 1981 + 13 - 8 = 1986.
  describe("8-year boundary (named constant DISCOVERED_LATER_YEARS)", () => {
    it("flags exactly 8 years before the band start as discovered later", () => {
      expect(
        resolveEncounterAge({ ageRange: "Ages 13-17", birthYear: 1981, releaseYear: 1986 })
          .discoveredLater,
      ).toBe(true);
    });

    it("does not flag 7 years before the band start", () => {
      expect(
        resolveEncounterAge({ ageRange: "Ages 13-17", birthYear: 1981, releaseYear: 1987 })
          .discoveredLater,
      ).toBe(false);
    });

    it("flags any song released before the birth year", () => {
      expect(
        resolveEncounterAge({ ageRange: "Ages 13-17", birthYear: 1981, releaseYear: 1980 })
          .discoveredLater,
      ).toBe(true);
    });
  });
});

/**
 * A listener-chosen period replaces the band: `value` becomes the period's
 * midpoint ("now" resolves to the current age) and the "discovered later"
 * threshold uses the period's start year. The current year is injected so the
 * "now" cases stay deterministic.
 */
describe("resolveEncounterAge (listener-chosen period)", () => {
  const cases: Array<{
    name: string;
    input: {
      ageRange: string;
      birthYear?: number | null;
      releaseYear?: number | null;
      period?: "childhood" | "teen" | "youth" | "youngAdult" | "adulthood" | "laterLife" | "now";
      currentYear?: number;
    };
    expected: {
      value: number | null;
      releasedAtAge: number | null;
      discoveredLater: boolean;
    };
  }> = [
    {
      // The classic example: born 1981, met a 1977 song as a teenager.
      name: "born 1981 + 1977 song, period teen: value 15, discovered later",
      input: { ageRange: "Ages 5-9", birthYear: 1981, releaseYear: 1977, period: "teen" },
      expected: { value: 15, releasedAtAge: null, discoveredLater: true },
    },
    {
      // Same song, but heard now: current age 45 (2026 - 1981). The song
      // predates the birth year, so it is still a later discovery.
      name: "born 1981 + 1977 song, period now: value 45, discovered later (pre-birth)",
      input: {
        ageRange: "Ages 5-9",
        birthYear: 1981,
        releaseYear: 1977,
        period: "now",
        currentYear: 2026,
      },
      expected: { value: 45, releasedAtAge: null, discoveredLater: true },
    },
    {
      // Period childhood (start 1986): 1977 is before birth → discovered later.
      name: "born 1981 + 1977 song, period childhood: value 9, discovered later",
      input: { ageRange: "Now", birthYear: 1981, releaseYear: 1977, period: "childhood" },
      expected: { value: 9, releasedAtAge: null, discoveredLater: true },
    },
    {
      name: "period now without birth year: value null (chip still shows)",
      input: { ageRange: "Ages 5-9", releaseYear: 1977, period: "now", currentYear: 2026 },
      expected: { value: null, releasedAtAge: null, discoveredLater: false },
    },
    {
      name: "a period overrides the band midpoint (Childhood band + youth period)",
      input: { ageRange: "Ages 5-9", period: "youth" },
      expected: { value: 21, releasedAtAge: null, discoveredLater: false },
    },
    {
      name: "period start year drives discovered later: 1998 vs teen start 1994",
      input: { ageRange: "Now", birthYear: 1981, releaseYear: 1998, period: "teen" },
      expected: { value: 15, releasedAtAge: 17, discoveredLater: false },
    },
    {
      name: "period start year drives discovered later: 1985 <= 1994 - 8",
      input: { ageRange: "Now", birthYear: 1981, releaseYear: 1985, period: "teen" },
      expected: { value: 15, releasedAtAge: 4, discoveredLater: true },
    },
    {
      name: "period now uses the current year as its start (no false discovery)",
      input: {
        ageRange: "Ages 40+",
        birthYear: 1981,
        releaseYear: 2020,
        period: "now",
        currentYear: 2026,
      },
      expected: { value: 45, releasedAtAge: 39, discoveredLater: false },
    },
  ];

  it.each(cases)("$name", ({ input, expected }) => {
    const result = resolveEncounterAge(input);
    expect(result.value).toBe(expected.value);
    expect(result.derived).toBe(false);
    expect(result.releasedAtAge).toBe(expected.releasedAtAge);
    expect(result.discoveredLater).toBe(expected.discoveredLater);
  });

  it("falls back to the band when no period is given (signature stays compatible)", () => {
    const band = resolveEncounterAge({
      ageRange: "Ages 13-17",
      birthYear: 1981,
      releaseYear: 1977,
    });
    const withNullPeriod = resolveEncounterAge({
      ageRange: "Ages 13-17",
      birthYear: 1981,
      releaseYear: 1977,
      period: null,
    });
    expect(band).toEqual(withNullPeriod);
    expect(band.value).toBe(15);
  });

  it("uses the real clock for 'now' when currentYear is not injected", () => {
    const result = resolveEncounterAge({ ageRange: "Now", birthYear: 1981, period: "now" });
    expect(result.value).toBe(new Date().getFullYear() - 1981);
  });
});
