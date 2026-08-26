/**
 * Poster Theme Generator — deterministic genre/era/emotion → master-poster
 * theme resolver.
 *
 * Unlike `dynamicThemes.ts` (which SELECTS a VisualThemeId for the LLM spec),
 * this module resolves the concrete physical properties of the Master Poster
 * surface: which metal the frame is cast from, which atmosphere the room
 * breathes, and whether the sky behind the layout is stormy or starry.
 *
 * Mapping (art-direction brief):
 *   Metal/Doom      → Dark Gothic Castle & Thunder   · Bronze
 *   Jazz/Classical  → Smoke & Candlelight            · Amber Brass
 *   80s Pop/Synth   → Retro Grid & Neon Glow         · Neon Magenta
 *   Rock/Folk       → Distressed Parchment & Woodcut · Copper
 *   (default)       → Dark Gothic Castle & Thunder   · Gold
 *
 * Background scene: the mean emotional intensity of the life arc decides —
 * high intensity (or fiery/angry mood words) → Stormy/Turbulent; low
 * intensity (or peaceful/happy words) → Calm/Starry.
 *
 * Pure and deterministic — same input, same theme, no LLM call.
 */

import type { PoeticAnalysis } from "@/lib/llm/poetic-analyzer";
import type { Song } from "@/lib/song/types";

/* -------------------------------------------------------------------------- */
/* Public types                                                                */
/* -------------------------------------------------------------------------- */

export type PosterMetal = "gold" | "bronze" | "amber-brass" | "neon-magenta" | "copper";

export type PosterAtmosphere =
  "gothic-thunder" | "smoke-candlelight" | "retro-grid-neon" | "distressed-parchment";

export type PosterBackgroundScene = "stormy" | "starry";

export type PosterTheme = {
  /** Frame/accent metal identity. */
  metal: PosterMetal;
  /** Metal color for borders, rules and the waveform stroke. */
  metalColor: string;
  /** Lighter metal tone for typography highlights. */
  metalHighlight: string;
  /** Primary background wash of the poster surface. */
  primaryBg: string;
  atmosphere: PosterAtmosphere;
  /** Ambient background scene behind the layout. */
  backgroundScene: PosterBackgroundScene;
};

export type PosterThemeInput = {
  /** Free-form genre text: genre tags, song titles, artists, albums. */
  genres?: string[];
  /** Release years of the journey songs — the era signal. */
  releaseYears?: (number | null | undefined)[];
  /** Mean emotional intensity of the life arc, 0..1. */
  emotionalIntensity?: number;
  /** Mood words from the analysis (chapter moods, aura keywords). */
  mood?: string[];
};

/* -------------------------------------------------------------------------- */
/* Metal cast                                                                  */
/* -------------------------------------------------------------------------- */

const METAL_CAST: Record<PosterMetal, { color: string; highlight: string }> = {
  gold: { color: "#d4af37", highlight: "#f0d878" },
  bronze: { color: "#a97142", highlight: "#d09a68" },
  "amber-brass": { color: "#d4a24e", highlight: "#eec887" },
  "neon-magenta": { color: "#ff2fb3", highlight: "#7df9ff" },
  copper: { color: "#b87333", highlight: "#dda15e" },
};

const ATMOSPHERE_BG: Record<PosterAtmosphere, string> = {
  "gothic-thunder": "#0b0b10",
  "smoke-candlelight": "#0a1122",
  "retro-grid-neon": "#12081f",
  "distressed-parchment": "#14100a",
};

/* -------------------------------------------------------------------------- */
/* Genre / era resolution                                                      */
/* -------------------------------------------------------------------------- */

/** Order matters — the first family with a keyword hit wins. */
const ATMOSPHERE_KEYWORDS: [PosterAtmosphere, RegExp][] = [
  ["gothic-thunder", /\b(metal|doom|thrash|sludge|black metal|death metal|heavy metal|gothic)\b/i],
  ["smoke-candlelight", /\b(jazz|swing|blues|classical|orchestral|piano|crooner|lounge)\b/i],
  [
    "retro-grid-neon",
    /\b(synth|synthwave|synthpop|new wave|electro|disco|retrowave|vaporwave|80s|eighties)\b/i,
  ],
  [
    "distressed-parchment",
    /\b(rock|folk|country|americana|acoustic|indie|bluegrass|singer.songwriter)\b/i,
  ],
];

const METAL_BY_ATMOSPHERE: Record<PosterAtmosphere, PosterMetal> = {
  "gothic-thunder": "bronze",
  "smoke-candlelight": "amber-brass",
  "retro-grid-neon": "neon-magenta",
  "distressed-parchment": "copper",
};

