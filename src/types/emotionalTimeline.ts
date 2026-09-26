// Her bir yaşam döneminin duygusal düğüm noktası (Node)
export interface EmotionalNode {
  stageName: string; // Örn: "Childhood", "Hard Time"
  songTitle: string;
  artistName: string;
  releaseYear: string | number;
  valency: number; // -1.0 (Melankolik/Karanlık) ile +1.0 (Coşkulu/Aydınlık) arası
  intensity: number; // 1 - 10 arası duygusal yoğunluk
  vibeLabel: string; // Örn: "Nostalgic Spark", "Resilient Catharsis"
  /** Primary emotion keyword (stage- or mood-derived). Emitted by the engine. */
  primaryEmotion?: string;
  /** 0..1 energy (0.5 stage fallback; mood-driven nodes carry their own). */
  energy?: number;
  temporalArcPosition: number; // Timeline üzerindeki yüzdesel sıra (0 - 100)
  id?: string;
  contextText?: string;
  questionId?: number;
}

// Ana Emotional Timeline Çıktısı (P3 Target)
export interface EmotionalTimeline {
  nodes: EmotionalNode[];
  overallTrajectory: "Ascending" | "Descending" | "U-Shaped" | "Cathartic-Peak" | "Fluctuating";
  dominantEmotion: string;
  peakStage: string; // En yüksek duygusal yoğunluğun yaşandığı dönem
  isGrounded: boolean; // %100 uydurmasız veri bayrağı
}
