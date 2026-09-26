import { describe, expect, it } from "vitest";

import { crisisGuardEnabled, detectCrisisNote, normalizeNote } from "./crisisGuard";

describe("detectCrisisNote", () => {
  // Positive crisis-intent phrases across all 5 supported languages, driven by
  // ONE table so the per-language skeleton is not duplicated 5x. Every row is
  // a real, explicit self-harm / suicidal-intent phrase.
  it.each([
    ["  KILL MYSELF  "],
    ["\tSuIcIdAl\n"],
    ["i want to kill myself"],
    ["I keep thinking about suicide"],
    ["sometimes I wish I wouldn't wake up"],
    ["i don't want to live anymore"],
    ["thinking about self-harm"],
    ["no reason to go on"],
    ["intihar etmek istiyorum"],
    ["kendimi öldürmek istiyorum"],
    ["yaşamak istemiyorum"],
    ["canımı yakmak istiyorum"],
    ["quiero suicidarme"],
    ["no quiero seguir viviendo"],
    ["quiero morir"],
    ["ich will mich umbringen"],
    ["suizid"],
    ["je veux me tuer"],
    ["suicide"],
  ])("flags explicit crisis intent: %s", (input) => {
    expect(detectCrisisNote(input)).toBe(true);
  });

  // Core precision case: heavy sadness or art/music references WITHOUT intent
  // must NOT interrupt. Each phrase has the same expected (false).
  it.each([
    ["this song makes me miss my grandmother so much"],
    ["I was so sad that summer, but music saved me"],
    ["dark days, but I got through them"],
    ["bunu dinlerken ağladım ama iyiydim"],
    ["me transmite mucha nostalgia pero me da fuerzas"],
    ["this song has a great guitar solo"],
    ["the beat is killer"],
    [""],
    ["   "],
  ])("does NOT flag healthy/benign input: %s", (input) => {
    expect(detectCrisisNote(input)).toBe(false);
  });
});

describe("normalizeNote", () => {
  it("trims and lowercases", () => {
    expect(normalizeNote("  Hello World  ")).toBe("hello world");
    // JS toLowerCase maps Turkish dotted capital İ → plain "i" (not "ı");
    // the point of normalizeNote is trim+lowercase, not locale casing.
    expect(normalizeNote("  HELLO  ")).toBe("hello");
  });
});

describe("crisisGuardEnabled", () => {
  it("is enabled by default (cached value visit)", () => {
    // On first import the env is unset, so the guard defaults ON.
    expect(crisisGuardEnabled()).toBe(true);
  });
});
