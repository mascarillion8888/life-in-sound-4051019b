import { describe, expect, it } from "vitest";

import { resolveEncounterAge } from "./encounterAge";
import type { Period } from "./listenerPeriod";

/**
 * The meeting-age model: a card's life moment is WHEN THE LISTENER MET THE SONG.
 * `value` is the exact `metAge` when given, else the chosen/defaulted period's
 * midpoint clamped to the listener's current age ("now" → the current age),
 * else null — never invented. The current year is injected so "now" and every
 * derived value stay deterministic.
 */
describe("resolveEncounterAge (meeting-age model)", () => {
  const CY = 2026;

  const cases: Array<{
    name: string;
    input: {
      metAge?: number | null;
      period?: Period | null;
      birthYear?: number | null;
      releaseYear?: number | null;
    };
    expected: {
      value: number | null;
      releasedAtAge: number | null;
      discoveredLater: boolean;
    };
  }> = [
    {
      name: "exact metAge wins over the period and the midpoint",
      input: { metAge: 9, period: "teen", birthYear: 2000, releaseYear: 1987 },
      expected: { value: 9, releasedAtAge: null, discoveredLater: true },
    },
    {
      name: "born 1981 + metAge 14, 1984 song: value 14, discovered later (1984 ≤ 1987)",
      input: { metAge: 14, birthYear: 1981, releaseYear: 1984 },
      expected: { value: 14, releasedAtAge: 3, discoveredLater: true },
    },
    {
      name: "born 1981 + metAge 14, 1990 song: value 14, not discovered later",
      input: { metAge: 14, birthYear: 1981, releaseYear: 1990 },
      expected: { value: 14, releasedAtAge: 9, discoveredLater: false },
    },
    {
      name: "period childhood → midpoint 5",
      input: { period: "childhood", birthYear: 2000 },
      expected: { value: 5, releasedAtAge: null, discoveredLater: false },
    },
    {
      name: "period teen → midpoint 15",
      input: { period: "teen", birthYear: 1981 },
      expected: { value: 15, releasedAtAge: null, discoveredLater: false },
    },
    {
      name: "period now → the current age (2026 - 1981 = 45)",
      input: { period: "now", birthYear: 1981 },
      expected: { value: 45, releasedAtAge: null, discoveredLater: false },
    },
    {
      name: "period now without a birth year → no age",
      input: { period: "now" },
      expected: { value: null, releasedAtAge: null, discoveredLater: false },
    },
    {
      name: "no period and no metAge → null (never invented)",
      input: { birthYear: 2000, releaseYear: 1987 },
      expected: { value: null, releasedAtAge: null, discoveredLater: false },
    },
    {
      name: "period midpoint above the current age is clamped to the current age",
      // born 2000 → current age 26; the midlife midpoint (50) clamps to 26.
      input: { period: "midlife", birthYear: 2000 },
      expected: { value: 26, releasedAtAge: null, discoveredLater: false },
    },
    {
      name: "missing birth year: the period midpoint still resolves",
      input: { period: "teen", releaseYear: 1987 },
      expected: { value: 15, releasedAtAge: null, discoveredLater: false },
    },
    {
      name: "releasedAtAge keeps the 0 and 100 lifetime bounds",
      input: { metAge: 40, birthYear: 1990, releaseYear: 1990 },
      expected: { value: 40, releasedAtAge: 0, discoveredLater: true },
    },
  ];

  it.each(cases)("$name", ({ input, expected }) => {
    const result = resolveEncounterAge({
      metAge: input.metAge,
      period: input.period,
      birthYear: input.birthYear,
      releaseYear: input.releaseYear,
      currentYear: CY,
    });
    expect(result.value).toBe(expected.value);
    expect(result.releasedAtAge).toBe(expected.releasedAtAge);
    expect(result.discoveredLater).toBe(expected.discoveredLater);
  });

  it("marks a period-derived age as derived, and a metAge as not derived", () => {
    expect(resolveEncounterAge({ period: "teen", currentYear: CY }).derived).toBe(true);
    expect(resolveEncounterAge({ metAge: 14, currentYear: CY }).derived).toBe(false);
    expect(resolveEncounterAge({ currentYear: CY }).derived).toBe(false);
  });

  it("rejects a releasedAtAge outside the 0–100 lifetime range", () => {
    // 1987 - 1999 = -12 (song released before birth).
    expect(
      resolveEncounterAge({ metAge: 18, birthYear: 1999, releaseYear: 1987, currentYear: CY })
        .releasedAtAge,
    ).toBeNull();
    // 2010 - 1900 = 110.
    expect(
      resolveEncounterAge({ metAge: 40, birthYear: 1900, releaseYear: 2010, currentYear: CY })
        .releasedAtAge,
    ).toBeNull();
  });

  it("uses the real clock for 'now' when currentYear is not injected", () => {
    const result = resolveEncounterAge({ period: "now", birthYear: 1981 });
    expect(result.value).toBe(new Date().getFullYear() - 1981);
  });

  it("ignores an invalid metAge (falls back to the period)", () => {
    expect(resolveEncounterAge({ metAge: -1, period: "teen", currentYear: CY }).value).toBe(15);
    expect(resolveEncounterAge({ metAge: 1.5, period: "teen", currentYear: CY }).value).toBe(15);
    expect(resolveEncounterAge({ metAge: Number.NaN, period: "teen", currentYear: CY }).value).toBe(
      15,
    );
    expect(resolveEncounterAge({ metAge: 101, period: "teen", currentYear: CY }).value).toBe(15);
  });
});

