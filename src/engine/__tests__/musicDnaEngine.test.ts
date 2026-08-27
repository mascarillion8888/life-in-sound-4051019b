import { describe, expect, it } from "vitest";
import {
  generateMusicDNA,
  calculateTemporalPattern,
  calculateMusicalIdentity,
} from "../musicDnaEngine";
import type { Song } from "../../lib/song/types";

describe("musicDnaEngine", () => {
  const song = (title: string, artist: string, releaseYear: number, providerId: string): Song => ({
    provider: "itunes",
    providerId,
    title,
    artist,
    album: null,
    artworkUrl: null,
    isrc: null,
    releaseYear,
    verified: true,
  });

  const mockSongs: Song[] = [
    song("Holy Diver", "Dio", 1983, "t1"),
    song("Paranoid", "Black Sabbath", 1970, "t2"),
    song("Rainbow in the Dark", "Dio", 1983, "t3"),
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
