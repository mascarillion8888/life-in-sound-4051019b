import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  verifySongArtwork,
  clearArtworkCache,
  loadCache,
  saveCache,
  songCacheKey,
  isConfidentMatch,
  type CacheValue,
} from "./artworkVerify";
import type { Song } from "./types";

// Mock searchSongsLogic
vi.mock("./searchSong.server", () => ({
  searchSongsLogic: vi.fn(),
}));

const { searchSongsLogic } = await import("./searchSong.server");

const mockManualSong = (overrides: Partial<Song> = {}): Song => ({
  provider: "manual",
  providerId: "manual-1",
  title: "Fragile",
  artist: "Sting",
  album: null,
  artworkUrl: null,
  releaseYear: null,
  previewUrl: null,
  isrc: null,
  ...overrides,
});

const mockVerifiedSong = (overrides: Partial<Song> = {}): Song => ({
  provider: "itunes",
  providerId: "12345",
  title: "Fragile",
  artist: "Sting",
  album: "...Nothing Like the Sun",
  artworkUrl: "https://example.com/art.jpg",
  releaseYear: 1987,
  previewUrl: "https://example.com/preview.m4a",
  isrc: null,
  verified: true,
  ...overrides,
});

describe("artworkVerify", () => {
  beforeEach(() => {
    clearArtworkCache();
    vi.clearAllMocks();
    // Reset localStorage
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  describe("verifySongArtwork", () => {
    it("returns cached patch on cache hit", async () => {
      const song = mockManualSong();
      const patch = {
        artworkUrl: "cached.jpg",
        album: "Cached",
        releaseYear: 1987,
        previewUrl: "preview.m4a",
      };

      // Pre-populate cache with the actual cache key
      const key = songCacheKey(song);
      const cache: Record<string, CacheValue> = { [key]: { kind: "patch", patch, ts: Date.now() } };
      saveCache(cache);

      const result = await verifySongArtwork(song);
      expect(result).toEqual(patch);
      // searchSongsLogic should NOT be called
      expect(searchSongsLogic).not.toHaveBeenCalled();
    });

    it("returns cached patch for verified song with artworkUrl", async () => {
      const song = mockVerifiedSong();

      const result = await verifySongArtwork(song);
      expect(result).toEqual({
        artworkUrl: "https://example.com/art.jpg",
        album: "...Nothing Like the Sun",
        releaseYear: 1987,
        previewUrl: "https://example.com/preview.m4a",
      });
    });

    it("calls iTunes on cache miss and caches successful patch", async () => {
      const song = mockManualSong();

      (searchSongsLogic as any).mockResolvedValue({
        results: [
          {
            wrapperType: "track",
            kind: "song",
            trackId: 12345,
            trackName: "Fragile",
            artistName: "Sting",
            collectionName: "...Nothing Like the Sun",
            artworkUrl100: "https://example.com/100x100/art.jpg",
            releaseDate: "1987-10-12",
            previewUrl: "https://example.com/preview.m4a",
            primaryGenreName: "Rock",
          },
        ],
      });

      const result = await verifySongArtwork(song);
      expect(result).not.toBeNull();
      expect(result?.artworkUrl).toContain("600x600");
      expect(result?.album).toBe("...Nothing Like the Sun");
      expect(result?.releaseYear).toBe(1987);
      expect(searchSongsLogic).toHaveBeenCalledTimes(1);

      // Second call should hit cache
      const result2 = await verifySongArtwork(song);
      expect(result2).toEqual(result);
      expect(searchSongsLogic).toHaveBeenCalledTimes(1); // not called again
    });

    it("returns null and caches no-match for 10 min when iTunes returns no results", async () => {
      const song = mockManualSong();

      (searchSongsLogic as any).mockResolvedValue({ results: [] });

      const result = await verifySongArtwork(song);
      expect(result).toBeNull();

      // Cache should have nomatch entry
      const cache = loadCache();
      const key = Object.keys(cache)[0];
      expect(cache[key]?.kind).toBe("nomatch");
    });

    it("returns null and does NOT cache on network error", async () => {
      const song = mockManualSong();

      (searchSongsLogic as any).mockRejectedValue(new Error("Network error"));

      const result = await verifySongArtwork(song);
      expect(result).toBeNull();

      // Cache should be empty (network errors not cached)
      const cache = loadCache();
      expect(Object.keys(cache).length).toBe(0);
    });

    it("returns null and caches no-match for 10 min when title/artist similarity is weak", async () => {
      const song = mockManualSong({ title: "Fragile", artist: "Sting" });

      // Return a different song (weak match)
      (searchSongsLogic as any).mockResolvedValue({
        results: [
          {
            wrapperType: "track",
            kind: "song",
            trackId: 99999,
            trackName: "Different Song",
            artistName: "Different Artist",
            collectionName: "Some Album",
            artworkUrl100: "https://example.com/art100.jpg",
            releaseDate: "2020-01-01",
            previewUrl: "https://example.com/preview.m4a",
            primaryGenreName: "Pop",
          },
        ],
      });

      const result = await verifySongArtwork(song);
      expect(result).toBeNull();

      // Cache should have nomatch entry
      const cache = loadCache();
      const key = Object.keys(cache)[0];
      expect(cache[key]?.kind).toBe("nomatch");
    });

    it("skips verification when query too short", async () => {
      const song = mockManualSong({ title: "A", artist: "" });

      const result = await verifySongArtwork(song);
      expect(result).toBeNull();
      expect(searchSongsLogic).not.toHaveBeenCalled();
    });
  });

  describe("LRU cache eviction", () => {
    it("evicts oldest entries when exceeding 100", async () => {
      const song = mockManualSong();

      (searchSongsLogic as any).mockResolvedValue({
        results: [
          {
            wrapperType: "track",
            kind: "song",
            trackId: 12345,
            trackName: "Fragile",
            artistName: "Sting",
            collectionName: "...Nothing Like the Sun",
            artworkUrl100: "https://example.com/art100.jpg",
            releaseDate: "1987-10-12",
            previewUrl: "https://example.com/preview.m4a",
            primaryGenreName: "Rock",
          },
        ],
      });

      // Fill cache with 101 different songs
      for (let i = 0; i < 101; i++) {
        const s = mockManualSong({ title: `Song ${i}`, artist: `Artist ${i}` });
        await verifySongArtwork(s);
      }

      const cache = loadCache();
      expect(Object.keys(cache).length).toBeLessThanOrEqual(100);
    });
  });

  describe("no-match TTL expiry", () => {
    it("allows re-verify after 10 minutes", async () => {
      const song = mockManualSong();

      // First call: no match
      (searchSongsLogic as any).mockResolvedValue({ results: [] });
      await verifySongArtwork(song);
      expect(searchSongsLogic).toHaveBeenCalledTimes(1);

      // Second call immediately: should use cached no-match
      const result = await verifySongArtwork(song);
      expect(result).toBeNull();
      expect(searchSongsLogic).toHaveBeenCalledTimes(1);

      // Manually expire the cache entry
      const cache = loadCache();
      const key = Object.keys(cache)[0];
      cache[key] = { kind: "nomatch", ts: Date.now() - 11 * 60 * 1000 }; // 11 min ago
      saveCache(cache);

      // Third call after TTL: should re-verify
      (searchSongsLogic as any).mockResolvedValue({
        results: [
          {
            wrapperType: "track",
            kind: "song",
            trackId: 12345,
            trackName: "Fragile",
            artistName: "Sting",
            collectionName: "...Nothing Like the Sun",
            artworkUrl100: "https://example.com/art100.jpg",
            releaseDate: "1987-10-12",
            previewUrl: "https://example.com/preview.m4a",
            primaryGenreName: "Rock",
          },
        ],
      });

      const result2 = await verifySongArtwork(song);
      expect(result2).not.toBeNull();
      expect(searchSongsLogic).toHaveBeenCalledTimes(2);
    });
  });
});

describe("artworkVerify integration with Journey/Results flow", () => {
  beforeEach(() => {
    clearArtworkCache();
    vi.clearAllMocks();
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("verifies once in Journey, reuses in Results (same cache key)", async () => {
    const song = mockManualSong();

    // Simulate Journey verification
    (searchSongsLogic as any).mockResolvedValue({
      results: [
        {
          wrapperType: "track",
          kind: "song",
          trackId: 12345,
          trackName: "Fragile",
          artistName: "Sting",
          collectionName: "...Nothing Like the Sun",
          artworkUrl100: "https://example.com/art100.jpg",
          releaseDate: "1987-10-12",
          previewUrl: "https://example.com/preview.m4a",
          primaryGenreName: "Rock",
        },
      ],
    });

    const journeyResult = await verifySongArtwork(song);
    expect(journeyResult).not.toBeNull();
    expect(searchSongsLogic).toHaveBeenCalledTimes(1);

    // Simulate Results verification - same song object
    const resultsResult = await verifySongArtwork(song);
    expect(resultsResult).toEqual(journeyResult);
    expect(searchSongsLogic).toHaveBeenCalledTimes(1); // NOT called again
  });

  it("different song with same title but different artist gets different cache key", async () => {
    const song1 = mockManualSong({ title: "Fragile", artist: "Sting" });
    const song2 = mockManualSong({ title: "Fragile", artist: "Someone Else" });

    (searchSongsLogic as any).mockResolvedValue({
      results: [
        {
          wrapperType: "track",
          kind: "song",
          trackId: 12345,
          trackName: "Fragile",
          artistName: "Sting",
          collectionName: "...Nothing Like the Sun",
          artworkUrl100: "https://example.com/art100.jpg",
          releaseDate: "1987-10-12",
          previewUrl: "https://example.com/preview.m4a",
          primaryGenreName: "Rock",
        },
      ],
    });

    await verifySongArtwork(song1);
    await verifySongArtwork(song2);

    // Should be called twice - different cache keys
    expect(searchSongsLogic).toHaveBeenCalledTimes(2);
  });

  it("stale response protection: late response for one artist doesn't apply to another with same title", async () => {
    const song1 = mockManualSong({ title: "Fragile", artist: "Sting" });
    const song2 = mockManualSong({ title: "Fragile", artist: "Someone Else" });
    const key1 = songCacheKey(song1);
    const key2 = songCacheKey(song2);

    expect(key1).not.toBe(key2); // Different cache keys

    // First verify song1 (Sting)
    (searchSongsLogic as any).mockResolvedValueOnce({
      results: [
        {
          wrapperType: "track",
          kind: "song",
          trackId: 12345,
          trackName: "Fragile",
          artistName: "Sting",
          collectionName: "...Nothing Like the Sun",
          artworkUrl100: "https://example.com/100x100/sting.jpg",
          releaseDate: "1987-10-12",
          previewUrl: "https://example.com/preview.m4a",
          primaryGenreName: "Rock",
        },
      ],
    });

    await verifySongArtwork(song1);
    const cache1 = loadCache();
    expect(cache1[key1]?.kind).toBe("patch");
    expect(
      (cache1[key1] as { kind: "patch"; patch: { artworkUrl: string } }).patch.artworkUrl,
    ).toContain("sting");

    // Then verify song2 (Someone Else) - returns different artist
    (searchSongsLogic as any).mockResolvedValueOnce({
      results: [
        {
          wrapperType: "track",
          kind: "song",
          trackId: 99999,
          trackName: "Fragile",
          artistName: "Someone Else",
          collectionName: "Other Album",
          artworkUrl100: "https://example.com/100x100/other.jpg",
          releaseDate: "2020-01-01",
          previewUrl: "https://example.com/preview2.m4a",
          primaryGenreName: "Pop",
        },
      ],
    });

    await verifySongArtwork(song2);
    const cache2 = loadCache();
    expect(cache2[key2]?.kind).toBe("patch");
    expect(
      (cache2[key2] as { kind: "patch"; patch: { artworkUrl: string } }).patch.artworkUrl,
    ).toContain("other");

    // Verify they remain separate
    expect(
      (cache2[key1] as { kind: "patch"; patch: { artworkUrl: string } }).patch.artworkUrl,
    ).toContain("sting");
    expect(
      (cache2[key2] as { kind: "patch"; patch: { artworkUrl: string } }).patch.artworkUrl,
    ).toContain("other");
  });
});
