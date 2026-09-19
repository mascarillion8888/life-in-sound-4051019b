// @vitest-environment node
/**
 * moodBackdrop — multi-axis fallback contract tests.
 *
 * The backdrop is now resolved from `decade × genre × mood`. Fallback chain
 * (most specific first), verified in `backdropCandidates` and through
 * `moodBackdropUrl`:
 *   1. <decade>-<genre>-<mood>   2. <decade>-<mood>   3. <genre>-<mood>   4. <mood>
 * A mood with NO file → undefined (caller falls back to its neutral room).
 */
import { describe, expect, it } from "vitest";

import {
  backdropCandidates,
  moodBackdropFilename,
  moodBackdropKey,
  moodBackdropSlug,
  moodBackdropUrl,
} from "./moodBackdrop";

describe("moodBackdrop — fallback contract", () => {
  it("returns undefined for a mood whose file does not exist", () => {
    expect(moodBackdropUrl("Energetic", undefined, undefined, {})).toBeUndefined();
  });

  it("returns undefined for null/undefined mood", () => {
    expect(moodBackdropUrl(null)).toBeUndefined();
    expect(moodBackdropUrl(undefined)).toBeUndefined();
  });

  it("resolves the URL when the file exists in the map", () => {
    const map = { "/src/assets/mood-backdrop-energetic.png": "/assets/mood-backdrop-energetic-abc123.png" };
    expect(moodBackdropUrl("Energetic", undefined, undefined, map)).toBe("/assets/mood-backdrop-energetic-abc123.png");
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

describe("backdropCandidates — multi-axis fallback chain", () => {
  it("full combo first, decade+mood, genre+mood, mood-only last", () => {
    expect(backdropCandidates("Melancholic", "Blues", "1960s")).toEqual([
      "mood-backdrop-1960s-blues-melancholic.png",
      "mood-backdrop-1960s-melancholic.png",
      "mood-backdrop-blues-melancholic.png",
      "mood-backdrop-melancholic.png",
    ]);
  });

  it("genre-only shortens the chain", () => {
    expect(backdropCandidates("Dark", "Metal", undefined)).toEqual([
      "mood-backdrop-metal-dark.png",
      "mood-backdrop-dark.png",
    ]);
  });

  it("decade-only shortens the chain", () => {
    expect(backdropCandidates("Dreamy", undefined, "1970s")).toEqual([
      "mood-backdrop-1970s-dreamy.png",
      "mood-backdrop-dreamy.png",
    ]);
  });

  it("normalizes case and removes spaces/dashes in genre/decade", () => {
    expect(backdropCandidates("Energetic", "Hip-Hop", "1980s")).toEqual([
      "mood-backdrop-1980s-hiphop-energetic.png",
      "mood-backdrop-1980s-energetic.png",
      "mood-backdrop-hiphop-energetic.png",
      "mood-backdrop-energetic.png",
    ]);
  });

  it("mood-only when no genre/decade", () => {
    expect(backdropCandidates("World")).toEqual(["mood-backdrop-world.png"]);
  });
});

describe("moodBackdropUrl — multi-axis resolution through injected map", () => {
  const map = {
    "/src/assets/mood-backdrop-1980s-pop-energetic.png": "/assets/1980s-pop-energetic.png",
    "/src/assets/mood-backdrop-1960s-energetic.png": "/assets/1960s-energetic.png",
    "/src/assets/mood-backdrop-rock-energetic.png": "/assets/rock-energetic.png",
    "/src/assets/mood-backdrop-energetic.png": "/assets/energetic.png",
  };

  it("picks the most specific dec×genre×mood asset", () => {
    expect(moodBackdropUrl("Energetic", "Pop", "1980s", map)).toBe("/assets/1980s-pop-energetic.png");
  });

  it("falls back to dec×mood when the exact trio is absent", () => {
    expect(moodBackdropUrl("Energetic", "Rock", "1960s", map)).toBe("/assets/1960s-energetic.png");
  });

  it("falls back to genre×mood when decade is absent from map", () => {
    expect(moodBackdropUrl("Energetic", "Rock", undefined, map)).toBe("/assets/rock-energetic.png");
  });

  it("ends at plain mood when nothing richer matches", () => {
    expect(moodBackdropUrl("Energetic", "Soul", "1990s", map)).toBe("/assets/energetic.png");
  });
});