import type { Song } from "../lib/song/types";

// Şarkı seçiminden elde edilen zamansal (Era) dağılım
export interface TemporalPattern {
  primaryEra: string; // Örn: "1980s"
  spanYears: number; // En eski ve en yeni şarkı arasındaki yıl farkı
  eraDistribution: Record<string, number>; // Örn: { "1980s": 3, "1990s": 5 }
  earliestReleaseYear: number;
  latestReleaseYear: number;

  lifeStageFit?: number;
  stageOverlaps?: { stageName: string; era: string; overlap: boolean; }[];
}

// Sanatçı ve Müzikal Kimlik Deseni
export interface MusicalIdentity {
  topArtists: string[];
  diversityScore: number; // 0-100 arası çeşitlilik metriği (farklı artist/dönem oranı)
  dominantVibe: string; // Şarkı ve dönem ağırlıklarından türetilen genel atmosfer
  hasVerifiedTracks: boolean; // Tüm şarkıların doğrulanmışlık durumu
  genreSpectrum?: GenreSpectrum[];
  dominantGenres?: string[];
}

// Soruların hayat bağlamı (8 Life Context)
export interface LifeContext {
  questionId: number;
  stageName: string; // Örn: "Childhood", "First Love"
  song: Song;
}

// Ana Music DNA Çıktı Modeli (P0 Hedefi)
export interface MusicDNA {
  temporalPattern: TemporalPattern;
  musicalIdentity: MusicalIdentity;
  songCount: number;
  isGrounded: boolean; // Uydurma veri olmadığını garanti eden bayrak
  analyzedAt: string; // ISO Timestamp

  emotionalCharacter?: EmotionalCharacterProfile;
  genreSpectrum?: GenreSpectrum[];
}

// ------------------------------------------------------------------
// Phase 1 - Music DNA analytic engine types (deterministic, optional)
// ------------------------------------------------------------------

// Emotional Character - four deterministic dimensions (0-100 each)
export interface EmotionalCharacterScores {
  nostalgia: number;
  energy: number;
  introspection: number;
  connection: number;
}

export type EmotionalCharacterDimension = 'Nostalgia' | 'Energy' | 'Introspection' | 'Connection';

export interface EmotionalCharacterProfile {
  dominant: EmotionalCharacterDimension;
  scores: EmotionalCharacterScores;
  intensity: number;
}

// Genre spectrum - weighted genre buckets from music metadata
export interface GenreSpectrum {
  genre: string;
  weight: number;
}

// Stage-era fit - life context alignment with the temporal pattern
export interface StageOverlap {
  stageName: string;
  era: string;
  overlap: boolean;
}

