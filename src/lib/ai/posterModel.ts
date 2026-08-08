import type { EmotionProfile, MusicProfile, PosterModel } from "./types";

const PALETTE_BY_EMOTION: Record<string, string> = {
  Reflection: "Ink black & candle gold",
  Nostalgia: "Faded gold & warm sepia",
  Euphoria: "Midnight black & bright gold",
  Longing: "Deep charcoal & muted gold",
  Hope: "Soft black & sunrise gold",
  Defiance: "Hard black & sharp gold",
  Tenderness: "Velvet black & rose gold",
};

/**
 * Data model that connects the personality profile to the existing poster
 * section. Does not alter the poster artwork or its assets.
 */
export function buildPosterModel(
  archetype: string,
  title: string,
  emotions: EmotionProfile,
  music: MusicProfile,
): PosterModel {
  return {
    headline: title,
    subheadline: music.mood,
    archetype,
    paletteLabel:
      PALETTE_BY_EMOTION[emotions.dominantEmotion] ?? "Ink black & candle gold",
    keywords: [
      emotions.dominantEmotion,
      ...emotions.secondaryEmotions,
      ...music.primaryGenres,
    ].slice(0, 5),
  };
}
