import { describe, expect, it } from "vitest";

import {
  PERIODS,
  isPeriod,
  periodForBand,
  periodLabel,
  periodMidpoint,
  periodStartYear,
  type Period,
} from "./listenerPeriod";
import { stageLabelForAge } from "./lifeStageLabel";

describe("listenerPeriod", () => {
  it("exposes the seven periods in chronological order", () => {
    expect(PERIODS).toEqual([
      "childhood",
      "teen",
      "youth",
      "youngAdult",
      "adulthood",
      "laterLife",
      "now",
    ]);
  });

  it("labels each period with the existing stage strings plus Now", () => {
    expect(PERIODS.map(periodLabel)).toEqual([
      "Childhood",
      "Teen years",
      "Youth",
      "Young adult",
      "Adulthood",
      "Later life",
      "Now",
    ]);
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

  it("isPeriod accepts the seven periods and rejects anything else", () => {
    for (const period of PERIODS) expect(isPeriod(period)).toBe(true);
    expect(isPeriod("child")).toBe(false);
    expect(isPeriod("")).toBe(false);
    expect(isPeriod(null)).toBe(false);
    expect(isPeriod(12)).toBe(false);
  });
});

describe("periodForBand — card default band → period", () => {
  const cases: Array<[string, Period]> = [
    // The 8 default card bands (lifeCards.ts ageRanges).
    ["Ages 5-9", "childhood"],
    ["Ages 9-12", "childhood"],
    ["Ages 13-17", "teen"],
    ["Ages 18-22", "youth"],
    ["Ages 23-29", "youngAdult"],
    ["Ages 30-39", "youngAdult"],
    ["Ages 40+", "adulthood"],
    ["Now", "now"],
    // The Turkish "Now" band and any unparseable band also fall back to "now".
    ["Şimdi", "now"],
    ["", "now"],
    // Midpoint threshold boundaries (<=12, <=17, <=24, <=39, <=59, 60+).
    ["Ages 11-13", "childhood"], // midpoint 12
    ["Ages 12-14", "teen"], // midpoint 13
    ["Ages 16-18", "teen"], // midpoint 17
    ["Ages 17-19", "youth"], // midpoint 18
    ["Ages 23-25", "youth"], // midpoint 24
    ["Ages 24-26", "youngAdult"], // midpoint 25
    ["Ages 38-40", "youngAdult"], // midpoint 39
    ["Ages 39-41", "adulthood"], // midpoint 40
    ["Ages 58-60", "adulthood"], // midpoint 59
    ["Ages 59-61", "laterLife"], // midpoint 60
  ];

  it.each(cases)("maps %s to %s", (band, expected) => {
    expect(periodForBand(band)).toBe(expected);
  });
});

describe("periodStartYear", () => {
  const startCases: Array<[Period, number]> = [
    ["childhood", 1986], // 1981 + 5
    ["teen", 1994], // 1981 + 13
    ["youth", 1999], // 1981 + 18
    ["youngAdult", 2006], // 1981 + 25
    ["adulthood", 2021], // 1981 + 40
    ["laterLife", 2041], // 1981 + 60
  ];

  it.each(startCases)("starts %s at birthYear + the band's lower bound", (period, expected) => {
    expect(periodStartYear(period, 1981, 2026)).toBe(expected);
  });

  it("starts 'now' at the current year", () => {
    expect(periodStartYear("now", 1981, 2026)).toBe(2026);
  });
});
