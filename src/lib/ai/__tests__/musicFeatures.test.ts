/**
 * Music Features Extraction Tests
 *
 * Validates feature extraction, era computation, and metadata validation.
 */

import { describe, it, expect } from "vitest";
import {
  computeEra,
  extractSongFeatures,
  extractSongFeaturesArray,
  getGenreFromSong,
  getMoodFromSong,
  getEraFromSong,
  hasMusicMetadata,
  isCompleteMetadata,
  countMetadataCompletion,
  type SongFeatures,
} from "../../ai/musicFeatures";
import type { Song } from "../../song/types";

// Mock Song helper
function mockSong(overrides: Partial<Song> = {}): Song {
  return {
    provider: "manual",
    providerId: "test-id",
    title: "Test Song",
    artist: "Test Artist",
    album: null,
    artworkUrl: null,
    releaseYear: 2000,
    isrc: null,
    verified: false,
    ...overrides,
  };
}

describe("musicFeatures", () => {
  describe("computeEra", () => {
    it("should compute era for 1970s songs", () => {
      expect(computeEra(1970)).toBe("1970s");
      expect(computeEra(1975)).toBe("1970s");
      expect(computeEra(1979)).toBe("1970s");
    });

    it("should compute era for 1980s songs", () => {
      expect(computeEra(1980)).toBe("1980s");
      expect(computeEra(1985)).toBe("1980s");
      expect(computeEra(1989)).toBe("1980s");
    });

    it("should compute era for 1990s songs", () => {
      expect(computeEra(1990)).toBe("1990s");
      expect(computeEra(1995)).toBe("1990s");
      expect(computeEra(1999)).toBe("1990s");
    });

    it("should compute era for 2000s songs", () => {
      expect(computeEra(2000)).toBe("2000s");
      expect(computeEra(2005)).toBe("2000s");
      expect(computeEra(2009)).toBe("2000s");
    });

    it("should compute era for 2010s songs", () => {
      expect(computeEra(2010)).toBe("2010s");
      expect(computeEra(2015)).toBe("2010s");
      expect(computeEra(2019)).toBe("2010s");
    });

    it("should compute era for 2020s songs", () => {
      expect(computeEra(2020)).toBe("2020s");
      expect(computeEra(2023)).toBe("2020s");
      expect(computeEra(2029)).toBe("2020s");
    });

    it("should handle edge years correctly", () => {
      expect(computeEra(1900)).toBe("1900s");
      expect(computeEra(1969)).toBe("1960s");
      expect(computeEra(2099)).toBe("2090s");
    });
  });

  describe("extractSongFeatures", () => {
    it("should extract features from complete song", () => {
      const song = mockSong({
        title: "Bohemian Rhapsody",
        artist: "Queen",
        releaseYear: 1975,
        genre: "Rock",
        mood: "epic",
      });

      const features = extractSongFeatures(song);

      expect(features).not.toBeNull();
      expect(features?.title).toBe("Bohemian Rhapsody");
      expect(features?.artist).toBe("Queen");
      expect(features?.releaseYear).toBe(1975);
      expect(features?.era).toBe("1970s");
      expect(features?.genre).toBe("Rock");
      expect(features?.mood).toBe("epic");
    });

    it("should handle song with null artist", () => {
      const song = mockSong({
        artist: null,
        title: "Unknown Song",
      });

      const features = extractSongFeatures(song);

      expect(features?.title).toBe("Unknown Song");
      expect(features?.artist).toBeNull();
      expect(features?.releaseYear).toBe(2000);
      expect(features?.era).toBe("2000s");
    });

    it("should handle song with null releaseYear", () => {
      const song = mockSong({
        releaseYear: null,
      });

      const features = extractSongFeatures(song);

      expect(features?.releaseYear).toBeNull();
      expect(features?.era).toBeNull();
    });

    it("should handle song with null genre", () => {
      const song = mockSong({
        genre: undefined,
      });

      const features = extractSongFeatures(song);

      expect(features?.genre).toBeNull();
    });

    it("should handle song with null mood", () => {
      const song = mockSong({
        mood: undefined,
      });

      const features = extractSongFeatures(song);

      expect(features?.mood).toBeNull();
    });

    it("should return null for null song input", () => {
      const features = extractSongFeatures(null);

      expect(features).toBeNull();
    });

    it("should handle minimal song (title only)", () => {
      const song = mockSong({
        title: "Minimal Song",
        artist: null,
        releaseYear: null,
        genre: undefined,
        mood: undefined,
      });

      const features = extractSongFeatures(song);

      expect(features?.title).toBe("Minimal Song");
      expect(features?.artist).toBeNull();
      expect(features?.releaseYear).toBeNull();
      expect(features?.era).toBeNull();
      expect(features?.genre).toBeNull();
      expect(features?.mood).toBeNull();
    });
  });

  describe("extractSongFeaturesArray", () => {
    it("should extract features from array of songs", () => {
      const songs = [
        mockSong({ title: "Song 1", releaseYear: 1980 }),
        mockSong({ title: "Song 2", releaseYear: 1990 }),
        mockSong({ title: "Song 3", releaseYear: 2000 }),
      ];

      const features = extractSongFeaturesArray(songs);

      expect(features).toHaveLength(3);
      expect(features[0].era).toBe("1980s");
      expect(features[1].era).toBe("1990s");
      expect(features[2].era).toBe("2000s");
    });

    it("should filter out null songs", () => {
      const songs: (Song | null)[] = [
        mockSong({ title: "Song 1" }),
        null,
        mockSong({ title: "Song 2" }),
        null,
        mockSong({ title: "Song 3" }),
      ];

      const features = extractSongFeaturesArray(songs);

      expect(features).toHaveLength(3);
      expect(features[0].title).toBe("Song 1");
      expect(features[1].title).toBe("Song 2");
      expect(features[2].title).toBe("Song 3");
    });

    it("should handle array with all nulls", () => {
      const songs: (Song | null)[] = [null, null, null];

      const features = extractSongFeaturesArray(songs);

      expect(features).toHaveLength(0);
    });

    it("should handle empty array", () => {
      const songs: Song[] = [];

      const features = extractSongFeaturesArray(songs);

      expect(features).toHaveLength(0);
    });

    it("should preserve order of non-null songs", () => {
      const songs: (Song | null)[] = [
        mockSong({ title: "A" }),
        null,
        mockSong({ title: "B" }),
        mockSong({ title: "C" }),
        null,
        mockSong({ title: "D" }),
      ];

      const features = extractSongFeaturesArray(songs);

      expect(features.map(f => f.title)).toEqual(["A", "B", "C", "D"]);
    });
  });

  describe("Safe accessors", () => {
    describe("getGenreFromSong", () => {
      it("should extract genre from song", () => {
        const song = mockSong({ genre: "Jazz" });
        expect(getGenreFromSong(song)).toBe("Jazz");
      });

      it("should return null for song without genre", () => {
        const song = mockSong({ genre: undefined });
        expect(getGenreFromSong(song)).toBeNull();
      });

      it("should extract genre from features", () => {
        const features: SongFeatures = {
          title: "Song",
          artist: "Artist",
          releaseYear: 2000,
          era: "2000s",
          genre: "Classical",
          mood: null,
        };
        expect(getGenreFromSong(features)).toBe("Classical");
      });
    });

    describe("getMoodFromSong", () => {
      it("should extract mood from song", () => {
        const song = mockSong({ mood: "melancholic" });
        expect(getMoodFromSong(song)).toBe("melancholic");
      });

      it("should return null for song without mood", () => {
        const song = mockSong({ mood: undefined });
        expect(getMoodFromSong(song)).toBeNull();
      });

      it("should extract mood from features", () => {
        const features: SongFeatures = {
          title: "Song",
          artist: "Artist",
          releaseYear: 2000,
          era: "2000s",
          genre: null,
          mood: "uplifting",
        };
        expect(getMoodFromSong(features)).toBe("uplifting");
      });
    });

    describe("getEraFromSong", () => {
      it("should extract era from song with release year", () => {
        const song = mockSong({ releaseYear: 1985 });
        expect(getEraFromSong(song)).toBe("1980s");
      });

      it("should return null for song without release year", () => {
        const song = mockSong({ releaseYear: null });
        expect(getEraFromSong(song)).toBeNull();
      });
    });
  });

  describe("Metadata validation helpers", () => {
    describe("hasMusicMetadata", () => {
      it("should return true for song with title and artist", () => {
        const song = mockSong({
          title: "Song",
          artist: "Artist",
          releaseYear: null,
        });
        expect(hasMusicMetadata(song)).toBe(true);
      });

      it("should return true for song with title and releaseYear", () => {
        const song = mockSong({
          title: "Song",
          artist: null,
          releaseYear: 2000,
        });
        expect(hasMusicMetadata(song)).toBe(true);
      });

      it("should return true for song with title, artist, and releaseYear", () => {
        const song = mockSong({
          title: "Song",
          artist: "Artist",
          releaseYear: 2000,
        });
        expect(hasMusicMetadata(song)).toBe(true);
      });

      it("should return false for song with only title", () => {
        const song = mockSong({
          title: "Song",
          artist: null,
          releaseYear: null,
        });
        expect(hasMusicMetadata(song)).toBe(false);
      });

      it("should return false for null song", () => {
        expect(hasMusicMetadata(null)).toBe(false);
      });
    });

    describe("isCompleteMetadata", () => {
      it("should return true for song with title, artist, and releaseYear", () => {
        const song = mockSong({
          title: "Song",
          artist: "Artist",
          releaseYear: 2000,
        });
        expect(isCompleteMetadata(song)).toBe(true);
      });

      it("should return false for song missing artist", () => {
        const song = mockSong({
          title: "Song",
          artist: null,
          releaseYear: 2000,
        });
        expect(isCompleteMetadata(song)).toBe(false);
      });

      it("should return false for song missing releaseYear", () => {
        const song = mockSong({
          title: "Song",
          artist: "Artist",
          releaseYear: null,
        });
        expect(isCompleteMetadata(song)).toBe(false);
      });

      it("should return false for song missing title", () => {
        const song = mockSong({
          title: "",
          artist: "Artist",
          releaseYear: 2000,
        });
        expect(isCompleteMetadata(song)).toBe(false);
      });

      it("should return false for null song", () => {
        expect(isCompleteMetadata(null)).toBe(false);
      });
    });

    describe("countMetadataCompletion", () => {
      it("should return 1.0 for all complete metadata", () => {
        const songs = [
          mockSong({ title: "A", artist: "Artist A", releaseYear: 1980 }),
          mockSong({ title: "B", artist: "Artist B", releaseYear: 1990 }),
          mockSong({ title: "C", artist: "Artist C", releaseYear: 2000 }),
        ];

        expect(countMetadataCompletion(songs)).toBe(1.0);
      });

      it("should return 0.5 for half complete metadata", () => {
        const songs = [
          mockSong({ title: "A", artist: "Artist A", releaseYear: 1980 }),
          mockSong({ title: "B", artist: null, releaseYear: 1990 }),
          mockSong({ title: "C", artist: "Artist C", releaseYear: null }),
          mockSong({ title: "D", artist: "Artist D", releaseYear: 2000 }),
        ];

        expect(countMetadataCompletion(songs)).toBe(0.5);
      });

      it("should return 0.0 for no complete metadata", () => {
        const songs = [
          mockSong({ title: "A", artist: null, releaseYear: null }),
          mockSong({ title: "B", artist: "Artist B", releaseYear: null }),
          mockSong({ title: "C", artist: null, releaseYear: 2000 }),
        ];

        expect(countMetadataCompletion(songs)).toBe(0);
      });

      it("should return 0.0 for empty array", () => {
        expect(countMetadataCompletion([])).toBe(0);
      });

      it("should ignore null songs in calculation", () => {
        const songs: (Song | null)[] = [
          mockSong({ title: "A", artist: "Artist A", releaseYear: 1980 }),
          null,
          mockSong({ title: "B", artist: "Artist B", releaseYear: 1990 }),
          null,
        ];

        expect(countMetadataCompletion(songs)).toBe(1.0);
      });

      it("should handle array with only nulls", () => {
        const songs: (Song | null)[] = [null, null, null];

        expect(countMetadataCompletion(songs)).toBe(0);
      });

      it("should calculate 2 complete out of 8 as 0.25", () => {
        const songs = [
          mockSong({ title: "A", artist: "Artist A", releaseYear: 1980 }),
          mockSong({ title: "B", artist: null, releaseYear: null }),
          mockSong({ title: "C", artist: null, releaseYear: null }),
          mockSong({ title: "D", artist: null, releaseYear: null }),
          mockSong({ title: "E", artist: null, releaseYear: null }),
          mockSong({ title: "F", artist: null, releaseYear: null }),
          mockSong({ title: "G", artist: null, releaseYear: null }),
          mockSong({ title: "H", artist: "Artist H", releaseYear: 2000 }),
        ];

        expect(countMetadataCompletion(songs)).toBe(0.25);
      });
    });
  });

  describe("Integration scenarios", () => {
    it("should handle realistic journey with mixed metadata", () => {
      const journeySongs: (Song | null)[] = [
        mockSong({
          title: "Bohemian Rhapsody",
          artist: "Queen",
          releaseYear: 1975,
          genre: "Rock",
        }),
        mockSong({
          title: "Imagine",
          artist: "John Lennon",
          releaseYear: 1971,
          genre: "Rock",
        }),
        mockSong({
          title: "Blinding Lights",
          artist: "The Weeknd",
          releaseYear: 2019,
          genre: "Synthwave",
        }),
        null, // Unanswered question
        mockSong({
          title: "Lose Yourself",
          artist: "Eminem",
          releaseYear: 2002,
          mood: "aggressive",
        }),
        mockSong({
          title: "Mystery Song",
          artist: null,
          releaseYear: null,
        }),
        mockSong({
          title: "Classical Piece",
          genre: "Classical",
        }),
        mockSong({
          title: "No Metadata Song",
        }),
      ];

      const features = extractSongFeaturesArray(journeySongs);
      const completion = countMetadataCompletion(journeySongs);

      expect(features).toHaveLength(7); // Excludes the null
      expect(completion).toBeLessThan(1.0); // Not all complete
      expect(completion).toBeGreaterThan(0); // Some data present
    });

    it("should handle 8-question journey (full user flow)", () => {
      const fullJourney: Song[] = [
        mockSong({
          title: "Q1: Childhood",
          artist: "Artist 1",
          releaseYear: 1990,
        }),
        mockSong({
          title: "Q2: Teenage Years",
          artist: "Artist 2",
          releaseYear: 2000,
        }),
        mockSong({
          title: "Q3: First Love",
          artist: "Artist 3",
          releaseYear: 2005,
        }),
        mockSong({
          title: "Q4: Hard Time",
          artist: "Artist 4",
          releaseYear: 2010,
        }),
        mockSong({
          title: "Q5: Unstoppable",
          artist: "Artist 5",
          releaseYear: 2015,
        }),
        mockSong({
          title: "Q6: Person You Miss",
          artist: "Artist 6",
          releaseYear: 2018,
        }),
        mockSong({
          title: "Q7: Turning Point",
          artist: "Artist 7",
          releaseYear: 2020,
        }),
        mockSong({
          title: "Q8: Remembered By",
          artist: "Artist 8",
          releaseYear: 2023,
        }),
      ];

      const features = extractSongFeaturesArray(fullJourney);
      const completion = countMetadataCompletion(fullJourney);

      expect(features).toHaveLength(8);
      expect(completion).toBe(1.0);
      expect(features.map(f => f.era)).toEqual([
        "1990s",
        "2000s",
        "2000s",
        "2010s",
        "2010s",
        "2010s",
        "2020s",
        "2020s",
      ]);
    });
  });
});
