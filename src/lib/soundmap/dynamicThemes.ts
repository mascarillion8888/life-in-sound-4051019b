/**
 * Dynamic Theme Engine — fully personalized poster theming.
 *
 * Scores every theme along three axes:
 *   - genres        (weight ×2, existing keyword matching)
 *   - emotional tone (Nostalgic / Fiery / Melancholic / Peaceful / Victorious)
 *   - age & life phase (Early spark / Passages / Deep Resonance + era affinity)
 *
 * The deterministic base catalog from poetic-analyzer (palette, typography,
 * aura, artworkPrompt) is never duplicated here — this engine only SELECTS a
 * theme and EXTENDS the spec with rendering extras (frame style, waveform
 * stroke gradient, background texture).
 */

import type { VisualSpec, VisualThemeId } from "@/lib/llm/poetic-analyzer";

/* -------------------------------------------------------------------------- */
/* Public types                                                                */
/* -------------------------------------------------------------------------- */

/** Vibe names the art-direction brief uses — mapped onto the base catalog. */
export type VisualVibe = "gothic-dark" | "vintage-jazz" | "vibrant-pop" | "raw-melancholy";

export type EmotionalTone = "nostalgic" | "fiery" | "melancholic" | "peaceful" | "victorious";

export type LifePhaseKey = "early-spark" | "awakening" | "passages" | "deep-resonance";

export type FrameStyle = "arch" | "double-rule" | "rough-edge" | "neon-glow" | "hairline" | "none";

export type BackgroundTexture = "smoke" | "grid" | "silk" | "paper" | "gloss" | "nebula";

/** Rendering extras layered on top of the base VisualSpec. */
export type DynamicThemeExtras = {
  frame: FrameStyle;
  /** Waveform stroke gradient stops [from, to]. */
  waveGradient: [string, string];
  texture: BackgroundTexture;
  /** Radial glow color for aura circles (screen + canvas export). */
  auraGlow: string;
};

export type DynamicTheme = {
  themeId: VisualThemeId;
  vibe: VisualVibe;
  extras: DynamicThemeExtras;
};

export type DynamicThemeInput = {
  genres: string[];
  songs?: string[];
  /** Free-form emotion words from the personality profile / mood string. */
  emotionalTone?: string[];
  /** Life-phase labels, e.g. chapter age ranges ("Ages 9–12") or phase titles. */
  lifePhases?: string[];
};

/* -------------------------------------------------------------------------- */
/* Vibe aliases (brief naming ↔ base catalog)                                  */
/* -------------------------------------------------------------------------- */

const VIBE_BY_THEME: Record<VisualThemeId, VisualVibe> = {
  "metal-gothic": "gothic-dark",
  "synthwave-80s": "vibrant-pop",
  "jazz-classical": "vintage-jazz",
  "indie-acoustic": "raw-melancholy",
  "pop-bright": "vibrant-pop",
  "ambient-default": "raw-melancholy",
};

/* -------------------------------------------------------------------------- */
/* Axis keyword tables                                                         */
/* -------------------------------------------------------------------------- */

const EMOTION_AFFINITY: Record<EmotionalTone, Partial<Record<VisualThemeId, number>>> = {
  fiery: { "metal-gothic": 2, "pop-bright": 1, "synthwave-80s": 1 },
  melancholic: { "indie-acoustic": 2, "ambient-default": 1, "jazz-classical": 1 },
  nostalgic: { "jazz-classical": 2, "indie-acoustic": 1, "synthwave-80s": 1 },
  peaceful: { "ambient-default": 2, "jazz-classical": 1, "indie-acoustic": 1 },
  victorious: { "pop-bright": 2, "metal-gothic": 1, "synthwave-80s": 1 },
};

const EMOTION_KEYWORDS: Record<EmotionalTone, string[]> = {
  fiery: ["fire", "fiery", "rebell", "energy", "intense", "defian", "rage", "ignit"],
  melancholic: ["melanchol", "rain", "sad", "grief", "longing", "sorrow", "blue"],
  nostalgic: ["nostalg", "memory", "memories", "past", "remember", "childhood", "yearn"],
  peaceful: ["peace", "calm", "serene", "still", "quiet", "gentle", "soft"],
  victorious: ["victor", "triumph", "anthem", "hope", "rise", "glory", "celebrat"],
};

/** Phase → era-affinity nudges (e.g. a Deep Resonance jazz life reads older). */
const PHASE_AFFINITY: Record<LifePhaseKey, Partial<Record<VisualThemeId, number>>> = {
  "early-spark": { "pop-bright": 1, "synthwave-80s": 1 },
  awakening: { "metal-gothic": 1, "pop-bright": 1 },
  passages: { "indie-acoustic": 1, "synthwave-80s": 1 },
  "deep-resonance": { "jazz-classical": 1, "ambient-default": 1 },
};

const PHASE_KEYWORDS: Record<LifePhaseKey, string[]> = {
  "early-spark": ["first spark", "ages 9", "ages 0", "discovery", "enchantment"],
  awakening: ["awakening", "ages 12", "ages 13", "ages 14", "ages 15", "teen", "defiance"],
  passages: ["passages", "ages 18", "ages 2", "twent"],
  "deep-resonance": ["deep resonance", "ages 35", "ages 4", "ages 5", "stillness", "acceptance"],
};

/* -------------------------------------------------------------------------- */
/* Extras catalog                                                              */
/* -------------------------------------------------------------------------- */

