// @vitest-environment node
/**
 * moodBackdrop — fallback contract tests.
 *
 * No real mood-backdrop-*.png files exist yet. The contract we guarantee now:
 *   1. a mood with NO file → undefined (caller falls back to genre backdrop);
 *   2. a mood whose file DOES exist (injected map) → resolves its URL;
 *   3. null/undefined mood → undefined (pure genre path untouched);
 *   4. mood is case-insensitive (MOOD_SET value "Energetic" → "energetic" file).
 */
import { describe, expect, it } from "vitest";

import {
  moodBackdropFilename,
  moodBackdropKey,
  moodBackdropSlug,
  moodBackdropUrl,
} from "./moodBackdrop";

describe("moodBackdrop — fallback contract (files not present yet)", () => {
  it("returns undefined for a mood whose file does not exist (genre fallback)", () => {
    expect(moodBackdropUrl("Energetic", {})).toBeUndefined();
  });

  it("returns undefined for null/undefined mood (pure genre path)", () => {
    expect(moodBackdropUrl(null, {})).toBeUndefined();
    expect(moodBackdropUrl(undefined, {})).toBeUndefined();
  });

  it("resolves the URL when the file exists in the map", () => {
    const map = { "/src/assets/mood-backdrop-energetic.png": "/assets/mood-backdrop-energetic-abc123.png" };
    expect(moodBackdropUrl("Energetic", map)).toBe("/assets/mood-backdrop-energetic-abc123.png");
  });

  it("is case-insensitive: MOOD_SET value maps to its lowercase file", () => {
    expect(moodBackdropSlug("Melancholic")).toBe("melancholic");
    expect(moodBackdropFilename("Playful")).toBe("mood-backdrop-playful.png");
    expect(moodBackdropKey("Dreamy")).toBe("/src/assets/mood-backdrop-dreamy.png");
  });

  it("resolves all 9 shipped mood files through the real glob map", () => {
    const moods = ["Energetic", "Euphoric", "Playful", "Romantic", "Melancholic", "Dreamy", "Nostalgic", "Dark", "World"];
    for (const m of moods) {
      expect(moodBackdropUrl(m)).toBeDefined();
    }
  });
});