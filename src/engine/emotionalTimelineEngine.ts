import type { MusicDNA, LifeContext } from "../types/musicDna";
import type { EmotionalNode, EmotionalTimeline } from "../types/emotionalTimeline";

/**
 * Yaşam Aşaması ve Müzik Seçimine Göre Valence ve Intensity Matrisi
 * (Deterministik/Grounded Duygu Haritası)
 */
function calculateStageEmotion(
  context: LifeContext,
  index: number,
  totalStages: number,
): EmotionalNode {
  const { stageName, song } = context;
  const stageLower = stageName.toLowerCase();

  // Yaşam aşamasına göre varsayılan taban duygu ve yoğunluk skorları
  let valency = 0.2;
  let intensity = 6;
  let vibeLabel = "Reflective Transition";

  if (stageLower.includes("childhood") || stageLower.includes("first spark")) {
    valency = 0.8;
    intensity = 7;
    vibeLabel = "Nostalgic Spark";
  } else if (stageLower.includes("teenage") || stageLower.includes("rebellion")) {
    valency = 0.4;
    intensity = 9;
    vibeLabel = "Raw Energy & Exploration";
  } else if (stageLower.includes("first love") || stageLower.includes("connection")) {
    valency = 0.9;
    intensity = 8;
    vibeLabel = "Warm Resonance";
  } else if (stageLower.includes("hard time") || stageLower.includes("darkness")) {
    valency = -0.8;
    intensity = 10;
    vibeLabel = "Cathartic Depth";
  } else if (stageLower.includes("unstoppable") || stageLower.includes("turning point")) {
    valency = 0.7;
    intensity = 9;
    vibeLabel = "Resilient Triumph";
  }

  // Zamansal çizgi üzerindeki yüzde pozisyonu (0 - 100)
  const temporalArcPosition = Math.round((index / (totalStages - 1 || 1)) * 100);

  return {
    stageName,
    songTitle: song.title,
    artistName: song.artist,
    releaseYear: song.releaseYear || "N/A",
    valency,
    intensity,
    vibeLabel,
    temporalArcPosition,
  };
}

/**
 * Toplam Duygu Eğrisini (Trajectory Pattern) Belirleyici
 */
function determineTrajectoryType(nodes: EmotionalNode[]): EmotionalTimeline["overallTrajectory"] {
  if (nodes.length < 2) return "Fluctuating";

  const firstHalf = nodes.slice(0, Math.floor(nodes.length / 2));
  const secondHalf = nodes.slice(Math.floor(nodes.length / 2));

  const avgFirstValency = firstHalf.reduce((acc, n) => acc + n.valency, 0) / firstHalf.length;
  const avgSecondValency = secondHalf.reduce((acc, n) => acc + n.valency, 0) / secondHalf.length;

  if (avgSecondValency > avgFirstValency + 0.3) return "Ascending";
  if (avgFirstValency > avgSecondValency + 0.3) return "Descending";

  const hasDeepDrop = nodes.some((n) => n.valency < -0.5);
  const endsHigh = nodes[nodes.length - 1]?.valency > 0.5;

  if (hasDeepDrop && endsHigh) return "U-Shaped";

  return "Fluctuating";
}

/**
 * P3 — Main Emotional Timeline Pipeline Engine
 */
export function generateEmotionalTimeline(
  dna: MusicDNA,
  contexts: LifeContext[],
): EmotionalTimeline {
  if (!contexts || contexts.length === 0) {
    throw new Error("Emotional Timeline requires valid LifeContext array.");
  }

  // 1. Düğümleri (Nodes) hesapla
  const nodes: EmotionalNode[] = contexts.map((ctx, idx) =>
    calculateStageEmotion(ctx, idx, contexts.length),
  );

  // 2. En yüksek duygusal pik noktasını bul
  const peakNode = [...nodes].sort((a, b) => b.intensity - a.intensity)[0];

  // 3. Genel trajectory deseni çıkar
  const overallTrajectory = determineTrajectoryType(nodes);

  return {
    nodes,
    overallTrajectory,
    dominantEmotion: dna.musicalIdentity.dominantVibe,
    peakStage: peakNode ? `${peakNode.stageName} (${peakNode.songTitle})` : "Unknown",
    isGrounded: dna.isGrounded && contexts.every((c) => c.song.verified !== false),
  };
}
