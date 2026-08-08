import type { EmotionProfile, MusicProfile, PersonalityScores } from "./types";
import { rankedDimensions } from "./personalityScoring";

const GENRES_BY_DIMENSION: Record<string, string[]> = {
  introspection: ["Ambient folk", "Slowcore"],
  nostalgia: ["Classic soul", "Retro pop"],
  energy: ["Stadium pop", "Dance rock"],
  melancholy: ["Chamber pop", "Late-night jazz"],
  hope: ["Cinematic indie", "Gospel-tinged soul"],
  rebellion: ["Alt rock", "Post-punk"],
  connection: ["Singer-songwriter", "Warm R&B"],
};

const LISTENING_STYLE: Record<string, string> = {
  introspection: "Headphones, alone, late at night",
  nostalgia: "Old playlists on repeat",
  energy: "Loud, moving, full volume",
  melancholy: "Slow evenings and long walks",
  hope: "Morning light and open windows",
  rebellion: "Driving fast with the windows down",
  connection: "Shared speakers with people you love",
};

/** Deterministic music profile derived from scores + emotional read. */
export function recommendMusic(
  scores: PersonalityScores,
  emotions: EmotionProfile,
): MusicProfile {
  const ranked = rankedDimensions(scores);
  const [first, second, third] = ranked;

  const primaryGenres = GENRES_BY_DIMENSION[first] ?? ["Cinematic indie"];
  const secondaryGenres = [
    ...(GENRES_BY_DIMENSION[second] ?? []),
    ...(GENRES_BY_DIMENSION[third] ?? []),
  ].slice(0, 3);

  return {
    primaryGenres,
    secondaryGenres,
    mood: `${emotions.dominantEmotion} with a trace of ${
      emotions.secondaryEmotions[0]?.toLowerCase() ?? "reflection"
    }`,
    listeningStyle: LISTENING_STYLE[first] ?? "Headphones, alone, late at night",
  };
}
