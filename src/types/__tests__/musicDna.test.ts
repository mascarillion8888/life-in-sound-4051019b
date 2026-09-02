/**
 * Music DNA Type System Tests
 *
 * Validates the grounded type contracts and fallback behavior.
 */

import { describe, it, expect } from "vitest";
import type { TemporalPattern, MusicalIdentity, MusicDNA } from "../musicDna";
import { FALLBACK_MUSIC_DNA } from "../musicDna";

describe("MusicDNA Types", () => {
  describe("TemporalPattern", () => {
    it("constructs a valid pattern with an era distribution", () => {
      const pattern: TemporalPattern = {
        eraDistribution: { "1970s": 2, "1990s": 3, "2000s": 2, "2020s": 1 },
        earliestReleaseYear: 1973,
        latestReleaseYear: 2022,
        spanYears: 49,
        primaryEra: "1990s",
      };

      expect(Object.keys(pattern.eraDistribution)).toHaveLength(4);
      expect(pattern.primaryEra).toBe("1990s");
      expect(pattern.spanYears).toBe(49);
    });

    it("handles the unknown-year case", () => {
      const pattern: TemporalPattern = {
        eraDistribution: {},
        earliestReleaseYear: 0,
        latestReleaseYear: 0,
        spanYears: 0,
        primaryEra: "Unknown",
      };

      expect(pattern.primaryEra).toBe("Unknown");
      expect(pattern.spanYears).toBe(0);
    });
  });

  describe("MusicalIdentity", () => {
    it("captures artists, diversity and verification", () => {
      const identity: MusicalIdentity = {
        topArtists: ["The Beatles", "Pink Floyd", "David Bowie"],
        diversityScore: 75,
        dominantVibe: "Eclectic Explorer",
        hasVerifiedTracks: true,
      };

      expect(identity.topArtists).toHaveLength(3);
      expect(identity.diversityScore).toBe(75);
      expect(identity.hasVerifiedTracks).toBe(true);
    });
  });

  describe("MusicDNA", () => {
    it("composes temporal and identity analysis", () => {
      const dna: MusicDNA = {
        temporalPattern: {
          eraDistribution: { "1980s": 3 },
          earliestReleaseYear: 1980,
          latestReleaseYear: 1989,
          spanYears: 9,
          primaryEra: "1980s",
        },
        musicalIdentity: {
          topArtists: ["Dio"],
          diversityScore: 33,
          dominantVibe: "Focused Nostalgic",
          hasVerifiedTracks: false,
        },
        genreProfile: {
          dominantGenre: "Heavy Metal",
          secondaryGenres: ["Hard Rock"],
          source: "artist",
        },
        emotionalSignature: {
          dominantMood: "defiant",
          secondaryMoods: ["intense"],
          intensity: 8,
          valency: -0.2,
          energy: 8,
        },
        summary: "Adventurous 1980s Heavy Metal with defiant undertones",
        confidence: 0.38,
        songCount: 3,
        isGrounded: true,
        analyzedAt: "2026-01-01T00:00:00.000Z",
      };

      expect(dna.songCount).toBe(3);
      expect(dna.isGrounded).toBe(true);
      expect(dna.temporalPattern.primaryEra).toBe("1980s");
    });
  });

  describe("FALLBACK_MUSIC_DNA", () => {
    it("is a safe, non-grounded empty analysis", () => {
      expect(FALLBACK_MUSIC_DNA.songCount).toBe(0);
      expect(FALLBACK_MUSIC_DNA.isGrounded).toBe(false);
      expect(FALLBACK_MUSIC_DNA.temporalPattern.primaryEra).toBe("Unknown");
      expect(FALLBACK_MUSIC_DNA.musicalIdentity.topArtists).toEqual([]);
    });
  });
});