export const EXTRAS_BY_THEME: Record<VisualThemeId, DynamicThemeExtras> = {
  "metal-gothic": {
    frame: "arch",
    waveGradient: ["#a7b0c0", "#b3122e"],
    texture: "smoke",
    auraGlow: "#b3122e",
  },
  "synthwave-80s": {
    frame: "neon-glow",
    waveGradient: ["#ff2fb3", "#22d3ee"],
    texture: "grid",
    auraGlow: "#22d3ee",
  },
  "jazz-classical": {
    frame: "double-rule",
    waveGradient: ["#d4b06a", "#5b6f94"],
    texture: "silk",
    auraGlow: "#d4b06a",
  },
  "indie-acoustic": {
    frame: "rough-edge",
    waveGradient: ["#d9a05b", "#7fa36b"],
    texture: "paper",
    auraGlow: "#d9a05b",
  },
  "pop-bright": {
    frame: "none",
    waveGradient: ["#ffd166", "#ef476f"],
    texture: "gloss",
    auraGlow: "#ef476f",
  },
  "ambient-default": {
    frame: "hairline",
    waveGradient: ["#d6a84a", "#7c4dc4"],
    texture: "nebula",
    auraGlow: "#7c4dc4",
  },
};

/* -------------------------------------------------------------------------- */
/* Engine                                                                      */
/* -------------------------------------------------------------------------- */

function countHits(text: string, keywords: string[]): number {
  const haystack = text.toLowerCase();
  let hits = 0;
  for (const keyword of keywords) if (haystack.includes(keyword)) hits += 1;
  return hits;
}

const GENRE_KEYWORDS: Record<Exclude<VisualThemeId, "ambient-default">, string[]> = {
  "metal-gothic": [
    "metal",
    "gothic",
    "goth",
    "doom",
    "thrash",
    "heavy",
    "hard rock",
    "punk",
    "grunge",
    "rock",
    "slayer",
    "sabbath",
    "priest",
    "maiden",
  ],
  "synthwave-80s": [
    "synth",
    "synthwave",
    "retrowave",
    "new wave",
    "electronic",
    "electro",
    "80s",
    "eighties",
    "techno",
    "house",
    "depeche",
    "kraftwerk",
  ],
  "jazz-classical": [
    "jazz",
    "classical",
    "orchestra",
    "orchestral",
    "piano",
    "blues",
    "swing",
    "soul",
    "bebop",
    "sonata",
    "symphony",
  ],
  "indie-acoustic": [
    "indie",
    "folk",
    "acoustic",
    "singer-songwriter",
    "alternative",
    "country",
    "americana",
    "bluegrass",
  ],
  "pop-bright": ["pop", "dance", "disco", "funk", "r&b", "hip hop", "hip-hop", "rap"],
};

/** Tie-break priority when scores are equal (matches the base engine). */
const THEME_PRIORITY: VisualThemeId[] = [
  "metal-gothic",
  "synthwave-80s",
  "jazz-classical",
  "indie-acoustic",
  "pop-bright",
];

/**
 * Resolve the personalized dynamic theme. Genres dominate (×2), emotional
 * tone and life-phase labels each nudge the score (×1). Ties break toward
 * THEME_PRIORITY; zero genre signal with no other signal falls back to
 * "ambient-default" — never fabricates a theme.
 */
export function resolveDynamicTheme(input: DynamicThemeInput): DynamicTheme {
  const genreText = input.genres.join(" ");
  const songText = (input.songs ?? []).join(" ");
  const emotionText = (input.emotionalTone ?? []).join(" ");
  const phaseText = (input.lifePhases ?? []).join(" ");

  const scores: Record<VisualThemeId, number> = {
    "metal-gothic": 0,
    "synthwave-80s": 0,
    "jazz-classical": 0,
    "indie-acoustic": 0,
    "pop-bright": 0,
    "ambient-default": 0,
  };

  for (const themeId of THEME_PRIORITY) {
    if (themeId === "ambient-default") continue;
    scores[themeId] =
      countHits(genreText, GENRE_KEYWORDS[themeId]) * 2 +
      countHits(songText, GENRE_KEYWORDS[themeId]);
  }

  for (const tone of Object.keys(EMOTION_KEYWORDS) as EmotionalTone[]) {
    if (countHits(emotionText, EMOTION_KEYWORDS[tone]) === 0) continue;
    const affinity = EMOTION_AFFINITY[tone];
    for (const [themeId, weight] of Object.entries(affinity)) {
      scores[themeId as VisualThemeId] += weight ?? 0;
    }
  }

  for (const phase of Object.keys(PHASE_KEYWORDS) as LifePhaseKey[]) {
    if (countHits(phaseText, PHASE_KEYWORDS[phase]) === 0) continue;
    const affinity = PHASE_AFFINITY[phase];
    for (const [themeId, weight] of Object.entries(affinity)) {
      scores[themeId as VisualThemeId] += weight ?? 0;
    }
  }

  let best: VisualThemeId = "ambient-default";
  let bestScore = 0;
  for (const themeId of THEME_PRIORITY) {
    if (scores[themeId] > bestScore) {
      best = themeId;
      bestScore = scores[themeId];
    }
  }

  return { themeId: best, vibe: VIBE_BY_THEME[best], extras: EXTRAS_BY_THEME[best] };
}

/** Convenience: merge the base catalog spec with the engine's extras. */
export function withDynamicExtras(
  spec: VisualSpec,
  theme: DynamicTheme,
): VisualSpec & DynamicThemeExtras {
  return { ...spec, ...theme.extras };
}
