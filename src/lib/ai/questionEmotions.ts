/**
 * Read-only access layer for the existing per-question → emotion mapping.
 *
 * Returns the human-readable emotion labels that a question's mapped
 * dimensions already imply — using ONLY the existing `QUESTION_DIMENSIONS`
 * and `EMOTION_BY_DIMENSION` maps. Introduces no scoring, weighting,
 * interpretation, or new emotion logic.
 */
import { EMOTION_BY_DIMENSION } from "./emotionAnalyzer";
import { QUESTION_DIMENSIONS } from "./personalityScoring";

/** Emotion labels implied by a question's existing dimension mappings. */
export function getQuestionEmotionLabels(questionId: number): string[] {
  const dims = QUESTION_DIMENSIONS[questionId] ?? [];
  return dims.map((d) => EMOTION_BY_DIMENSION[d] ?? "Reflection");
}