/** 1978–1992 — the neon decade window for the era fallback. */
function isNeonEra(years: (number | null | undefined)[]): boolean {
  const valid = years.filter((y): y is number => typeof y === "number" && y >= 1900 && y <= 2100);
  if (valid.length === 0) return false;
  const inWindow = valid.filter((y) => y >= 1978 && y <= 1992).length;
  return inWindow / valid.length >= 0.5;
}

export function resolveAtmosphere(
  genres: string[] = [],
  releaseYears: (number | null | undefined)[] = [],
): PosterAtmosphere {
  const haystack = genres.join(" ").toLowerCase();
  for (const [atmosphere, pattern] of ATMOSPHERE_KEYWORDS) {
    if (pattern.test(haystack)) return atmosphere;
  }
  // Era fallback: a journey whose soundtrack lives in the neon decade gets
  // the retro grid even when no genre keyword fired.
  if (isNeonEra(releaseYears)) return "retro-grid-neon";
  return "gothic-thunder";
}

/* -------------------------------------------------------------------------- */
/* Background scene (emotional weather)                                        */
/* -------------------------------------------------------------------------- */

const CALM_WORDS = /\b(peaceful|happy|calm|serene|content|gentle|soft|tender|joyful)\b/i;
const STORM_WORDS = /\b(intense|fiery|angry|furious|turbulent|stormy|rage|wild|explosive)\b/i;

export function resolveBackgroundScene(
  emotionalIntensity?: number,
  mood: string[] = [],
): PosterBackgroundScene {
  const moodText = mood.join(" ");
  // Explicit mood words outrank the numeric arc.
  if (STORM_WORDS.test(moodText)) return "stormy";
  if (CALM_WORDS.test(moodText)) return "starry";
  if (typeof emotionalIntensity === "number" && Number.isFinite(emotionalIntensity)) {
    return emotionalIntensity >= 0.5 ? "stormy" : "starry";
  }
  return "starry";
}

/* -------------------------------------------------------------------------- */
/* Top-level resolver                                                          */
/* -------------------------------------------------------------------------- */

export function resolvePosterTheme(input: PosterThemeInput = {}): PosterTheme {
  const atmosphere = resolveAtmosphere(input.genres, input.releaseYears);
  // The default journey (no genre keyword, no era signal) is cast in Gold —
  // Bronze is reserved for journeys that actually sound like Metal/Doom.
  const haystack = (input.genres ?? []).join(" ").toLowerCase();
  const hasSignal =
    ATMOSPHERE_KEYWORDS.some(([, pattern]) => pattern.test(haystack)) ||
    isNeonEra(input.releaseYears ?? []);
  const metal = hasSignal ? METAL_BY_ATMOSPHERE[atmosphere] : "gold";
  const cast = METAL_CAST[metal];
  return {
    metal,
    metalColor: cast.color,
    metalHighlight: cast.highlight,
    primaryBg: ATMOSPHERE_BG[atmosphere],
    atmosphere,
    backgroundScene: resolveBackgroundScene(input.emotionalIntensity, input.mood),
  };
}

/* -------------------------------------------------------------------------- */
/* Analysis bridge                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Derives the poster theme straight from a PoeticAnalysis + journey songs —
 * every consumer (`MasterPosterSheet`, `PosterLightbox`, the high-res canvas
 * export) resolves through this bridge, so the palette cannot drift between
 * renderers. Genres come from chapter titles and the song/artist text, mood
 * from the manifesto, chapter moods, insights and duality, and the era signal
 * from Song.releaseYear. `null` analysis falls back to the Gold default.
 */
export function themeFromAnalysis(
  analysis: PoeticAnalysis | null | undefined,
  songs: (Song | undefined)[] = [],
): PosterTheme {
  if (!analysis) return resolvePosterTheme({});
  const genres = [
    // The theme engine's own vocabulary ("metal-gothic", "synthwave-80s"…)
    // is the strongest genre signal, chapter titles the secondary one.
    analysis.visual.themeId,
    ...analysis.chapters.map((c) => c.title),
    ...songs.map((s) => (s ? `${s.title} ${s.artist}` : "")),
  ];
  const mood = [
    analysis.manifesto,
    ...analysis.chapters.map((c) => c.mood),
    ...analysis.songInsights.map((i) => i.insight),
    analysis.coreDuality.axis,
    analysis.coreDuality.left,
    analysis.coreDuality.right,
    analysis.coreDuality.resolution,
  ];
  const curve = analysis.emotionalCurve.map((p) => p.intensity);
  const emotionalIntensity = curve.length
    ? curve.reduce((a, b) => a + b, 0) / curve.length
    : undefined;
  return resolvePosterTheme({
    genres,
    mood,
    emotionalIntensity,
    releaseYears: songs.map((s) => s?.releaseYear ?? null),
  });
}
