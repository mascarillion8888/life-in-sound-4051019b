import type { MusicDNA, TemporalPattern, MusicalIdentity } from "../types/musicDna";
import type { Song } from "../lib/song/types";

/**
 * Zamansal Dağılım Hesaplayıcı (Temporal Engine)
 */
export function calculateTemporalPattern(songs: Song[]): TemporalPattern {
  const years = songs.map((s) => Number(s.releaseYear)).filter((y) => !isNaN(y) && y > 1900);

  if (years.length === 0) {
    return {
      primaryEra: "Unknown",
      spanYears: 0,
      eraDistribution: {},
      earliestReleaseYear: 0,
      latestReleaseYear: 0,
    };
  }

  const earliest = Math.min(...years);
  const latest = Math.max(...years);
  const eraDistribution: Record<string, number> = {};

  years.forEach((year) => {
    const decade = `${Math.floor(year / 10) * 10}s`;
    eraDistribution[decade] = (eraDistribution[decade] || 0) + 1;
  });

  const primaryEra = Object.entries(eraDistribution).reduce((a, b) => (b[1] > a[1] ? b : a))[0];

  return {
    primaryEra,
    spanYears: latest - earliest,
    eraDistribution,
    earliestReleaseYear: earliest,
    latestReleaseYear: latest,
  };
}

/** Minimum % of songs needing a real provider genre before we trust
 *  genre-derived labeling over the old diversity-only heuristic. Below
 *  this, most of the selection has no real genre (e.g. manually-typed
 *  songs, or songs found before genre mapping existed) and a genre-based
 *  label would be more confident than the data supports. */
const MIN_GENRE_COVERAGE_FOR_LABEL = 50;

/** Human-readable vibe label. Prefers real genre data when enough of the
 *  selection carries it; otherwise falls back to the original
 *  diversity-only heuristic — never invents a genre to fill the gap. */
function deriveDominantVibe(
  topGenres: string[],
  genreCoverage: number,
  diversityScore: number,
): string {
  if (genreCoverage >= MIN_GENRE_COVERAGE_FOR_LABEL && topGenres.length > 0) {
    const [primaryGenre] = topGenres;
    return topGenres.length > 1 ? `${primaryGenre} & Beyond` : `${primaryGenre} Devotee`;
  }
  return diversityScore > 75 ? "Eclectic Explorer" : "Focused Nostalgic";
}

/**
 * Müzikal Kimlik Hesaplayıcı (Identity Engine)
 */
export function calculateMusicalIdentity(songs: Song[]): MusicalIdentity {
  const artistCounts: Record<string, number> = {};
  const genreCounts: Record<string, number> = {};
  let songsWithGenre = 0;

  songs.forEach((song) => {
    if (song.artist) {
      artistCounts[song.artist] = (artistCounts[song.artist] || 0) + 1;
    }
    if (song.genre) {
      genreCounts[song.genre] = (genreCounts[song.genre] || 0) + 1;
      songsWithGenre += 1;
    }
  });

  const uniqueArtists = Object.keys(artistCounts);
  const diversityScore = Math.round((uniqueArtists.length / (songs.length || 1)) * 100);

  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([genre]) => genre)
    .slice(0, 3);
  const genreCoverage = Math.round((songsWithGenre / (songs.length || 1)) * 100);

  return {
    topArtists: uniqueArtists.slice(0, 3),
    diversityScore,
    dominantVibe: deriveDominantVibe(topGenres, genreCoverage, diversityScore),
    hasVerifiedTracks: songs.every((s) => s.verified === true),
    topGenres,
    genreCoverage,
  };
}

/**
 * Ana Music DNA Oluşturucu (Main Pipeline entry point)
 */
export function generateMusicDNA(songs: Song[]): MusicDNA {
  if (!songs || songs.length === 0) {
    throw new Error("MusicDNA generation requires at least 1 valid Song input.");
  }

  return {
    temporalPattern: calculateTemporalPattern(songs),
    musicalIdentity: calculateMusicalIdentity(songs),
    songCount: songs.length,
    isGrounded: true,
    analyzedAt: new Date().toISOString(),
  };
}
