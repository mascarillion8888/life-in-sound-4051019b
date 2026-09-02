/**
 * Music DNA Type System — grounded musical identity.
 *
 * Shapes here match exactly what `src/engine/musicDnaEngine.ts` produces from
 * the user's selected songs. Nothing is invented: every field is either read
 * from the Song model or derived arithmetically.
 */

import type { Song } from "@/lib/song/types";

export type { Song };

/** How the selected songs distribute across decades. */
export interface TemporalPattern {
  /** Decade -> song count, e.g. { "1980s": 3, "1990s": 1 } */
  eraDistribution: Record<string, number>;
  /** Decade holding the most songs, or "Unknown" with no year data. */
  primaryEra: string;
  /** latestReleaseYear - earliestReleaseYear (0 when unknown). */
  spanYears: number;
  earliestReleaseYear: number;
  latestReleaseYear: number;
}

/** Who the user listens to and how broadly. */
export interface MusicalIdentity {
  /** Up to 3 artist names, most frequent first. */
  topArtists: string[];
  /** uniqueArtists / totalSongs as a 0–100 integer. */
  diversityScore: number;
  /** Human-readable label derived from diversityScore. */
  dominantVibe: string;
  /** True only when every song was provider-verified. */
  hasVerifiedTracks: boolean;
}

/**
 * Genre read (real song.genre when present; deterministic fallback
 * via a curated known-artist map, then an era-style map — never fabricated).
 */
export interface GenreProfile {
  /** Most frequent genre across the selection. */
  dominantGenre: string;
  /** Secondary genres, most frequent first. */
  secondaryGenres: string[];
  /** Where the genre came from: real song metadata, known-artist mapping,
   * era-based style mapping, or unknown. */
  source: "song" | "artist" | "era" | "unknown";
}

/**
 * Aggregate emotional read of the selection — derived deterministically
 * from genre mood/energy tables (never invented as a raw score）。
 */
export interface EmotionalSignature {
  /** Most frequent mood across songs. */
  dominantMood: string;
  /** Runner-up moods, most frequent first. */
  secondaryMoods: string[];
  /** Emotional intensity 1-10 (frequency-weighted) */
  intensity: number;
  /** -1 (dark) .. +1 (bright). */
  valency: number;
  /** Energy estimate 1-10 (genre-averaged). */
  energy: number;
}

/** Complete grounded musical identity. */
export interface MusicDNA {
  temporalPattern: TemporalPattern;
  musicalIdentity: MusicalIdentity;
  /** Deterministic genre read (real metadata or anchored fallback.). */
  genreProfile: GenreProfile;
  /** Aggregate emotional read of the selection. */
  emotionalSignature: EmotionalSignature;
  /** Prose summary — e.g. "Eclectic 1980s Hard Rock with intense undertones". */
  summary: string;
  /** 0/1 completeness score (analyzedSongs / 8). */
  confidence: number;
  /** Number of songs that fed this analysis. */
  songCount: number;
  /** True when the DNA came from real song data (never fabricated.). */
  isGrounded: boolean;
  /** ISO timestamp of generation. */
  analyzedAt: string;
}

/** One life stage +the song the user attached to it. */
export interface LifeContext {
  id?: string;
  questionId?: number;
  stageName: string;
  song: (Song & { year?: number | null }) | null;
  contextText?: string;
}

/** Safe empty DNA for missing/incomplete journeys. */
export const FALLBACK_MUSIC_DNA: MusicDNA = {
  temporalPattern: {
    eraDistribution: {},
    primaryEra: "Unknown",
    spanYears: 0,
    earliestReleaseYear: 0,
    latestReleaseYear: 0,
  },
  musicalIdentity: {
    topArtists: [],
    diversityScore: 0,
    dominantVibe: "Undefined",
    hasVerifiedTracks: false,
  },
  genreProfile: {
    dominantGenre: "Unknown",
    secondaryGenres: [],
    source: "unknown",
  },
  emotionalSignature: {
    dominantMood: "Neutral",
    secondaryMoods: [],
    intensity: 0,
    valency: 0,
    energy: 5,
  },
  summary: "No songs analyzed",
  confidence: 0,
  songCount: 0,
  isGrounded: false,
  analyzedAt: "",
};
