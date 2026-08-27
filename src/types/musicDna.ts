import type { Song } from "../lib/song/types";

// Şarkı seçiminden elde edilen zamansal (Era) dağılım
export interface TemporalPattern {
  primaryEra: string; // Örn: "1980s"
  spanYears: number; // En eski ve en yeni şarkı arasındaki yıl farkı
  eraDistribution: Record<string, number>; // Örn: { "1980s": 3, "1990s": 5 }
  earliestReleaseYear: number;
  latestReleaseYear: number;
}

// Sanatçı ve Müzikal Kimlik Deseni
export interface MusicalIdentity {
  topArtists: string[];
  diversityScore: number; // 0-100 arası çeşitlilik metriği (farklı artist/dönem oranı)
  dominantVibe: string; // Şarkı ve dönem ağırlıklarından türetilen genel atmosfer
  hasVerifiedTracks: boolean; // Tüm şarkıların doğrulanmışlık durumu
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
}