/**
 * The "discovered later" rule: `releaseYear <= meetingYear - 8`, or the song
 * predates the birth year. The meeting year is birthYear + metAge, the period's
 * start year, or the current year for "now".
 */
describe("resolveEncounterAge — discoveredLater", () => {
  const CY = 2026;
  const cases: Array<{
    name: string;
    input: {
      metAge?: number | null;
      period?: Period | null;
      birthYear?: number | null;
      releaseYear?: number | null;
    };
    expected: boolean;
  }> = [
    {
      // meeting year = 1981 + 14 = 1995; 1995 - 8 = 1987.
      name: "born 1981 + metAge 14, 1987 song: exactly 8 years before → true",
      input: { metAge: 14, birthYear: 1981, releaseYear: 1987 },
      expected: true,
    },
    {
      name: "born 1981 + metAge 14, 1988 song: 7 years before → false",
      input: { metAge: 14, birthYear: 1981, releaseYear: 1988 },
      expected: false,
    },
    {
      name: "song released before the birth year → true",
      input: { metAge: 14, birthYear: 1981, releaseYear: 1980 },
      expected: true,
    },
    {
      // period teen starts 1994; 1994 - 8 = 1986.
      name: "period teen (start 1994), 1986 song → true",
      input: { period: "teen", birthYear: 1981, releaseYear: 1986 },
      expected: true,
    },
    {
      name: "period teen (start 1994), 1987 song → false",
      input: { period: "teen", birthYear: 1981, releaseYear: 1987 },
      expected: false,
    },
    {
      name: "period now, a recent song → false",
      input: { period: "now", birthYear: 1981, releaseYear: 2020 },
      expected: false,
    },
    {
      name: "no meeting stated → false (nothing to compare)",
      input: { birthYear: 1981, releaseYear: 1977 },
      expected: false,
    },
    {
      name: "no release year → false",
      input: { metAge: 14, birthYear: 1981, releaseYear: null },
      expected: false,
    },
  ];

  it.each(cases)("$name", ({ input, expected }) => {
    const result = resolveEncounterAge({
      metAge: input.metAge,
      period: input.period,
      birthYear: input.birthYear,
      releaseYear: input.releaseYear,
      currentYear: CY,
    });
    expect(result.discoveredLater).toBe(expected);
  });

  it("marks a 'now' meeting of a pre-birth song as discovered later", () => {
    const result = resolveEncounterAge({
      period: "now",
      birthYear: 1981,
      releaseYear: 1977,
      currentYear: CY,
    });
    expect(result.value).toBe(45);
    expect(result.discoveredLater).toBe(true);
  });
});
