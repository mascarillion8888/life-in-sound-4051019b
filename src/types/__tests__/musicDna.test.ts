/**
 * Music DNA Type System Tests
 *
 * Validates type contracts, fallback behavior, and structural integrity.
 */

import { describe, it, expect } from "vitest";
import type {
  TemporalPattern,
  MusicalIdentity,
  EmotionalSignature,
  MusicDNA,
} from "../musicDna";
import { FALLBACK_MUSIC_DNA } from "../musicDna";

describe("MusicDNA Types", () => {
  describe("TemporalPattern", () => {
    it("should construct valid temporal pattern with full era distribution", () => {
      const pattern: TemporalPattern = {
        eraDistribution: [
          { era: "1970s", count: 2 },
          { era: "1990s", count: 3 },
          { era: "2000s", count: 2 },
          { era: "2020s", count: 1 },
        ],
        earliestYear: 1973,
        latestYear: 2022,
        spanYears: 49,
        dominantEra: "1990s",
      };

      expect(pattern.eraDistribution).toHaveLength(4);
      expect(pattern.dominantEra).toBe("1990s");
      expect(pattern.spanYears).toBe(49);
    });

    it("should handle single era (all same decade)", () => {
      const pattern: TemporalPattern = {
        eraDistribution: [{ era: "2000s", count: 8 }],
        earliestYear: 2001,
        latestYear: 2009,
        spanYears: 8,
        dominantEra: "2000s",
      };

      expect(pattern.dominantEra).toBe("2000s");
      expect(pattern.spanYears).toBe(8);
    });

    it("should handle null years (incomplete metadata)", () => {
      const pattern: TemporalPattern = {
        eraDistribution: [],
        earliestYear: null,
        latestYear: null,
        spanYears: null,
        dominantEra: "Unknown",
      };

      expect(pattern.earliestYear).toBeNull();
      expect(pattern.latestYear).toBeNull();
      expect(pattern.spanYears).toBeNull();
      expect(pattern.dominantEra).toBe("Unknown");
    });

    it("should handle partial year data", () => {
      const pattern: TemporalPattern = {
        eraDistribution: [{ era: "1980s", count: 1 }],
        earliestYear: 1985,
        latestYear: null,
        spanYears: null,
        dominantEra: "1980s",
      };

      expect(pattern.earliestYear).toBe(1985);
      expect(pattern.latestYear).toBeNull();
    });
  });

  describe("MusicalIdentity", () => {
    it("should construct identity with high artist diversity", () => {
      const identity: MusicalIdentity = {
        artistDiversity: 1.0,
        topArtists: [
          { name: "The Beatles", frequency: 1 },
          { name: "Pink Floyd", frequency: 1 },
          { name: "David Bowie", frequency: 1 },
        ],
        dominantGenre: "Rock",
        secondaryGenres: ["Progressive Rock"],
        listeningStyle: "Adventurous (high variety)",
      };

      expect(identity.artistDiversity).toBe(1.0);
      expect(identity.topArtists).toHaveLength(3);
      expect(identity.dominantGenre).toBe("Rock");
    });

    it("should construct identity with low artist diversity (loyal listener)", () => {
      const identity: MusicalIdentity = {
        artistDiversity: 0.125, // 1/8
        topArtists: [{ name: "Taylor Swift", frequency: 8 }],
        dominantGenre: "Pop",
        secondaryGenres: [],
        listeningStyle: "Loyal (single artist focus)",
      };

      expect(identity.artistDiversity).toBe(0.125);
      expect(identity.topArtists[0].frequency).toBe(8);
      expect(identity.secondaryGenres).toHaveLength(0);
    });

    it("should handle mixed diversity (eclectic)", () => {
      const identity: MusicalIdentity = {
        artistDiversity: 0.5, // 4/8
        topArtists: [
          { name: "Artist A", frequency: 2 },
          { name: "Artist B", frequency: 2 },
          { name: "Artist C", frequency: 1 },
        ],
        dominantGenre: "Electronic",
        secondaryGenres: ["Jazz", "Ambient"],
        listeningStyle: "Eclectic",
      };

      expect(identity.artistDiversity).toBe(0.5);
      expect(identity.secondaryGenres).toHaveLength(2);
    });

    it("should handle unknown genre gracefully", () => {
      const identity: MusicalIdentity = {
        artistDiversity: 0.5,
        topArtists: [],
        dominantGenre: "Unknown",
        secondaryGenres: [],
        listeningStyle: "Undefined",
      };

      expect(identity.dominantGenre).toBe("Unknown");
    });
  });

  describe("EmotionalSignature", () => {
    it("should construct emotional signature with full mood profile", () => {
      const signature: EmotionalSignature = {
        dominantMood: "melancholic",
        secondaryMoods: ["introspective", "peaceful"],
        intensity: 8,
        valency: -0.6,
        energy: 3,
      };

      expect(signature.dominantMood).toBe("melancholic");
      expect(signature.secondaryMoods).toHaveLength(2);
      expect(signature.intensity).toBe(8);
      expect(signature.valency).toBeLessThan(0);
      expect(signature.energy).toBeLessThan(5);
    });

    it("should construct uplifting emotional signature", () => {
      const signature: EmotionalSignature = {
        dominantMood: "uplifting",
        secondaryMoods: ["joyful"],
        intensity: 9,
        valency: 0.8,
        energy: 8,
      };

      expect(signature.valency).toBeGreaterThan(0);
      expect(signature.energy).toBeGreaterThan(5);
    });

    it("should handle neutral emotional profile", () => {
      const signature: EmotionalSignature = {
        dominantMood: "Neutral",
        secondaryMoods: [],
        intensity: 0,
        valency: 0,
        energy: 5,
      };

      expect(signature.valency).toBe(0);
      expect(signature.intensity).toBe(0);
      expect(signature.energy).toBe(5);
    });

    it("should respect intensity bounds (1-10)", () => {
      const lowIntensity: EmotionalSignature = {
        dominantMood: "subtle",
        secondaryMoods: [],
        intensity: 2,
        valency: -0.2,
        energy: 4,
      };

      const highIntensity: EmotionalSignature = {
        dominantMood: "overwhelming",
        secondaryMoods: [],
        intensity: 10,
        valency: -0.9,
        energy: 2,
      };

      expect(lowIntensity.intensity).toBeGreaterThanOrEqual(1);
      expect(lowIntensity.intensity).toBeLessThanOrEqual(10);
      expect(highIntensity.intensity).toBeGreaterThanOrEqual(1);
      expect(highIntensity.intensity).toBeLessThanOrEqual(10);
    });

    it("should respect energy bounds (1-10)", () => {
      const lowEnergy: EmotionalSignature = {
        dominantMood: "peaceful",
        secondaryMoods: [],
        intensity: 5,
        valency: 0.3,
        energy: 2,
      };

      const highEnergy: EmotionalSignature = {
        dominantMood: "energetic",
        secondaryMoods: [],
        intensity: 5,
        valency: 0.7,
        energy: 10,
      };

      expect(lowEnergy.energy).toBeGreaterThanOrEqual(1);
      expect(lowEnergy.energy).toBeLessThanOrEqual(10);
      expect(highEnergy.energy).toBeGreaterThanOrEqual(1);
      expect(highEnergy.energy).toBeLessThanOrEqual(10);
    });

    it("should respect valency bounds (-1 to +1)", () => {
      const sadSignature: EmotionalSignature = {
        dominantMood: "sad",
        secondaryMoods: [],
        intensity: 8,
        valency: -0.9,
        energy: 2,
      };

      const happySignature: EmotionalSignature = {
        dominantMood: "joyful",
        secondaryMoods: [],
        intensity: 8,
        valency: 0.9,
        energy: 8,
      };

      expect(sadSignature.valency).toBeGreaterThanOrEqual(-1);
      expect(sadSignature.valency).toBeLessThanOrEqual(1);
      expect(happySignature.valency).toBeGreaterThanOrEqual(-1);
      expect(happySignature.valency).toBeLessThanOrEqual(1);
    });
  });

  describe("MusicDNA", () => {
    it("should construct complete Music DNA with full confidence", () => {
      const dna: MusicDNA = {
        temporal: {
          eraDistribution: [
            { era: "1980s", count: 2 },
            { era: "1990s", count: 3 },
            { era: "2000s", count: 3 },
          ],
          earliestYear: 1982,
          latestYear: 2008,
          spanYears: 26,
          dominantEra: "1990s",
        },
        identity: {
          artistDiversity: 0.75,
          topArtists: [
            { name: "Artist A", frequency: 2 },
            { name: "Artist B", frequency: 1 },
          ],
          dominantGenre: "Rock",
          secondaryGenres: ["Alternative"],
          listeningStyle: "Adventurous (high variety)",
        },
        emotional: {
          dominantMood: "introspective",
          secondaryMoods: ["melancholic"],
          intensity: 6,
          valency: -0.4,
          energy: 5,
        },
        summary: "Adventurous 1990s rock with introspective undertones",
        confidence: 1.0,
        analyzedSongs: 8,
      };

      expect(dna.confidence).toBe(1.0);
      expect(dna.analyzedSongs).toBe(8);
      expect(dna.summary).toContain("1990s");
      expect(dna.summary).toContain("rock");
    });

    it("should construct partial Music DNA with lower confidence", () => {
      const dna: MusicDNA = {
        temporal: {
          eraDistribution: [{ era: "2000s", count: 4 }],
          earliestYear: 2001,
          latestYear: 2009,
          spanYears: 8,
          dominantEra: "2000s",
        },
        identity: {
          artistDiversity: 0.5,
          topArtists: [{ name: "Artist A", frequency: 2 }],
          dominantGenre: "Electronic",
          secondaryGenres: [],
          listeningStyle: "Eclectic",
        },
        emotional: {
          dominantMood: "energetic",
          secondaryMoods: [],
          intensity: 7,
          valency: 0.6,
          energy: 7,
        },
        summary: "Eclectic 2000s electronic with energetic undertones",
        confidence: 0.5, // 4/8
        analyzedSongs: 4,
      };

      expect(dna.confidence).toBe(0.5);
      expect(dna.analyzedSongs).toBe(4);
    });

    it("should construct minimum viable Music DNA", () => {
      const dna: MusicDNA = {
        temporal: {
          eraDistribution: [{ era: "2020s", count: 1 }],
          earliestYear: 2023,
          latestYear: 2023,
          spanYears: 0,
          dominantEra: "2020s",
        },
        identity: {
          artistDiversity: 1.0,
          topArtists: [{ name: "Current Artist", frequency: 1 }],
          dominantGenre: "Pop",
          secondaryGenres: [],
          listeningStyle: "Adventurous (high variety)",
        },
        emotional: {
          dominantMood: "neutral",
          secondaryMoods: [],
          intensity: 1,
          valency: 0,
          energy: 5,
        },
        summary: "Adventurous 2020s pop with neutral undertones",
        confidence: 0.125, // 1/8
        analyzedSongs: 1,
      };

      expect(dna.confidence).toBe(0.125);
      expect(dna.analyzedSongs).toBe(1);
    });
  });

  describe("FALLBACK_MUSIC_DNA", () => {
    it("should provide safe defaults for all fields", () => {
      expect(FALLBACK_MUSIC_DNA.confidence).toBe(0);
      expect(FALLBACK_MUSIC_DNA.analyzedSongs).toBe(0);
      expect(FALLBACK_MUSIC_DNA.summary).toBe("No songs analyzed");
    });

    it("should have neutral emotional profile", () => {
      expect(FALLBACK_MUSIC_DNA.emotional.dominantMood).toBe("Neutral");
      expect(FALLBACK_MUSIC_DNA.emotional.intensity).toBe(0);
      expect(FALLBACK_MUSIC_DNA.emotional.valency).toBe(0);
      expect(FALLBACK_MUSIC_DNA.emotional.energy).toBe(5);
    });

    it("should have unknown/undefined identity", () => {
      expect(FALLBACK_MUSIC_DNA.identity.dominantGenre).toBe("Unknown");
      expect(FALLBACK_MUSIC_DNA.identity.listeningStyle).toBe("Undefined");
      expect(FALLBACK_MUSIC_DNA.identity.topArtists).toHaveLength(0);
    });

    it("should have empty temporal distribution", () => {
      expect(FALLBACK_MUSIC_DNA.temporal.eraDistribution).toHaveLength(0);
      expect(FALLBACK_MUSIC_DNA.temporal.earliestYear).toBeNull();
      expect(FALLBACK_MUSIC_DNA.temporal.latestYear).toBeNull();
      expect(FALLBACK_MUSIC_DNA.temporal.spanYears).toBeNull();
      expect(FALLBACK_MUSIC_DNA.temporal.dominantEra).toBe("Unknown");
    });

    it("should be a safe default without throwing", () => {
      expect(() => {
        const dna = FALLBACK_MUSIC_DNA;
        // Simulate downstream code that uses the fallback
        const summary = dna.summary.toLowerCase();
        const confidence = dna.confidence * 100;
        return { summary, confidence };
      }).not.toThrow();
    });
  });

  describe("Type contracts and serialization", () => {
    it("should serialize complete Music DNA to JSON", () => {
      const dna: MusicDNA = {
        temporal: {
          eraDistribution: [{ era: "1990s", count: 3 }],
          earliestYear: 1991,
          latestYear: 1999,
          spanYears: 8,
          dominantEra: "1990s",
        },
        identity: {
          artistDiversity: 0.67,
          topArtists: [{ name: "Nirvana", frequency: 2 }],
          dominantGenre: "Grunge",
          secondaryGenres: ["Alternative Rock"],
          listeningStyle: "Eclectic",
        },
        emotional: {
          dominantMood: "melancholic",
          secondaryMoods: ["aggressive"],
          intensity: 7,
          valency: -0.5,
          energy: 7,
        },
        summary: "Eclectic 1990s grunge with melancholic undertones",
        confidence: 0.75,
        analyzedSongs: 6,
      };

      const json = JSON.stringify(dna);
      expect(json).toBeTruthy();

      const parsed = JSON.parse(json) as MusicDNA;
      expect(parsed.confidence).toBe(0.75);
      expect(parsed.summary).toBe("Eclectic 1990s grunge with melancholic undertones");
    });

    it("should deserialize fallback without data loss", () => {
      const json = JSON.stringify(FALLBACK_MUSIC_DNA);
      const parsed = JSON.parse(json) as MusicDNA;

      expect(parsed.confidence).toBe(0);
      expect(parsed.analyzedSongs).toBe(0);
      expect(parsed.summary).toBe("No songs analyzed");
    });
  });
});
