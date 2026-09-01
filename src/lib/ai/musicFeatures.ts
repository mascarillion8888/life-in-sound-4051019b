/**
 * Music Features Extraction Layer
 *
 * Responsible for converting raw Song data into structured SongFeatures.
 * This is the bridge between the Song model and Music DNA analysis.
 *
 * Core principle: Extract ONLY what exists in the Song model.
 * Never invent metadata (genre, mood, etc.). Use null for unknowns.
 */

import type { Song } from "../song/types";

/**
 * SongFeatures — Normalized feature set extracted from a Song
 *
 * Used as input to Music DNA calculators.
 * Null fields indicate missing data (not fallback/invented data).
 */
export interface SongFeatures {
  /** Song title — always present from Song model */
  title: string;

  /** Artist name — null if not provided */
  artist: string | null;

  /** Release year as number — null if unknown */
  releaseYear: number | null;

  /**
   * Era computed from releaseYear.
   * Format: "1970s", "1980s", etc.
   * Null if releaseYear is null (no era can be inferred).
   */
  era: string | null;

  /**
   * Genre of the song.
   * Extracted directly from Song.genre if available.
   * Null if Song has no genre data.
   * CRITICAL: Never invent genres.
   */
  genre: string | null;

  /**
   * Mood/emotional characteristic of the song.
   * Extracted directly from Song.mood if available.
   * Null if Song has no mood data.
   * CRITICAL: Never invent moods.
   */
  mood: string | null;
}

/**
 * computeEra — Deterministic era from release year
 *
 * Converts a year into its decade string.
 * Example: 1993 → "1990s", 2005 → "2000s"
 *
 * Algorithm:
 * 1. Divide year by 10 and floor: Math.floor(year / 10)
 * 2. Multiply by 10 to get decade start: decade * 10
 * 3. Append "s" to format: "${decade}s"
 *
 * @param year — Release year (e.g., 1975, 2020)
 * @returns Era string (e.g., "1970s", "2020s")
 *
 * Edge cases:
 *   - year < 1000 → undefined behavior (assume invalid input)
 *   - year > 9999 → undefined behavior
 *   - Handles all valid years 1000–9999 deterministically
 */
export function computeEra(year: number): string {
  const decade = Math.floor(year / 10) * 10;
  return `${decade}s`;
}

/**
 * extractSongFeatures — Convert a single Song to SongFeatures
 *
 * Safe conversion that never throws. All Song fields are optional;
 * this function maps them to SongFeatures with null for missing data.
 *
 * @param song — A single Song or null
 * @returns SongFeatures with extracted and computed fields
 *
 * Behavior:
 *   - Null song input → returns null (caller filters these out)
 *   - Missing artist → artist: null
 *   - Missing releaseYear → releaseYear: null, era: null
 *   - Missing genre → genre: null
 *   - Missing mood → mood: null
 *
 * Guarantees:
 *   - Title is always present (Song.title is required)
 *   - Era is computed ONLY if releaseYear exists
 *   - No data invented; only mapped and normalized
 */
export function extractSongFeatures(song: Song | null): SongFeatures | null {
  if (!song) {
    return null;
  }

  return {
    title: song.title,
    artist: song.artist || null,
    releaseYear: song.releaseYear || null,
    era: song.releaseYear ? computeEra(song.releaseYear) : null,
  // song nesnesi üzerinden genre ve mood okuma
const songGenre = (song as Record<string, unknown>).genre ?? null;
const songMood = (song as Record<string, unknown>).mood ?? null;

return {
  // ... diğer alanlar
  genre: (songGenre as string | null),
  mood: (songMood as string | null),
};
  };
}

/**
 * extractSongFeaturesArray — Extract features from an array of Songs
 *
 * Batch extraction with filtering. Converts Song[] → SongFeatures[],
 * removing null/invalid entries.
 *
 * @param songs — Array of Song or null values
 * @returns Array of SongFeatures (nulls removed)
 *
 * Example:
 *   Input:  [song1, null, song2, song3]
 *   Output: [features1, features2, features3]
 *
 * Guarantees:
 *   - Output length ≤ input length (nulls filtered)
 *   - Order preserved for non-null songs
 *   - Each feature set is safe and complete
 */
export function extractSongFeaturesArray(
  songs: (Song | null)[],
): SongFeatures[] {
  return songs
    .map(song => extractSongFeatures(song))
    .filter((features): features is SongFeatures => features !== null);
}

/**
 * getGenreFromSong — Safely extract genre from a Song
 *
 * Thin wrapper for null-safe genre access.
 * Used by Music DNA calculators when genre mapping is needed.
 *
 * @param song — A Song (or feature set)
 * @returns Genre string or null
 *
 * Note: This function can be extended later to enrich genre
 * from external sources if needed (e.g., Spotify API).
 */
export function getGenreFromSong(song: Song | SongFeatures): string | null {
  if ("genre" in song) {
    return song.genre ?? null;
  }
  return null;
}

/**
 * getMoodFromSong — Safely extract mood from a Song
 *
 * Thin wrapper for null-safe mood access.
 * Used by Music DNA calculators when mood mapping is needed.
 *
 * @param song — A Song (or feature set)
 * @returns Mood string or null
 *
 * Note: This function can be extended later to infer mood
 * from genre patterns or other metadata if needed.
 */
export function getMoodFromSong(song: Song | SongFeatures): string | null {
  if ("mood" in song) {
    return song.mood ?? null;
  }
  return null;
}

/**
 * getEraFromSong — Safely extract era from a Song
 *
 * Returns era string if releaseYear exists, otherwise null.
 * Used by temporal pattern calculators.
 *
 * @param song — A Song
 * @returns Era string (e.g., "1990s") or null
 */
export function getEraFromSong(song: Song): string | null {
  return song.releaseYear ? computeEra(song.releaseYear) : null;
}

/**
 * Song metadata validation helpers
 */

/**
 * hasMusicMetadata — Check if a Song has meaningful music metadata
 *
 * Used to determine if a song contributes to Music DNA analysis.
 * Returns true if song has at least title and one of: artist, releaseYear.
 *
 * @param song — A Song
 * @returns true if song can meaningfully contribute to analysis
 */
export function hasMusicMetadata(song: Song | null): boolean {
  if (!song || !song.title) return false;
  return !!(song.artist || song.releaseYear);
}

/**
 * isCompleteMetadata — Check if a Song has comprehensive metadata
 *
 * Used to compute confidence scores in Music DNA.
 * Returns true if song has title, artist, AND releaseYear.
 *
 * @param song — A Song
 * @returns true if song has rich metadata
 */
export function isCompleteMetadata(song: Song | null): boolean {
  if (!song || !song.title) return false;
  return !!(song.artist && song.releaseYear);
}

/**
 * countMetadataCompletion — Measure metadata richness across songs
 *
 * Returns a ratio 0.0–1.0 indicating overall metadata coverage.
 *
 * @param songs — Array of Song or null
 * @returns Ratio of complete-metadata songs to total non-null songs
 *
 * Example:
 *   - 8 songs, all complete → 1.0
 *   - 4 complete, 4 missing artist → 0.5
 *   - No songs → 0.0
 */
export function countMetadataCompletion(songs: (Song | null)[]): number {
  const nonNullSongs = songs.filter((s): s is Song => s !== null);
  if (nonNullSongs.length === 0) return 0;

  const completeSongs = nonNullSongs.filter(isCompleteMetadata).length;
  return completeSongs / nonNullSongs.length;
}
