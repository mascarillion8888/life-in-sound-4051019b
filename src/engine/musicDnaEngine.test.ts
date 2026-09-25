import { describe, expect, it } from "vitest";
import { calculateMusicalIdentity, generateMusicDNA } from "./musicDnaEngine";
import type { Song } from "@/lib/song/types";

const song = (overrides: Partial<Song> & { title: string }): Song => ({
  provider: "itunes",
  providerId: "x",
  artist: "Artist",
  album: null,
  artworkUrl: null,
  isrc: null,
  ...overrides,
});

describe("calculateMusicalIdentity — katmanlı vibe etiketi (genre > mood > diversity)", () => {
  it("genre-only etiket: yeterli genre coverage, mood yok", () => {
    const songs: Song[] = [
      song({ title: "s1", genre: "Rock", releaseYear: 1983 }),
      song({ title: "s2", genre: "Rock", releaseYear: 1970 }),
      song({ title: "s3", genre: "Rock", releaseYear: 1987 }),
      song({ title: "s4" }),
    ];
    const identity = calculateMusicalIdentity(songs);

    expect(identity.genreCoverage).toBe(75); // 3/4
    expect(identity.moodCoverage).toBe(0);
    expect(identity.topGenres).toEqual(["Rock"]);
    expect(identity.dominantVibe).toBe("Rock Devotee"); // tek genre
  });

  it("mood-aware etiket: yeterli mood coverage (>= 60) + genre birleşimi", () => {
    const songs: Song[] = [
      song({ title: "s1", genre: "Rock", mood: "Melancholic", releaseYear: 1983 }),
      song({ title: "s2", genre: "Rock", mood: "Melancholic", releaseYear: 1970 }),
      song({ title: "s3", genre: "Rock", mood: "Melancholic", releaseYear: 1987 }),
      song({ title: "s4", genre: "Rock", releaseYear: 1990 }),
      song({ title: "s5", genre: "Rock", releaseYear: 1995 }),
    ];
    const identity = calculateMusicalIdentity(songs);

    expect(identity.moodCoverage).toBe(60); // 3/5
    expect(identity.genreCoverage).toBe(100);
    expect(identity.topMoods).toEqual(["Melancholic"]);
    expect(identity.dominantVibe).toBe("Rock · Melancholic");
  });

  it("mood yetersizse (< 60) genre-only etikete düşer", () => {
    const songs: Song[] = [
      song({ title: "s1", genre: "Rock", mood: "Melancholic", releaseYear: 1983 }),
      song({ title: "s2", genre: "Rock", mood: "Melancholic", releaseYear: 1970 }),
      song({ title: "s3", genre: "Rock", releaseYear: 1987 }),
      song({ title: "s4", genre: "Rock", releaseYear: 1990 }),
      song({ title: "s5", genre: "Rock", releaseYear: 1995 }),
    ];
    const identity = calculateMusicalIdentity(songs);

    expect(identity.moodCoverage).toBe(40); // 2/5 < 60
    expect(identity.genreCoverage).toBe(100);
    expect(identity.dominantVibe).toBe("Rock Devotee");
  });

  it("mood yeterli ama genre yoksa mood-only etikete düşer", () => {
    const songs: Song[] = [
      song({ title: "s1", mood: "Nostalgic", releaseYear: 1983 }),
      song({ title: "s2", mood: "Nostalgic", releaseYear: 1970 }),
      song({ title: "s3", mood: "Nostalgic", releaseYear: 1987 }),
      song({ title: "s4", releaseYear: 1990 }),
      song({ title: "s5", releaseYear: 1995 }),
    ];
    const identity = calculateMusicalIdentity(songs);

    expect(identity.moodCoverage).toBe(60);
    expect(identity.genreCoverage).toBe(0);
    expect(identity.topGenres).toEqual([]);
    expect(identity.dominantVibe).toBe("Nostalgic Mood");
  });

  it("genre ve mood yoksa diversity-only etikete düşer", () => {
    const songs: Song[] = [
      song({ title: "s1", artist: "A1", releaseYear: 1983 }),
      song({ title: "s2", artist: "A2", releaseYear: 1970 }),
      song({ title: "s3", artist: "A3", releaseYear: 1987 }),
      song({ title: "s4", artist: "A4", releaseYear: 1990 }),
      song({ title: "s5", artist: "A5", releaseYear: 1995 }),
    ];
    const identity = calculateMusicalIdentity(songs);

    expect(identity.genreCoverage).toBe(0);
    expect(identity.moodCoverage).toBe(0);
    expect(identity.dominantVibe).toBe("Eclectic Explorer"); // 5/5 unique artist → 100 diversity
  });

  it("topMoods en sık mood'u ilk sırada verir ve 3 ile sınırlar", () => {
    const songs: Song[] = [
      song({ title: "s1", mood: "Dark", releaseYear: 1983 }),
      song({ title: "s2", mood: "Dark", releaseYear: 1970 }),
      song({ title: "s3", mood: "Dark", releaseYear: 1987 }),
      song({ title: "s4", mood: "Nostalgic", releaseYear: 1990 }),
      song({ title: "s5", mood: "Dreamy", releaseYear: 1995 }),
      song({ title: "s6", mood: "Energetic", releaseYear: 2000 }),
    ];
    const identity = calculateMusicalIdentity(songs);

    expect(identity.topMoods[0]).toBe("Dark");
    expect(identity.moodCoverage).toBe(100);
  });
});

describe("generateMusicDNA — integration", () => {
  it("topMoods/moodCoverage'u MusicDNA'ya taşır", () => {
    const songs: Song[] = [
      song({ title: "s1", genre: "Rock", mood: "Dark", releaseYear: 1983 }),
      song({ title: "s2", genre: "Rock", mood: "Dark", releaseYear: 1970 }),
    ];
    const dna = generateMusicDNA(songs);

    expect(dna.songCount).toBe(2);
    expect(dna.isGrounded).toBe(true);
    expect(dna.musicalIdentity.topMoods).toEqual(["Dark"]);
    expect(dna.musicalIdentity.moodCoverage).toBe(100);
  });
});
