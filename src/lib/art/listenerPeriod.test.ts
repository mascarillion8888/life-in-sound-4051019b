import { describe, expect, it } from "vitest";

import {
  MEETING_PROMPT,
  PERIODS,
  availablePeriods,
  currentAgeFor,
  isMetAge,
  isPeriod,
  periodForAge,
  periodForBand,
  periodLabel,
  periodMidpoint,
  periodStartAge,
  periodStartYear,
  suggestedPeriod,
  type Period,
} from "./listenerPeriod";
import { stageLabelForAge } from "./lifeStageLabel";

describe("listenerPeriod", () => {
  it("exposes the nine periods in life order", () => {
    expect(PERIODS).toEqual([
      "childhood",
      "preTeen",
      "teen",
      "youth",
      "youngAdult",
      "adulthood",
      "midlife",
      "laterLife",
      "now",
    ]);
  });

  it("labels each period with the eight stage strings plus Now", () => {
    expect(PERIODS.map(periodLabel)).toEqual([
      "Childhood",
      "Pre-teen",
      "Teen years",
      "Youth",
      "Young adult",
      "Adulthood",
      "Midlife",
      "Later life",
      "Now",
    ]);
  });

  it("exposes the English meeting prompt constant", () => {
    expect(MEETING_PROMPT).toBe("When did you meet it?");
  });

  it("keeps every numbered period's midpoint on its own stage label", () => {
    for (const period of PERIODS) {
      const midpoint = periodMidpoint(period);
      if (midpoint === null) {
        expect(period).toBe("now");
        continue;
      }
      expect(stageLabelForAge(midpoint)).toBe(periodLabel(period));
    }
  });

  it("starts every numbered band at its first age, and 'now' at none", () => {
    const starts: Array<[Period, number | null]> = [
      ["childhood", 0],
      ["preTeen", 10],
      ["teen", 13],
      ["youth", 18],
      ["youngAdult", 23],
      ["adulthood", 30],
      ["midlife", 40],
      ["laterLife", 60],
      ["now", null],
    ];
    for (const [period, start] of starts) {
      expect(periodStartAge(period)).toBe(start);
    }
  });

  it("isPeriod accepts the nine periods and rejects anything else", () => {
    for (const period of PERIODS) expect(isPeriod(period)).toBe(true);
    expect(isPeriod("child")).toBe(false);
    expect(isPeriod("")).toBe(false);
    expect(isPeriod(null)).toBe(false);
    expect(isPeriod(12)).toBe(false);
  });

  it("keeps the previously persisted period values valid (no migration)", () => {
    // The seven periods that existed before this change remain in the set.
    for (const legacy of [
      "childhood",
      "teen",
      "youth",
      "youngAdult",
      "adulthood",
      "laterLife",
      "now",
    ]) {
      expect(isPeriod(legacy)).toBe(true);
    }
  });
});

describe("periodForAge — thresholds at every boundary", () => {
  const cases: Array<[number, Period]> = [
    [0, "childhood"],
    [9, "childhood"],
    [10, "preTeen"],
    [12, "preTeen"],
    [13, "teen"],
    [17, "teen"],
    [18, "youth"],
    [22, "youth"],
    [23, "youngAdult"],
    [29, "youngAdult"],
    [30, "adulthood"],
    [39, "adulthood"],
    [40, "midlife"],
    [59, "midlife"],
    [60, "laterLife"],
    [100, "laterLife"],
  ];

  it.each(cases)("maps age %i to %s", (age, expected) => {
    expect(periodForAge(age)).toBe(expected);
  });
});

describe("periodForBand — card band → period", () => {
  const cases: Array<[string, Period]> = [
    // The 8 default card bands (lifeCards.ts ageRanges).
    ["Ages 5-9", "childhood"],
    ["Ages 9-12", "preTeen"],
    ["Ages 13-17", "teen"],
    ["Ages 18-22", "youth"],
    ["Ages 23-29", "youngAdult"],
    ["Ages 30-39", "adulthood"],
    ["Ages 40+", "midlife"],
    ["Now", "now"],
    // The Turkish "Now" band and any unparseable band also fall back to "now".
    ["Şimdi", "now"],
    ["", "now"],
  ];

  it.each(cases)("maps %s to %s", (band, expected) => {
    expect(periodForBand(band)).toBe(expected);
  });
});

describe("currentAgeFor", () => {
  it("derives the current age from a birth year, else null", () => {
    expect(currentAgeFor(2000, 2026)).toBe(26);
    expect(currentAgeFor(1981, 2026)).toBe(45);
    expect(currentAgeFor(null, 2026)).toBeNull();
    expect(currentAgeFor(undefined, 2026)).toBeNull();
    expect(currentAgeFor(Number.NaN, 2026)).toBeNull();
  });
});

