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
    const map = {
      "/src/assets/pop/mood-backdrop-energetic.jpg": "/assets/pop-mood-backdrop-energetic-abc123.jpg",
    };
    expect(moodBackdropUrl("Energetic", undefined, undefined, map)).toBe(
      "/assets/pop-mood-backdrop-energetic-abc123.jpg",
    );
  });

  it("is case-insensitive: MOOD_SET value maps to its lowercase file", () => {
    expect(moodBackdropSlug("Melancholic")).toBe("melancholic");
    expect(moodBackdropFilename("Playful")).toBe("mood-backdrop-playful.jpg");
    expect(moodBackdropKey("Dreamy")).toBe("/src/assets/pop/mood-backdrop-dreamy.jpg");
  });

  it("resolves all 9 shipped mood files through the real glob map", () => {
    const moods = [
      "Energetic",
      "Euphoric",
      "Playful",
      "Romantic",
      "Melancholic",
      "Dreamy",
      "Nostalgic",
      "Dark",
      "World",
    ];
    for (const m of moods) {
      expect(moodBackdropUrl(m)).toBeDefined();
    }
  });
});

describe("backdropCandidates — genre-agnostic neutral mood-wall fallback", () => {
  it("always returns the neutral pop folder's mood file (genre/decade ignored)", () => {
    expect(backdropCandidates("Melancholic", "Blues", "1960s")).toEqual([
      "pop/mood-backdrop-melancholic.jpg",
    ]);
  });

  it("registered genre folders are NOT named here — the registry handles them", () => {
    // Genre-specific selection is the Asset Registry's job; the fallback chain
    // stays genre-agnostic (pop) so metal/jazz/etc. get a real neutral mood wall.
    expect(backdropCandidates("Dark", "Metal", undefined)).toEqual([
      "pop/mood-backdrop-dark.jpg",
    ]);
    expect(backdropCandidates("Dark", "Rock", undefined)).toEqual([
      "pop/mood-backdrop-dark.jpg",
    ]);
  });

  it("decade does not shape the filename anymore", () => {
    expect(backdropCandidates("Dreamy", undefined, "1970s")).toEqual([
      "pop/mood-backdrop-dreamy.jpg",
    ]);
  });

  it("lowercases the mood slug for the file name", () => {
    expect(backdropCandidates("Energetic", "Pop", "1980s")).toEqual([
      "pop/mood-backdrop-energetic.jpg",
    ]);
  });

  it("mood-only when no genre/decade", () => {
    expect(backdropCandidates("World")).toEqual(["pop/mood-backdrop-world.jpg"]);
  });
});

describe("moodBackdropUrl — neutral mood-wall resolution through injected map", () => {
  const map = {
    "/src/assets/pop/mood-backdrop-energetic.jpg": "/assets/pop-mood-backdrop-energetic-abc.jpg",
    "/src/assets/pop/mood-backdrop-dreamy.jpg": "/assets/pop-mood-backdrop-dreamy-abc.jpg",
    "/src/assets/rock/mood-backdrop-energetic.jpg": "/assets/rock-mood-backdrop-energetic-abc.jpg",
  };

  it("resolves the neutral (pop) mood wall regardless of genre/decade", () => {
    expect(moodBackdropUrl("Energetic", "Pop", "1980s", map)).toBe(
      "/assets/pop-mood-backdrop-energetic-abc.jpg",
    );
  });

  it("registered-genre keys are NOT consumed by the genre-agnostic fallback", () => {
    // Genre-specific selection is the registry's job; moodBackdropUrl stays neutral (pop).
    expect(moodBackdropUrl("Energetic", "Rock", "1960s", map)).toBe(
      "/assets/pop-mood-backdrop-energetic-abc.jpg",
    );
  });

  it("returns undefined when the neutral file is absent from the map", () => {
    expect(moodBackdropUrl("World", "Rock", undefined, map)).toBeUndefined();
  });

  it("genre/decade never change the neutral (pop) selection", () => {
    expect(moodBackdropUrl("Dreamy", "Soul", "1990s", map)).toBe(
      "/assets/pop-mood-backdrop-dreamy-abc.jpg",
    );
  });
});
