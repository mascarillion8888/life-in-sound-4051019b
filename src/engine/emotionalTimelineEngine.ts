import { LifeContext, MusicDNA } from "../types/musicDna";
import { EmotionalTimeline, EmotionalNode } from "../types/emotionalTimeline";

interface StageEmotionRule {
  valency: number;
  intensity: number;
  vibeLabel: string;
  primaryEmotion: string;
  /** 0..1 energy (mood-driven nodes set it; stage fallback keeps 0.5). */
  energy?: number;
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

/**
 * Mood-driven emotion rules (ANA_YASA §0 / P3): when a node's song carries a
 * real inferred mood, its emotional profile comes from the SONG's mood, not the
 * fixed life-stage template. Deterministic mapping across the app's 9 moods
 * (MOOD_SET in moodInference). If the song has no mood, we fall back to the
 * stage matrix (existing behaviour). Never invents a mood — an unknown mood
 * falls through to the stage rule.
 */
const MOOD_EMOTION_MAP: Record<string, StageEmotionRule> = {
  Energetic: { valency: 0.7, intensity: 8, energy: 0.8, vibeLabel: "Driving Spark", primaryEmotion: "Energetic" },
  Euphoric: { valency: 0.9, intensity: 9, energy: 0.8, vibeLabel: "Radiant High", primaryEmotion: "Euphoric" },
  Playful: { valency: 0.8, intensity: 6, energy: 0.7, vibeLabel: "Playful Bounce", primaryEmotion: "Playful" },
  Romantic: { valency: 0.7, intensity: 7, energy: 0.5, vibeLabel: "Tender Warmth", primaryEmotion: "Romantic" },
  Melancholic: { valency: -0.6, intensity: 6, energy: 0.3, vibeLabel: "Quiet Sadness", primaryEmotion: "Melancholic" },
  Dreamy: { valency: 0.4, intensity: 5, energy: 0.3, vibeLabel: "Hazy Reverie", primaryEmotion: "Dreamy" },
  Nostalgic: { valency: 0.3, intensity: 6, energy: 0.4, vibeLabel: "Warm Memory", primaryEmotion: "Nostalgic" },
  Dark: { valency: -0.5, intensity: 8, energy: 0.7, vibeLabel: "Shadowed Weight", primaryEmotion: "Dark" },
  World: { valency: 0.5, intensity: 6, energy: 0.6, vibeLabel: "Wide Horizon", primaryEmotion: "Open" },
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
      const stageRule = STAGE_EMOTION_MATRIX[stageName] ?? DEFAULT_STAGE_RULE;
      // P3: a node whose song carries a real inferred mood is driven by THAT
      // mood; only songs without a mood fall back to the stage template.
      const songMood = ctx.song?.mood ?? null;
      const moodRule = songMood ? MOOD_EMOTION_MAP[songMood] : undefined;
      const rule = moodRule ?? stageRule;
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
        energy: rule.energy ?? 0.5,
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
