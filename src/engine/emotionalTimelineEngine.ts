import { LifeContext } from "../types/musicDna";
import { EmotionalTimeline, EmotionalNode } from "../types/emotionalTimeline";

export function generateEmotionalTimeline(dna: any, contexts: LifeContext[]): EmotionalTimeline {
  if (!contexts || !Array.isArray(contexts)) {
    return { 
      nodes: [], 
      overallTrajectory: "Fluctuating", 
      dominantEmotion: "Unknown", 
      peakStage: "Unknown", 
      isGrounded: false 
    };
  }

  const nodes: EmotionalNode[] = contexts.map((ctx, index) => ({
    id: ctx.id || `timeline-${index}`,
    songTitle: ctx.song?.title || "Bilinmeyen Şarkı",
    artistName: ctx.song?.artist || "Bilinmeyen Sanatçı",
    releaseYear: ctx.song?.year ?? ctx.song?.releaseYear ?? 2000,
    contextText: ctx.contextText || "",
    stageName: ctx.stageName || "Unknown",
    valency: 0.5,
    energy: 0.5,
    intensity: 0.5,
    primaryEmotion: "Nostalgic",
    vibeLabel: "Melancholic",
    temporalArcPosition: index / Math.max(1, contexts.length - 1),
    color: "#000000",
    questionId: ctx.questionId
  }));

  return {
    nodes,
    overallTrajectory: "Fluctuating",
    dominantEmotion: "Nostalgic",
    peakStage: nodes.length > 0 ? (nodes[0].stageName || "Unknown") : "Unknown",
    isGrounded: true
  };
}
