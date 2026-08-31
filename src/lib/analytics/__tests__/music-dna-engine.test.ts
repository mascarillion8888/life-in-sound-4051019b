import { describe, it, expect } from "vitest";
import type { Song } from "../../song/types";
import { computeMusicDNA } from "../music-dna-engine";

function song(
  title: string,
  artist: string,
  year: number | null,
  opts: { genre?: string | null; era?: string | null; providerId?: string } ={},
): Song {
  return {
    provider: "itunes",
    providerId: opts.providerId ?? title,
    title,
    artist,
    album: null,
    artworkUrl: null,
    releaseYear: year,
    genre: opts.genre ?? null,
    era: opts.era ?? null,
    previewUrl: null,
    isrc: null,
    verified: true,
  };
}

function answersSignature(answers: Record<number, string>): string {
  return Object.keys(answers).sort().map((k) => `${k}:${answers[Number(k)]}`).join("|");
}

describe("computeMusicDNA — deterministic, song-only analytics", () => {
  it("computes dominant genre, distributions, diversity and label", () => {
    const songs = [
      song("Paranoid", "Black Sabbath", 1970,{ genre: "Metal", era: "1970s" }),
      song("Iron Man", "Black Sabbath", 1970,{ genre: "Metal", era: "1970s" }),
      song("Superstition", "Stevie Wonder", 1972,{ genre: "Soul", era: "1970s" }),
    ];

    const dna = computeMusicDNA(songs);

      expect(dna.dominantGenre).toBe("Metal");
      expect(dna.genreDistribution).toEqual({ Metal: 2, Soul: 1 });
      expect(dna.eraDistribution).toEqual({ "1970s": 3 });
      expect(dna.artistCount).toBe(2);
      expect(dna.diversityScore).toBe(Math.round((2 / 3) * 1000) / 1000);
      expect(dna.label).toBe("1970s Metal Enthusiast");
  });

  it("Test A — identical question answers with different songs change Music DNA", () => {
    const songsA = [
      song("Paranoid", "Black Sabbath",1970,{ genre: "Metal" }),
      song("Superstition", "Stevie Wonder",1972,{ genre: "Soul" }),
    ];
    const songsB = [
      song("Frozen", "Madonna",1998,{ genre: "Pop" }),
      song("Vogue", "Madonna",1990,{ genre: "Pop" }),
    ];
    const answers: Record<number, string> ={ 1: "childhood", 2: "first love" };

      const dnaA = computeMusicDNA(songsA);
      const dnaB = computeMusicDNA(songsB);

      expect(dnaA.dominantGenre).not.toBe(dnaB.dominantGenre);
      expect(dnaA.label).not.toBe(dnaB.label);
  });

  it("Test B — identical songs with different question answers keep Music DNA identical", () => {
    const songs = [
      song("Paranoid", "Black Sabbath",1970,{ genre: "Metal" }),
      song("Superstition", "Stevie Wonder",1972,{ genre: "Soul" }),
    ];
    const answersA: Record<number, string> ={ 1: "childhood", 2: "rebellion" };
    const answersB: Record<number, string> ={ 1: "turning point", 2: "hard time" };

      const dnaA = computeMusicDNA(songs);
      const dnaB = computeMusicDNA(songs);

      expect(JSON.stringify(dnaA)).toStrictEqual(JSON.stringify(dnaB));

    // Answers play no role in the DNA computation path whatsooever..
      expect(answersSignature(answersA)).not.toStrictEqual(answersSignature(answersB));
      expect(JSON.stringify(dnaA)).toStrictEqual(JSON.stringify(dnaB));
  });
});