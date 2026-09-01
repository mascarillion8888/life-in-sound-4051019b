export interface SongData {
  id?: string;
  title: string;
  artist: string;
  year?: number | null;
  releaseYear?: number | null;
  genre?: string | null;
  verified?: boolean;
  provider?: "manual" | "musicbrainz" | "itunes" | "spotify" | string;
  providerId?: string | null;
  album?: string | null;
  artworkUrl?: string | null;
  isrc?: string | null;
  [key: string]: any;
}

export interface LifeContext {
  id?: string;
  song: SongData;
  contextText?: string;
  stageName?: string;
  questionId?: number;
  [key: string]: any;
}

export interface TemporalPattern {
  primaryEra: string;
  dominantEra?: string;
  spanYears: number;
  earliestReleaseYear: number;
  latestReleaseYear: number;
  eraDistribution: Record<string, number>;
  [key: string]: any;
}

export interface MusicalIdentity {
  dominantVibe: string;
  diversityScore: number;
  hasVerifiedTracks: boolean;
  topArtists: string[];
  genreDistribution?: Record<string, number>;
  [key: string]: any;
}

export interface MusicDNA {
  primaryGenre?: string;
  dominantEra?: string;
  topArtists?: string[];
  diversityScore?: number;
  songCount?: number;
  tracksCount?: number;
  isGrounded?: boolean;
  temporalPattern: TemporalPattern;
  musicalIdentity: MusicalIdentity;
  acousticProfile?: {
    energyEstimate: number;
    nostalgiaFactor: number;
  };
  genreDistribution?: Record<string, number>;
  eraDistribution?: Record<string, number>;
  [key: string]: any;
}

export const FALLBACK_MUSIC_DNA: MusicDNA = {
  primaryGenre: "Eclectic",
  dominantEra: "Modern",
  topArtists: [],
  diversityScore: 0,
  songCount: 0,
  tracksCount: 0,
  isGrounded: false,
  temporalPattern: {
    primaryEra: "Modern",
    spanYears: 0,
    earliestReleaseYear: 2020,
    latestReleaseYear: 2026,
    eraDistribution: {}
  },
  musicalIdentity: {
    dominantVibe: "Eclectic",
    diversityScore: 0,
    hasVerifiedTracks: false,
    topArtists: []
  }
};