describe("isMetAge — exact meeting age validation", () => {
  it.each([
    [0, true],
    [9, true],
    [100, true],
    [-1, false],
    [101, false],
    [1.5, false],
    [Number.NaN, false],
    [Number.POSITIVE_INFINITY, false],
    ["9", false],
    [null, false],
    [undefined, false],
  ])("isMetAge(%p) is %s", (value, expected) => {
    expect(isMetAge(value)).toBe(expected);
  });
});

describe("availablePeriods — depends on the listener", () => {
  it("offers every period plus Now when the birth year is unknown", () => {
    expect(availablePeriods(null)).toEqual([...PERIODS]);
  });

  const cases: Array<[number, Period[]]> = [
    // 12: start ages <= 12 → childhood(0), preTeen(10) + now.
    [12, ["childhood", "preTeen", "now"]],
    // 26: + teen(13), youth(18), youngAdult(23) + now.
    [26, ["childhood", "preTeen", "teen", "youth", "youngAdult", "now"]],
    // 52: + adulthood(30), midlife(40) + now.
    [52, ["childhood", "preTeen", "teen", "youth", "youngAdult", "adulthood", "midlife", "now"]],
    // 70: all nine.
    [
      70,
      [
        "childhood",
        "preTeen",
        "teen",
        "youth",
        "youngAdult",
        "adulthood",
        "midlife",
        "laterLife",
        "now",
      ],
    ],
  ];

  it.each(cases)("offers only periods starting at or below age %i", (age, expected) => {
    expect(availablePeriods(age)).toEqual(expected);
  });

  it("always includes Now, whatever the age", () => {
    for (const age of [0, 5, 12, 26, 52, 70, 100]) {
      expect(availablePeriods(age)).toContain("now");
    }
  });
});

describe("suggestedPeriod — smart default table", () => {
  const CY = 2026;
  const cases: Array<{
    name: string;
    input: { birthYear?: number | null; releaseYear?: number | null };
    expected: Period | null;
  }> = [
    {
      name: "born 2000 + 1987 song (13 years before birth) → no default",
      input: { birthYear: 2000, releaseYear: 1987 },
      expected: null,
    },
    {
      name: "born 2000 + 2012 song (age 12) → preTeen",
      input: { birthYear: 2000, releaseYear: 2012 },
      expected: "preTeen",
    },
    {
      name: "born 1981 + 1977 song (pre-birth) → no default",
      input: { birthYear: 1981, releaseYear: 1977 },
      expected: null,
    },
    {
      name: "born 1981 + 1999 song (age 18) → youth",
      input: { birthYear: 1981, releaseYear: 1999 },
      expected: "youth",
    },
    {
      name: "born 2000 + 2002 song (age 2, below the floor) → no default",
      input: { birthYear: 2000, releaseYear: 2002 },
      expected: null,
    },
    {
      name: "born 2000 + 2003 song (age 3, at the floor) → childhood",
      input: { birthYear: 2000, releaseYear: 2003 },
      expected: "childhood",
    },
    {
      name: "song newer than the listener's life → no default",
      input: { birthYear: 2000, releaseYear: 2030 },
      expected: null,
    },
    {
      name: "missing birth year → no default",
      input: { birthYear: null, releaseYear: 2012 },
      expected: null,
    },
    {
      name: "missing release year → no default",
      input: { birthYear: 2000, releaseYear: null },
      expected: null,
    },
    {
      name: "both years missing → no default",
      input: { birthYear: null, releaseYear: null },
      expected: null,
    },
  ];

  it.each(cases)("$name", ({ input, expected }) => {
    expect(suggestedPeriod({ ...input, currentYear: CY })).toBe(expected);
  });

  it("never returns an age above the listener's current age", () => {
    // born 2000, current year 2026 → current age 26; a 2012 song → 12.
    expect(suggestedPeriod({ birthYear: 2000, releaseYear: 2012, currentYear: 2026 })).toBe(
      "preTeen",
    );
  });
});

describe("periodStartYear", () => {
  const startCases: Array<[Period, number]> = [
    ["childhood", 1981], // 1981 + 0
    ["preTeen", 1991], // 1981 + 10
    ["teen", 1994], // 1981 + 13
    ["youth", 1999], // 1981 + 18
    ["youngAdult", 2004], // 1981 + 23
    ["adulthood", 2011], // 1981 + 30
    ["midlife", 2021], // 1981 + 40
    ["laterLife", 2041], // 1981 + 60
  ];

  it.each(startCases)("starts %s at birthYear + the band's lower bound", (period, expected) => {
    expect(periodStartYear(period, 1981, 2026)).toBe(expected);
  });

  it("starts 'now' at the current year", () => {
    expect(periodStartYear("now", 1981, 2026)).toBe(2026);
  });
});
