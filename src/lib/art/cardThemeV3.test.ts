import { describe, expect, it } from "vitest";

import { CARD_MOODS, asCardMood, familyForGenre, resolveCardVars } from "./cardThemeV3";

const SAMPLES: Array<[string, string]> = [
  ["Synth-pop", "synth"],
  ["Metal", "gothic"],
  ["Rock", "grunge"],
  ["Soul", "soul"],
  ["Jazz", "jazz"],
  ["Reggae", "reggae"],
  ["Hip-Hop", "hiphop"],
];

describe("cardThemeV3", () => {
  it("maps genres to families", () => {
    for (const [genre, family] of SAMPLES) expect(familyForGenre(genre)).toBe(family);
  });

  it("falls back to gothic for unknown or empty genres", () => {
    expect(familyForGenre("zzz unknown")).toBe("gothic");
    expect(familyForGenre(null)).toBe("gothic");
    expect(familyForGenre("")).toBe("gothic");
  });

  it("falls back to Nostalgic for unknown moods", () => {
    expect(asCardMood("Dark")).toBe("Dark");
    expect(asCardMood("nope")).toBe("Nostalgic");
    expect(asCardMood(null)).toBe("Nostalgic");
  });

  it("is deterministic", () => {
    expect(resolveCardVars("Jazz", "Dreamy")).toEqual(resolveCardVars("Jazz", "Dreamy"));
  });

  it("fills every token for all 7 families x 9 moods without the old bright-yellow frame", () => {
    for (const [genre] of SAMPLES) {
      for (const mood of CARD_MOODS) {
        const { vars } = resolveCardVars(genre, mood);
        for (const key of ["--frameGradient", "--btn1", "--btn2", "--sub", "--accent", "--bodyBg", "--text", "--badgeBg"]) {
          expect(vars[key as `--${string}`], `${genre}/${mood}/${key}`).toBeTruthy();
        }
        expect(vars["--frameGradient"]).not.toMatch(/f0d878|d4af37/i);
      }
    }
  });

  it("uses neon only for the synth family", () => {
    expect(resolveCardVars("Pop", "Euphoric").neon).toBe(true);
    expect(resolveCardVars("Metal", "Dark").neon).toBe(false);
  });
});