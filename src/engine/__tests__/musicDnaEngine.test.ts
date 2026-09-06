import { describe, expect, it } from "vitest";
import {
  generateMusicDNA,
  calculateTemporalPattern,
  calculateMusicalIdentity,
} from "../musicDnaEngine";
import type { Song } from "../../lib/song/types";

describe("musicDnaEngine", () => {
  const song = (
    title: string,
    artist: string,
    releaseYear: number,
    providerId: string,
    genre: string | null = null,
  ): Song => ({
    provider: "itunes",
    providerId,
    title,
    artist,
    album: null,
    artworkUrl: null,
    isrc: null,
    releaseYear,
    verified: true,
    genre,
  });

  const mockSongs: Song[] = [
    song("Holy Diver", "Dio", 1983, "t1"),
    song("Paranoid", "Black Sabbath", 1970, "t2"),
    song("Rainbow in the Dark", "Dio", 1983, "t3"),
  ];

  // All three songs carry a real (provider-sourced) genre, two of them "Metal".
  const songsWithGenre: Song[] = [
    song("Holy Diver", "Dio", 1983, "g1", "Metal"),
    song("Rainbow in the Dark", "Dio", 1983, "g2", "Metal"),
    song("Paranoid", "Black Sabbath", 1970, "g3", "Rock"),
  ];

  // Only one of three songs carries a real genre — below the 50% trust
  // threshold, so dominantVibe must fall back to the diversity heuristic
  // rather than presenting a shaky genre label as confident.
  const songsWithSparseGenre: Song[] = [
    song("Holy Diver", "Dio", 1983, "s1", "Metal"),
    song("Rainbow in the Dark", "Dio", 1983, "s2", null),
    song("Paranoid", "Black Sabbath", 1970, "s3", null),
  ];

  it("calculateTemporalPattern en eski/yeni yılları ve baskın dönemi doğru hesaplamalı", () => {
    const pattern = calculateTemporalPattern(mockSongs);
    expect(pattern.earliestReleaseYear).toBe(1970);
    expect(pattern.latestReleaseYear).toBe(1983);
    expect(pattern.spanYears).toBe(13);
    expect(pattern.primaryEra).toBe("1980s");
    expect(pattern.eraDistribution["1980s"]).toBe(2);
  });

  it("calculateMusicalIdentity artist çeşitliliği ve baskın vibe skorunu doğru üretmeli", () => {
    const identity = calculateMusicalIdentity(mockSongs);
    expect(identity.topArtists).toContain("Dio");
    expect(identity.topArtists).toContain("Black Sabbath");
    expect(identity.diversityScore).toBe(67); // 2 benzersiz / 3 şarkı = ~67%
    expect(identity.hasVerifiedTracks).toBe(true);
    // Hiçbir şarkıda gerçek genre yok — genre-temelli etiket yerine eski
    // diversity heuristiği kullanılmalı.
    expect(identity.topGenres).toEqual([]);
    expect(identity.genreCoverage).toBe(0);
    expect(identity.dominantVibe).toBe("Focused Nostalgic");
  });

  it("gerçek genre verisi coverage eşiğinin üzerindeyken dominantVibe'a yansımalı", () => {
    const identity = calculateMusicalIdentity(songsWithGenre);
    // Metal 2 kez, Rock 1 kez geçiyor — en sık geçen önce gelmeli.
    expect(identity.topGenres).toEqual(["Metal", "Rock"]);
    expect(identity.genreCoverage).toBe(100);
    expect(identity.dominantVibe).toBe("Metal & Beyond");
  });

  it("genre coverage %50'nin altındayken gerçek genre olsa bile diversity heuristiğine düşmeli", () => {
    const identity = calculateMusicalIdentity(songsWithSparseGenre);
    expect(identity.topGenres).toEqual(["Metal"]);
    expect(identity.genreCoverage).toBe(33); // 1/3 ≈ 33%
    // coverage < 50 → genre etiketine güvenilmez, eski heuristiğe düşülür.
    expect(identity.dominantVibe).toBe("Focused Nostalgic");
  });

  it("generateMusicDNA geçerli şarkılarla isGrounded=true çıktısı vermeli", () => {
    const dna = generateMusicDNA(mockSongs);
    expect(dna.songCount).toBe(3);
    expect(dna.isGrounded).toBe(true);
    expect(dna.temporalPattern.primaryEra).toBe("1980s");
  });

  it("boş şarkı dizisi verildiğinde hata fırlatmalı", () => {
    expect(() => generateMusicDNA([])).toThrow(
      "MusicDNA generation requires at least 1 valid Song input.",
    );
  });
});
