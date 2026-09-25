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
  /** Up to 3 real provider-sourced genres, most frequent first. Never invented. */
  topGenres: string[];
  /** Share of songs carrying a real provider genre (0-100); gates label trust. */
  genreCoverage: number;
  /** Up to 3 inferred moods (LLM moodInference), most frequent first. Never fabricated. */
  topMoods: string[];
  /** Share of songs carrying an inferred mood (0-100); gates mood-aware label trust. */
  moodCoverage: number;
}

/** Complete grounded musical identity. */
export interface MusicDNA {
  temporalPattern: TemporalPattern;
  musicalIdentity: MusicalIdentity;
  /** Number of songs that fed this analysis. */
  songCount: number;
  /** True when the DNA came from real song data (never fabricated). */
  isGrounded: boolean;
  /** ISO timestamp of generation. */
  analyzedAt: string;
}

/** One life stage + the song the user attached to it. */
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
    topGenres: [],
    genreCoverage: 0,
    topMoods: [],
    moodCoverage: 0,
  },
  songCount: 0,
  isGrounded: false,
  analyzedAt: "",
};
