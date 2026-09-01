import type { Song } from "../song/types";

/**
 * Deterministic music feature extraction.
 *
 * Never invents metadata: every field is either read from the Song model or
 * derived arithmetically (era from release year).
 */
export interface SongFeatures {
  title: string;
  artist: string | null;
  releaseYear: number | null;
  era: string | null;
  genre: string | null;
  mood: string | null;
}

/** Legacy shape kept for backwards compatibility. */
export interface ExtractedMusicFeatures {
  genre: string | null;
  mood: string | null;
  energyLevel?: number;
  acousticness?: number;
  valence?: number;
}

/** "1975" -> "1970s". */
export function computeEra(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function extractSongFeatures(song: Song | null | undefined): SongFeatures | null {
  if (!song) return null;

  const releaseYear =
    typeof song.releaseYear === "number" && !Number.isNaN(song.releaseYear)
      ? song.releaseYear
      : null;

  return {
    title: song.title ?? "",
    artist: str(song.artist),
    releaseYear,
    era: releaseYear === null ? null : computeEra(releaseYear),
    genre: str(song.genre),
    mood: str(song.mood),
  };
}

export function extractSongFeaturesArray(songs: (Song | null | undefined)[]): SongFeatures[] {
  return songs
    .map((song) => extractSongFeatures(song))
    .filter((features): features is SongFeatures => features !== null);
}

export function extractMusicFeatures(song: Song): ExtractedMusicFeatures {
  return { genre: str(song.genre), mood: str(song.mood) };
}

export function getGenreFromSong(source: Song | SongFeatures | null | undefined): string | null {
  return source ? str(source.genre) : null;
}

export function getMoodFromSong(source: Song | SongFeatures | null | undefined): string | null {
  return source ? str(source.mood) : null;
}

export function getEraFromSong(source: Song | SongFeatures | null | undefined): string | null {
  if (!source) return null;
  if ("era" in source && typeof source.era === "string") return source.era;
  const year = source.releaseYear;
  return typeof year === "number" && !Number.isNaN(year) ? computeEra(year) : null;
}

/** At least a title plus one other identifying field. */
export function hasMusicMetadata(song: Song | null | undefined): boolean {
  if (!song || !song.title) return false;
  return str(song.artist) !== null || typeof song.releaseYear === "number";
}

/** Title + artist + release year all present. */
export function isCompleteMetadata(song: Song | null | undefined): boolean {
  if (!song || !song.title) return false;
  return str(song.artist) !== null && typeof song.releaseYear === "number";
}

/** Ratio (0–1) of songs with complete metadata. */
export function countMetadataCompletion(songs: (Song | null | undefined)[]): number {
  const present = (songs ?? []).filter((song): song is Song => Boolean(song));
  if (present.length === 0) return 0;
  const complete = present.filter((song) => isCompleteMetadata(song)).length;
  return complete / present.length;
}
