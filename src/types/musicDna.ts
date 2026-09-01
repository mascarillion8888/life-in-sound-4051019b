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
  },
  songCount: 0,
  isGrounded: false,
  analyzedAt: "",
};
