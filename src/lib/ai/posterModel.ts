import type { EmotionProfile, MusicProfile, PosterModel, PosterVisual } from "./types";

const PALETTE_BY_EMOTION: Record<string, string> = {
  Reflection: "Ink black & candle gold",
  Nostalgia: "Faded gold & warm sepia",
  Euphoria: "Midnight black & bright gold",
  Longing: "Deep charcoal & muted gold",
  Hope: "Soft black & sunrise gold",
  Defiance: "Hard black & sharp gold",
  Tenderness: "Velvet black & rose gold",
};

/** Concrete color sets — one per dominant emotion, matching the palette labels. */
const COLORS_BY_EMOTION: Record<
  string,
  Pick<PosterVisual, "background" | "accent" | "accentSoft" | "glow">
> = {
  Reflection: { background: "#08080a", accent: "#d6a84a", accentSoft: "#f3e0b0", glow: "#7c6bb4" },
  Nostalgia: { background: "#0d0a07", accent: "#c9973f", accentSoft: "#efd9a8", glow: "#b07a3c" },
  Euphoria: { background: "#0a0a0c", accent: "#ffc453", accentSoft: "#fff0c2", glow: "#e0574d" },
  Longing: { background: "#0a0b0d", accent: "#b9954f", accentSoft: "#e4d2a6", glow: "#4f6fa8" },
  Hope: { background: "#0b0a09", accent: "#e6b45c", accentSoft: "#ffeec6", glow: "#dc8c4e" },
  Defiance: { background: "#08070a", accent: "#e8b13a", accentSoft: "#ffe093", glow: "#8c3ad1" },
  Tenderness: { background: "#0c090b", accent: "#d99f77", accentSoft: "#f6dcc9", glow: "#c06a86" },
};

const DEFAULT_COLORS = COLORS_BY_EMOTION.Reflection;

/** Genre families → background motif. Deterministic, no randomness. */
function motifFromMusic(music: MusicProfile): PosterVisual["motif"] {
  const genres = [...music.primaryGenres, ...music.secondaryGenres].join(" ").toLowerCase();
  if (/electro|synth|techno|dance|pop/.test(genres)) return "grid";
  if (/rock|metal|punk|grunge/.test(genres)) return "rays";
  if (/jazz|classical|ambient|folk|acoustic/.test(genres)) return "orbit";
  return "waveform";
}

/** Stable 0..359 angle from a string — same archetype always yields the same tilt. */
function angleFromString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 3600;
  }
  return Math.round((hash / 3600) * 60) - 30; // -30°..+30°
}

/**
 * Builds the visual spec the poster renderer draws from: colors come from the
 * dominant emotion, the motif from the music profile, and glow strength from
 * emotional intensity. Everything is deterministic.
 */
export function buildPosterVisual(emotions: EmotionProfile, music: MusicProfile, archetype: string): PosterVisual {
  const colors = COLORS_BY_EMOTION[emotions.dominantEmotion] ?? DEFAULT_COLORS;
  return {
    ...colors,
    text: "#f5f5f7",
    textMuted: "#9a9aa8",
    motif: motifFromMusic(music),
    intensity: Math.min(1, Math.max(0, Number(emotions.intensity.toFixed(2)))),
    gradientAngle: angleFromString(archetype),
  };
}

/**
 * Data model that connects the personality profile to the poster section and
 * to the canvas renderer (`posterRenderer.ts`).
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
    paletteLabel: PALETTE_BY_EMOTION[emotions.dominantEmotion] ?? "Ink black & candle gold",
    keywords: [
      emotions.dominantEmotion,
      ...emotions.secondaryEmotions,
      ...music.primaryGenres,
    ].slice(0, 5),
    visual: buildPosterVisual(emotions, music, archetype),
  };
}
