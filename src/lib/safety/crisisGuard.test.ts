import { describe, expect, it } from "vitest";

import { crisisGuardEnabled, detectCrisisNote, normalizeNote } from "./crisisGuard";

/**
 * Crisis triage tables. Each row is (note, mustTrip). Rows are grouped per
 * language so a newly added language extends the table — it never copies a
 * new describe block (SonarCloud duplication: the previous five per-language
 * `it` blocks repeated the same expect shape).
 */
const CRISIS_CASES: Array<[note: string, mustTrip: boolean]> = [
  // English — explicit self-harm / suicidal intent
  ["i want to kill myself", true],
  ["I keep thinking about suicide", true],
  ["sometimes I wish I wouldn't wake up", true],
  ["i don't want to live anymore", true],
  ["thinking about self-harm", true],
  ["no reason to go on", true],
  // Turkish
  ["intihar etmek istiyorum", true],
  ["kendimi öldürmek istiyorum", true],
  ["yaşamak istemiyorum", true],
  ["canımı yakmak istiyorum", true],
  // Spanish
  ["quiero suicidarme", true],
  ["no quiero seguir viviendo", true],
  ["quiero morir", true],
  // German
  ["ich will mich umbringen", true],
  ["suizid", true],
  // French
  ["je veux me tuer", true],
  ["suicide", true],

  // Precision: melancholy-but-healthy nostalgia must NOT interrupt.
  // The core case: heavy sadness without intent stays in the normal flow.
  ["this song makes me miss my grandmother so much", false],
  ["I was so sad that summer, but music saved me", false],
  ["dark days, but I got through them", false],
  ["bunu dinlerken ağladım ama iyiydim", false],
  ["me transmite mucha nostalgia pero me da fuerzas", false],
  // Benign musical context ("killer", "die" inside other words).
  ["this song has a great guitar solo", false],
  ["the beat is killer", false],
  // Empty / whitespace.
  ["", false],
  ["   ", false],
];

describe("detectCrisisNote", () => {
  it.each(CRISIS_CASES)("%j → %s", (note, mustTrip) => {
    expect(detectCrisisNote(note)).toBe(mustTrip);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(detectCrisisNote("  KILL MYSELF  ")).toBe(true);
    expect(detectCrisisNote("\tSuIcIdAl\n")).toBe(true);
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
