import type { Song } from "../song/types";

/**
 * Music DNA — deterministic analytics derived strictly from selected songs.
 * Question answers NEVER influence these metrics; they only shape the
 * narrative layer (Life Story). This module must stay purely mathematical.
 */
export interface MusicDNA {
  /** Most frequent genre among the selected songs (ties resolved by first-seen order). */
  dominantGenre: string | null;
  /** Count map of genres (lowercased bucket keyed by provider label, "Unknown" when absent). */
  genreDistribution: Record<string, number>;
  /** Count map of era buckets (e.g. "1970s", "unknown" when absent. */
  eraDistribution: Record<string, number>;
  /** Number of unique artists. */
  artistCount: number;
  /** artists.size / songs.length (0 to 1), rounded to 3 decimals. */
  diversityScore: number;
  /** Narrative descriptor (e.g. "1980s Rock Enthusiast"). */
  label: string;
}

const UNKNOWN_GENRE = "Unknown";
const UNKNOWN_ERA = "unknown";

function bucketEra(year: number | null | undefined): string {
  return typeof year === "number" && Number.isInteger(year) && year > 0
    ? `${Math.floor(year / 10) * 10}s`
    : UNKNOWN_ERA;
}

function bucketGenre(genre: string | null | undefined): string {
  return genre && genre.trim().length > 0 ? genre.trim() : UNKNOWN_GENRE;
}

/** Deterministic Music DNA computed exclusively from song metadata. */
export function computeMusicDNA(songs: Song[]): MusicDNA {
  if (!songs || songs.length === 0) {
    return {
      dominantGenre: null,
      genreDistribution: {},
      eraDistribution: {},
      artistCount:  ​0,
      diversityScore:  ​0,
      label: "Silence",
    };
  }

  const genreDistribution: Record<string, number> = {};
  const eraDistribution: Record<string, number> = {};
  const artists = new Set<string>();

  for (const song of songs) {
    const genre = bucketGenre(song.genre);
    genreDistribution[genre] = (genreDistribution[genre] || 0) + 1;
    const era = bucketEra(song.releaseYear);
    eraDistribution[era] = (eraDistribution[era] || 0) + 1;
    if (song.artist) artists.add(song.artist.trim());
  }

  const total = songs.length;
  const artistCount = artists.size;
  const diversityScore = Math.round((artistCount / total) * 1000) / 1000;

    const sortedGenres = Object.entries(genreDistribution).sort((a, b) => b[1] - a[1]);
  const dominantGenre = sortedGenres.length > 0 ? sortedGenres[0][0] : null;

    const sortedEras = Object.entries(eraDistribution).sort((a, b) => b[1] - a[1]);
  const dominantEra = sortedEras.length > 0 ? sortedEras[0][0] : UNKNOWN_ERA;

  const label = dominantGenre === null
    ? `${dominantEra} Enthusiast`
    : `${dominantEra} ${dominantGenre} Enthusiast`;

 return {
    dominantGenre,
    genreDistribution,

    eraDistribution,
    artistCount,
    diversityScore,
    label,
  };
}