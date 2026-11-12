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

describe("periodForBand — the card's default period", () => {
  const cases: Array<[string, Period]> = [
    ["Ages 5-9", "childhood"],
    ["Ages 9-12", "childhood"],
    ["Ages 13-17", "teen"],
    ["Ages 18-22", "youth"],
    ["Ages 23-29", "youngAdult"],
    ["Ages 30-39", "youngAdult"],
    ["Ages 40+", "adulthood"],
    ["Now", "now"],
    // Turkish "Now" band and any unparseable band also fall back to "now".
    ["Şimdi", "now"],
    ["", "now"],
  ];

  it.each(cases)("maps %s to %s", (band, expected) => {
    expect(periodForBand(band)).toBe(expected);
  });
});

describe("periodForBand — midpoint threshold boundaries", () => {
  const cases: Array<[string, Period]> = [
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

  it.each(cases)("%s (midpoint at the threshold) maps to %s", (band, expected) => {
    expect(periodForBand(band)).toBe(expected);
  });
});

describe("periodStartYear", () => {
  it("starts a numbered period at birthYear + the band's lower bound", () => {
    expect(periodStartYear("childhood", 1981, 2026)).toBe(1986); // 1981 + 5
    expect(periodStartYear("teen", 1981, 2026)).toBe(1994); // 1981 + 13
    expect(periodStartYear("youth", 1981, 2026)).toBe(1999); // 1981 + 18
    expect(periodStartYear("youngAdult", 1981, 2026)).toBe(2006); // 1981 + 25
    expect(periodStartYear("adulthood", 1981, 2026)).toBe(2021); // 1981 + 40
    expect(periodStartYear("laterLife", 1981, 2026)).toBe(2041); // 1981 + 60
  });

  it("starts 'now' at the current year", () => {
    expect(periodStartYear("now", 1981, 2026)).toBe(2026);
  });
});
