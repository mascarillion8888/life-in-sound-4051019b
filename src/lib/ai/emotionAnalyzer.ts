import type { EmotionProfile, PersonalityScores } from "./types";
import { rankedDimensions } from "./personalityScoring";

export const EMOTION_BY_DIMENSION: Record<string, string> = {
  introspection: "Reflection",
  nostalgia: "Nostalgia",
  energy: "Euphoria",
  melancholy: "Longing",
  hope: "Hope",
  rebellion: "Defiance",
  connection: "Tenderness",
};

/**
 * Turns personality scores into a descriptive (never clinical) emotional read.
 */
export function analyzeEmotions(scores: PersonalityScores): EmotionProfile {
  const ranked = rankedDimensions(scores);
  const [first, second, third] = ranked;

  const total = ranked.reduce((sum, d) => sum + scores[d], 0);
  const spread = total > 0 ? scores[first] / total : 0;
  const intensity = Number(Math.min(1, 0.45 + spread).toFixed(2));

  return {
    dominantEmotion: EMOTION_BY_DIMENSION[first] ?? "Reflection",
    secondaryEmotions: [second, third]
      .filter(Boolean)
      .map((d) => EMOTION_BY_DIMENSION[d] ?? "Reflection"),
    intensity,
  };
}
