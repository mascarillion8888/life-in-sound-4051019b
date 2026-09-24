import { describe, expect, it } from "vitest";

import { crisisGuardEnabled, detectCrisisNote, normalizeNote } from "./crisisGuard";

describe("detectCrisisNote", () => {
  it("is case-insensitive and trims whitespace", () => {
    expect(detectCrisisNote("  KILL MYSELF  ")).toBe(true);
    expect(detectCrisisNote("\tSuIcIdAl\n")).toBe(true);
  });

  it("detects explicit English self-harm / suicidal intent", () => {
    expect(detectCrisisNote("i want to kill myself")).toBe(true);
    expect(detectCrisisNote("I keep thinking about suicide")).toBe(true);
    expect(detectCrisisNote("sometimes I wish I wouldn't wake up")).toBe(true);
    expect(detectCrisisNote("i don't want to live anymore")).toBe(true);
    expect(detectCrisisNote("thinking about self-harm")).toBe(true);
    expect(detectCrisisNote("no reason to go on")).toBe(true);
  });

  it("detects explicit Turkish intent", () => {
    expect(detectCrisisNote("intihar etmek istiyorum")).toBe(true);
    expect(detectCrisisNote("kendimi öldürmek istiyorum")).toBe(true);
    expect(detectCrisisNote("yaşamak istemiyorum")).toBe(true);
    expect(detectCrisisNote("canımı yakmak istiyorum")).toBe(true);
  });

  it("detects explicit Spanish intent", () => {
    expect(detectCrisisNote("quiero suicidarme")).toBe(true);
    expect(detectCrisisNote("no quiero seguir viviendo")).toBe(true);
    expect(detectCrisisNote("quiero morir")).toBe(true);
  });

  it("detects explicit German intent", () => {
    expect(detectCrisisNote("ich will mich umbringen")).toBe(true);
    expect(detectCrisisNote("suizid")).toBe(true);
  });

  it("detects explicit French intent", () => {
    expect(detectCrisisNote("je veux me tuer")).toBe(true);
    expect(detectCrisisNote("suicide")).toBe(true);
  });

  it("does NOT trip on melancholy-but-healthy nostalgic notes", () => {
    // The core precision case: heavy sadness without intent must NOT interrupt.
    expect(detectCrisisNote("this song makes me miss my grandmother so much")).toBe(false);
    expect(detectCrisisNote("I was so sad that summer, but music saved me")).toBe(false);
    expect(detectCrisisNote("dark days, but I got through them")).toBe(false);
    expect(detectCrisisNote("bunu dinlerken ağladım ama iyiydim")).toBe(false);
    expect(detectCrisisNote("me transmite mucha nostalgia pero me da fuerzas")).toBe(false);
  });

  it("does NOT trip on the word 'die' in benign musical context", () => {
    expect(detectCrisisNote("this song has a great guitar solo")).toBe(false);
    expect(detectCrisisNote("the beat is killer")).toBe(false);
  });

  it("returns false for empty or whitespace-only input", () => {
    expect(detectCrisisNote("")).toBe(false);
    expect(detectCrisisNote("   ")).toBe(false);
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
