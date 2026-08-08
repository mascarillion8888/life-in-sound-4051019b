import type { EmotionProfile, MusicProfile, PersonalityScores } from "./types";
import { rankedDimensions } from "./personalityScoring";

const IMAGE_BY_DIMENSION: Record<string, string> = {
  introspection: "a quiet room where the last note refuses to fade",
  nostalgia: "an old photograph that still smells like summer",
  energy: "a city at 2am with every light still on",
  melancholy: "rain on a window you never wanted to leave",
  hope: "the first warm hour after a long winter",
  rebellion: "a door slammed open onto an open road",
  connection: "a voice you would recognise anywhere",
};

/** Short, profile-specific literary summary. Deterministic, never generic. */
export function writePoeticSummary(
  scores: PersonalityScores,
  emotions: EmotionProfile,
  music: MusicProfile,
): string {
  const [first, second] = rankedDimensions(scores);
  const primary = IMAGE_BY_DIMENSION[first] ?? IMAGE_BY_DIMENSION.introspection;
  const secondary = IMAGE_BY_DIMENSION[second] ?? IMAGE_BY_DIMENSION.hope;

  return `Your music feels like ${primary} — and just underneath it, ${secondary}. It sounds like ${emotions.dominantEmotion.toLowerCase()}, played best ${music.listeningStyle.toLowerCase()}.`;
}
