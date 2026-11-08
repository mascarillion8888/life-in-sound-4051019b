import { describe, expect, it } from "vitest";

import { resolveEncounterAge } from "./encounterAge";

describe("resolveEncounterAge", () => {
  it("(a) uses the real age even when it falls outside the card's band", () => {
    expect(
      resolveEncounterAge({ ageRange: "Ages 5-9", birthYear: 1967, releaseYear: 1987 }),
    ).toEqual({ value: 20, derived: true });
  });

  it("(b) uses the real age when it happens to fit the band too", () => {
    expect(
      resolveEncounterAge({ ageRange: "Ages 5-9", birthYear: 1980, releaseYear: 1987 }),
    ).toEqual({ value: 7, derived: true });
  });

  it("(c) falls back to the band midpoint when the derived age is negative", () => {
    expect(
      resolveEncounterAge({ ageRange: "Ages 18-24", birthYear: 1999, releaseYear: 1987 }),
    ).toEqual({ value: 21, derived: false });
  });

  it("(d) falls back to the band midpoint when birthYear is missing", () => {
    expect(resolveEncounterAge({ ageRange: "Ages 18-24", releaseYear: 1987 })).toEqual({
      value: 21,
      derived: false,
    });
    expect(
      resolveEncounterAge({ ageRange: "Ages 18-24", birthYear: null, releaseYear: 1987 }),
    ).toEqual({ value: 21, derived: false });
  });

  it("(e) falls back to the band midpoint when releaseYear is missing", () => {
    expect(resolveEncounterAge({ ageRange: "Ages 18-24", birthYear: 1967 })).toEqual({
      value: 21,
      derived: false,
    });
    expect(
      resolveEncounterAge({ ageRange: "Ages 18-24", birthYear: 1967, releaseYear: null }),
    ).toEqual({ value: 21, derived: false });
  });

  it("(f) returns null for a band without numbers when no age can be derived", () => {
    expect(resolveEncounterAge({ ageRange: "Now" })).toEqual({ value: null, derived: false });
    expect(resolveEncounterAge({ ageRange: "Şimdi" })).toEqual({ value: null, derived: false });
  });

  it("derives the age even for the open-ended 'Now' band when the years are known", () => {
    expect(resolveEncounterAge({ ageRange: "Now", birthYear: 1990, releaseYear: 2020 })).toEqual({
      value: 30,
      derived: true,
    });
  });

  it("(g) falls back to the band midpoint when the derived age exceeds 100", () => {
    expect(
      resolveEncounterAge({ ageRange: "Ages 40+", birthYear: 1900, releaseYear: 2010 }),
    ).toEqual({ value: 40, derived: false });
  });

  it("accepts the lifetime bounds (0 and 100) as derived ages", () => {
    expect(
      resolveEncounterAge({ ageRange: "Ages 40+", birthYear: 1990, releaseYear: 1990 }),
    ).toEqual({ value: 0, derived: true });
    expect(
      resolveEncounterAge({ ageRange: "Ages 40+", birthYear: 1920, releaseYear: 2020 }),
    ).toEqual({ value: 100, derived: true });
  });
});
