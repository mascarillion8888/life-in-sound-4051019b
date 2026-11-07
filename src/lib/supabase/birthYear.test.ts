import { describe, expect, it } from "vitest";
import { parseBirthYear } from "./birthYear";

const NOW = new Date("2026-10-31T00:00:00Z");

describe("parseBirthYear", () => {
  it("accepts a plain four-digit year", () => {
    expect(parseBirthYear("1985", NOW)).toBe(1985);
    expect(parseBirthYear(" 2001 ", NOW)).toBe(2001);
  });
  it("rejects non-years", () => {
    for (const bad of ["", "85", "19850", "abcd", "19.5", "-1985"]) {
      expect(parseBirthYear(bad, NOW)).toBeNull();
    }
  });
  it("rejects out-of-range years", () => {
    expect(parseBirthYear("1899", NOW)).toBeNull();
    expect(parseBirthYear("2027", NOW)).toBeNull();
    expect(parseBirthYear("2026", NOW)).toBe(2026);
  });
});
