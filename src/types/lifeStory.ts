import type { MusicDNA, LifeContext } from "./musicDna";

// Her bir yaşam dönemi için oluşturulan anlatı parçası
export interface StoryChapter {
  stageName: string;
  songTitle: string;
  artistName: string;
  releaseYear: string | number;
  narrative: string; // Şarkı + Dönem bağlamından üretilen metin
}

// Ana Life Story Pipeline Çıktısı (P2 Target)
export interface GroundedLifeStory {
  title: string;
  summary: string;
  chapters: StoryChapter[];
  dominantEraText: string;
  diversityInsight: string;
  isGrounded: boolean; // %100 gerçek verilere dayandığını belirten bayrak
}

// Re-export for consumers who only import lifeStory types
export type { MusicDNA, LifeContext };
