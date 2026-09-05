import { LifeContext, MusicDNA } from "../types/musicDna";
import { EmotionalTimeline, EmotionalNode } from "../types/emotionalTimeline";

interface StageEmotionRule {
  valency: number;
  intensity: number;
  vibeLabel: string;
  primaryEmotion: string;
}

const STAGE_EMOTION_MATRIX: Record<string, StageEmotionRule> = {
  Childhood: {
    valency: 0.8,
    intensity: 6,
    vibeLabel: "Nostalgic Spark",
    primaryEmotion: "Nostalgic",
  },
  "First Signature": {
    valency: 0.6,
    intensity: 7,
    vibeLabel: "Formative Discovery",
    primaryEmotion: "Curious",
  },
  Rebellion: {
    valency: 0.2,
    intensity: 9,
    vibeLabel: "Defiant Energy",
    primaryEmotion: "Rebellious",
  },
  Inquiry: {
    valency: 0.4,
    intensity: 6,
    vibeLabel: "Introspective Search",
    primaryEmotion: "Introspective",
  },
  Steel: {
    valency: 0.1,
    intensity: 8,
    vibeLabel: "Resilient Stride",
    primaryEmotion: "Resilient",
  },
  "Hard Time": {
    valency: -0.8,
    intensity: 10,
    vibeLabel: "Deep Catharsis",
    primaryEmotion: "Cathartic",
  },
  Darkness: {
    valency: -0.7,
    intensity: 9,
    vibeLabel: "Shadow Resilience",
    primaryEmotion: "Melancholic",
  },
  Longing: {
    valency: -0.2,
    intensity: 7,
    vibeLabel: "Melancholic Yearning",
    primaryEmotion: "Melancholic",
  },
};

const DEFAULT_STAGE_RULE: StageEmotionRule = {
  valency: 0.5,
  intensity: 5,
  vibeLabel: "Reflective Transition",
  primaryEmotion: "Reflective",
};

export function generateEmotionalTimeline(
  dna: MusicDNA | null,
  contexts: LifeContext[],
): EmotionalTimeline {
  if (!contexts || !Array.isArray(contexts) || contexts.length === 0) {
    return {
      nodes: [],
      overallTrajectory: "Fluctuating",
      dominantEmotion: "Unknown",
      peakStage: "Unknown",
      isGrounded: false,
    };
  }

  const nodes: (EmotionalNode & { id?: string; contextText?: string; questionId?: number })[] =
    contexts.map((ctx, index) => {
      const stageName = ctx.stageName || "Unknown";
      const rule = STAGE_EMOTION_MATRIX[stageName] ?? DEFAULT_STAGE_RULE;
      const temporalArcPosition =
        contexts.length > 1 ? Math.round((index / (contexts.length - 1)) * 100) : 0;

      return {
        id: ctx.id || `timeline-${index}`,
        songTitle: ctx.song?.title || "Bilinmeyen Şarkı",
        artistName: ctx.song?.artist || "Bilinmeyen Sanatçı",
        releaseYear: ctx.song?.year ?? ctx.song?.releaseYear ?? 2000,
        contextText: ctx.contextText || "",
        stageName,
        valency: rule.valency,
        energy: 0.5,
        intensity: rule.intensity,
        primaryEmotion: rule.primaryEmotion,
        vibeLabel: rule.vibeLabel,
        temporalArcPosition,
        color: "#000000",
        questionId: ctx.questionId,
      };
    });

  const peakNode = nodes.reduce(
    (max, curr) => (curr.intensity > max.intensity ? curr : max),
    nodes[0],
  );

  const dominantEmotion = dna?.musicalIdentity?.dominantVibe || "Nostalgic";

  return {
    nodes,
    overallTrajectory: "Fluctuating",
    dominantEmotion,
    peakStage: peakNode?.stageName || "Unknown",
    isGrounded: true,
  };
}
