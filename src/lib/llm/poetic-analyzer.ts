/**
 * Poetic Gemini Analyzer — Dynamic Music Map Engine.
 *
 * Turns the user's 8 journey songs (+ deterministic personality profile) into
 * a deeply poetic, narrative-driven breakdown:
 *   - Chapters of Life (songs grouped into meaningful phases),
 *   - an existential manifesto (one unifying life quote),
 *   - a Dynamic Visual Spec (theme, palette, typography, aura, artwork prompt),
 *   - an emotional curve (one intensity point per song),
 *   - a Core Duality (the two poles the user's taste moves between).
 *
 * Architecture (mirrors the repo's grounding principle — "the deterministic
 * layer computes, the LLM only narrates"):
 *   - THEME DETECTION and the base palette are deterministic
 *     (`detectVisualTheme` / `THEME_CATALOG`). The LLM never invents the theme;
 *     it receives the detected theme and may refine aura/artwork wording.
 *   - `buildPoeticAnalyzerPrompt` is pure string construction (no I/O, no
 *     keys) — safe to import from tests and client bundles.
 *   - `parsePoeticAnalysis` repairs/validates raw LLM output against the
 *     schema, merging over the deterministic fallback. It never throws.
 *   - `deterministicPoeticAnalysis` produces a complete, renderable analysis
 *     with zero provider access — the permanent fallback.
 */
import type { PersonalityProfile } from "@/lib/ai/types";
import { getQuestionEmotionLabels } from "@/lib/ai/questionEmotions";
import { questions } from "@/lib/questions";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type VisualThemeId =
  | "metal-gothic"
  | "synthwave-80s"
  | "jazz-classical"
  | "indie-acoustic"
  | "pop-bright"
  | "ambient-default";

export type VisualSpec = {
  themeId: VisualThemeId;
  palette: {
    primary: string;
    accent: string;
    background: string;
    text: string;
  };
  /** Typography direction keyword, e.g. "blackletter-display". */
  typography: string;
  /** Aura / vibe keywords that describe the map's atmosphere. */
  aura: string[];
  /** Prompt an image model could use to render matching artwork. */
  artworkPrompt: string;
};

export type LifeChapter = {
  id: string;
  /** Evocative uppercase phase title, e.g. "KEŞİF & BÜYÜLENME". */
  title: string;
  /** 1-based song positions (into the journey order) grouped in this chapter. */
  songIndexes: number[];
  narrative: string;
  mood: string;
};

export type SongInsight = {
  /** 1-based song position. */
  index: number;
  title: string;
  insight: string;
};

export type EmotionalCurvePoint = {
  label: string;
  /** 0..1 */
  intensity: number;
};

export type CoreDuality = {
  /** Short axis label, e.g. "Steel / Rain". */
  axis: string;
  left: string;
  right: string;
  resolution: string;
};

export type PoeticAnalysis = {
  manifesto: string;
  chapters: LifeChapter[];
  songInsights: SongInsight[];
  emotionalCurve: EmotionalCurvePoint[];
  coreDuality: CoreDuality;
  visual: VisualSpec;
  source: "gemini" | "deterministic";
};

export type PoeticAnalyzerInput = {
  profile: PersonalityProfile;
  songs: string[];
  /** Optional personal memory notes attached to songs (Life Feed entries). */
  memories?: (string | null)[];
};

/* -------------------------------------------------------------------------- */
/* Dynamic theme detection (deterministic)                                     */
/* -------------------------------------------------------------------------- */

const THEME_KEYWORDS: Record<Exclude<VisualThemeId, "ambient-default">, string[]> = {
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

/** Tie-break priority when two themes score equally. */
const THEME_PRIORITY: (keyof typeof THEME_KEYWORDS)[] = [
  "metal-gothic",
  "synthwave-80s",
  "jazz-classical",
  "indie-acoustic",
  "pop-bright",
];

export const THEME_CATALOG: Record<VisualThemeId, VisualSpec> = {
  "metal-gothic": {
    themeId: "metal-gothic",
    palette: { primary: "#a7b0c0", accent: "#b3122e", background: "#0b0b10", text: "#e8e6df" },
    typography: "blackletter-display",
    aura: ["iron", "cathedral", "thunder"],
    artworkPrompt:
      "Gothic cathedral interior lit by a single crimson beam, brushed steel textures, dramatic chiaroscuro, cinematic album-cover mood",
  },
  "synthwave-80s": {
    themeId: "synthwave-80s",
    palette: { primary: "#ff2fb3", accent: "#22d3ee", background: "#12081f", text: "#fdf4ff" },
    typography: "neon-chrome",
    aura: ["neon", "midnight-drive", "chrome"],
    artworkPrompt:
      "Retro-futurist sunset grid over a chrome skyline, magenta and cyan neon glow, VHS grain, 1980s synthwave poster",
  },
  "jazz-classical": {
    themeId: "jazz-classical",
    palette: { primary: "#d4b06a", accent: "#5b6f94", background: "#0e0d0b", text: "#f3ead8" },
    typography: "elegant-serif",
    aura: ["velvet", "brass", "candlelight"],
    artworkPrompt:
      "Dim jazz club corner with a brass saxophone on velvet, warm candlelight bokeh, classical concert-hall elegance, film noir softness",
  },
  "indie-acoustic": {
    themeId: "indie-acoustic",
    palette: { primary: "#d9a05b", accent: "#7fa36b", background: "#121008", text: "#f5efe3" },
    typography: "handwritten-warm",
    aura: ["campfire", "polaroid", "golden-hour"],
    artworkPrompt:
      "Golden-hour field with an acoustic guitar resting on a wooden chair, faded polaroid tones, soft film grain, intimate folk warmth",
  },
  "pop-bright": {
    themeId: "pop-bright",
    palette: { primary: "#ffd166", accent: "#ef476f", background: "#101018", text: "#ffffff" },
    typography: "bold-grotesque",
    aura: ["confetti", "strobe", "anthem"],
    artworkPrompt:
      "Euphoric concert confetti frozen mid-air under warm strobe light, bold pop poster colors, celebratory energy, glossy print finish",
  },
  "ambient-default": {
    themeId: "ambient-default",
    palette: { primary: "#d6a84a", accent: "#7c4dc4", background: "#0a0a0c", text: "#f5f5f7" },
    typography: "cinematic-serif",
    aura: ["starlight", "echo", "horizon"],
    artworkPrompt:
      "A lone figure on a hill under a vast starlit sky, gold and violet nebula light, cinematic wide shot, contemplative ambient mood",
  },
};

function countKeywordHits(text: string, keywords: string[]): number {
  const haystack = text.toLowerCase();
  let hits = 0;
  for (const keyword of keywords) {
    if (haystack.includes(keyword)) hits += 1;
  }
  return hits;
}

/**
 * Deterministically infer the visual theme from the user's musical palette:
 * recommended genres (weighted ×2) plus song title strings (×1). Returns
 * "ambient-default" when nothing matches — never fabricates a theme.
 */
export function detectVisualTheme(genres: string[], songs: string[]): VisualThemeId {
  const genreText = genres.join(" ");
  const songText = songs.join(" ");

  let best: VisualThemeId = "ambient-default";
  let bestScore = 0;

  for (const themeId of THEME_PRIORITY) {
    const keywords = THEME_KEYWORDS[themeId];
    const score = countKeywordHits(genreText, keywords) * 2 + countKeywordHits(songText, keywords);
    if (score > bestScore) {
      best = themeId;
      bestScore = score;
    }
  }

  return best;
}

/* -------------------------------------------------------------------------- */
/* Deterministic fallback analysis                                             */
/* -------------------------------------------------------------------------- */

/** Poetic poles per personality dimension — used for the Core Duality. */
const POLE_BY_DIMENSION: Record<string, string> = {
  introspection: "Stillness",
  nostalgia: "Memory",
  energy: "Fire",
  melancholy: "Rain",
  hope: "Dawn",
  rebellion: "Steel",
  connection: "Warmth",
};

const CHAPTER_SLOTS: { id: string; title: string; indexes: number[]; mood: string }[] = [
  { id: "chapter-i", title: "DISCOVERY & ENCHANTMENT", indexes: [1, 2], mood: "wide-eyed" },
  { id: "chapter-ii", title: "PORTALS OF PASSAGE", indexes: [3, 4, 5], mood: "tempest-to-triumph" },
  { id: "chapter-iii", title: "THE LONG ECHO", indexes: [6, 7, 8], mood: "luminous" },
];

/** One deterministic insight template per journey question (1-based). */
function deterministicInsight(questionId: number, song: string, emotions: string[]): string {
  const e = (emotions[0] ?? "Reflection").toLowerCase();
  switch (questionId) {
    case 1:
      return `“${song}” is where the world first learned your name — ${e} before you had words for it.`;
    case 2:
      return `“${song}” carried the beautiful emergency of becoming someone.`;
    case 3:
      return `“${song}” still holds a person's outline, the way a room holds warmth after they leave.`;
    case 4:
      return `“${song}” did not fix anything — it simply refused to let you carry it alone.`;
    case 5:
      return `“${song}” is the sound of your spine remembering what it is for.`;
    case 6:
      return `“${song}” keeps someone near — ${e} as a form of loyalty.`;
    case 7:
      return `“${song}” marks the door you walked through and never fully came back from.`;
    default:
      return `“${song}” is the last light on — the one you chose yourself.`;
  }
}

function rankedDimensionPoles(profile: PersonalityProfile): [string, string] {
  const entries = Object.entries(profile.scores).sort((a, b) => b[1] - a[1]);
  const first = POLE_BY_DIMENSION[entries[0]?.[0] ?? ""] ?? "Stillness";
  const second = POLE_BY_DIMENSION[entries[1]?.[0] ?? ""] ?? "Fire";
  return first === second ? [first, "Fire"] : [first, second];
}

/**
 * The complete deterministic analysis — always renderable, no provider access.
 * Used as the immediate client render and as the permanent fallback when the
 * Gemini call is unavailable.
 */
export function deterministicPoeticAnalysis(
  profile: PersonalityProfile,
  songs: string[],
): PoeticAnalysis {
  const theme = detectVisualTheme(profile.recommendedGenres, songs);
  const visual = THEME_CATALOG[theme];
  const s = (i: number) => songs[i - 1] ?? `Untitled track ${i}`;

  const dominant = profile.emotions.dominantEmotion;
  const secondary = profile.emotions.secondaryEmotions[0] ?? dominant;

  const chapters: LifeChapter[] = CHAPTER_SLOTS.map((slot) => {
    const first = s(slot.indexes[0]);
    const last = s(slot.indexes[slot.indexes.length - 1]);
    const narrativeByChapter: Record<string, string> = {
      "chapter-i": `It opens with “${first}”, and by “${last}” the world has already grown larger. This is the part of the map where everything was still possible — the years that taught your heart which frequencies to trust.`,
      "chapter-ii": `Here the road narrows and climbs: “${first}” through “${last}”. Love, weight, and the refusal to kneel — the doors that only open from the inside.`,
      "chapter-iii": `And then the echo: “${first}” to “${last}”. What you keep, what you carry, and the light you would leave on for whoever finds this map after you.`,
    };
    return {
      id: slot.id,
      title: slot.title,
      songIndexes: [...slot.indexes],
      narrative: narrativeByChapter[slot.id],
      mood: slot.mood,
    };
  });

  const songInsights: SongInsight[] = questions.map((q) => ({
    index: q.id,
    title: s(q.id),
    insight: deterministicInsight(q.id, s(q.id), getQuestionEmotionLabels(q.id)),
  }));

  const baseArc = [0.35, 0.6, 0.75, 0.3, 0.9, 0.55, 0.7, 0.85];
  const scale = 0.7 + profile.emotions.intensity * 0.3;
  const emotionalCurve: EmotionalCurvePoint[] = questions.map((q, i) => ({
    label: getQuestionEmotionLabels(q.id)[0] ?? "Reflection",
    intensity: Number(Math.min(1, baseArc[i] * scale).toFixed(2)),
  }));

  const [left, right] = rankedDimensionPoles(profile);
  const coreDuality: CoreDuality = {
    axis: `${left} / ${right}`,
    left,
    right,
    resolution: `You have never had to choose between ${left.toLowerCase()} and ${right.toLowerCase()} — your whole map is the proof that one keeps the other honest.`,
  };

  const manifesto = `A life tuned between ${dominant.toLowerCase()} and ${secondary.toLowerCase()}: every song a room you once lived in, every room still lit.`;

  return {
    manifesto,
    chapters,
    songInsights,
    emotionalCurve,
    coreDuality,
    visual,
    source: "deterministic",
  };
}

/* -------------------------------------------------------------------------- */
/* Gemini prompt construction                                                  */
/* -------------------------------------------------------------------------- */

const ANALYZER_GROUNDING_RULES = [
  "Use ONLY the supplied songs, profile data, and memory notes. Do not invent facts about the user's real life, relationships, places, dates, or events.",
  "Do not invent song titles or artists that were not supplied.",
  "If you genuinely know a supplied song's or album's real theme, mood, or cultural context, USE IT to deepen the interpretation — the song's own meaning is fair game; the user's biography is not.",
  "Write like a lifelong friend who has listened beside them for years: warm, poetic, specific. Never like a report, never clinical, never motivational-poster generic.",
  'Chapter titles must be short, evocative and uppercase (e.g. "KEŞİF & BÜYÜLENME", "GEÇİŞ PORTALLARI"). Write all prose in the dominant language of the supplied song titles and memory notes, defaulting to English.',
  "Return STRICT JSON only — no markdown, no code fences, no commentary.",
];

/**
 * Build the Gemini prompt for the poetic analysis. Pure string construction —
 * no network, no keys. The detected visual theme + palette are supplied as
 * fixed facts; Gemini narrates within them rather than inventing a theme.
 */
export function buildPoeticAnalyzerPrompt(input: PoeticAnalyzerInput): string {
  const { profile, songs, memories } = input;
  const theme = detectVisualTheme(profile.recommendedGenres, songs);
  const spec = THEME_CATALOG[theme];

  const songsBlock = songs
    .map((song, i) => {
      const memory = memories?.[i];
      const question = questions[i];
      const label = question ? ` — ${question.title}` : "";
      return `${i + 1}. ${song}${label}${memory ? ` — memory note: "${memory}"` : ""}`;
    })
    .join("\n");

  const rulesBlock = ANALYZER_GROUNDING_RULES.map((r, i) => `${i + 1}. ${r}`).join("\n");

  return [
    "You are the poetic voice of Life in a Sound — a lifelong friend writing a tribute to someone's life in eight songs, not an AI producing a report.",
    "",
    "SELECTED SONGS (journey order):",
    songsBlock,
    "",
    "DETERMINISTIC PROFILE (factual):",
    `Archetype: ${profile.archetype} — ${profile.title}`,
    `Emotions: ${profile.emotionalProfile.join(", ")}`,
    `Traits: ${profile.traits.join(", ")}`,
    `Mood: ${profile.music.mood}; Genres: ${profile.recommendedGenres.join(", ")}`,
    "",
    "VISUAL THEME (already decided — narrate within it, do not replace it):",
    `Theme: ${theme}; palette primary ${spec.palette.primary}, accent ${spec.palette.accent}, background ${spec.palette.background}, text ${spec.palette.text}; typography: ${spec.typography}.`,
    "",
    "RULES:",
    rulesBlock,
    "",
    "TASK:",
    "Return ONE JSON object with EXACTLY these keys:",
    '"manifesto": one unifying existential quote — a life manifesto in a single sentence that could only belong to THIS selection of songs.',
    '"chapters": 2-4 objects {"id","title","songIndexes":[1-based ints],"narrative","mood"} grouping all 8 songs into meaningful life phases; every index 1-8 must appear exactly once.',
    '"songInsights": 8 objects {"index","title","insight"} — one warm, specific one-sentence insight per song, in journey order.',
    '"emotionalCurve": 8 objects {"label","intensity"} — intensity 0..1, one per song, tracing the emotional arc of the life.',
    '"coreDuality": {"axis","left","right","resolution"} — the two poles this person moves between (e.g. "Steel / Rain") and one sentence resolving how they hold both.',
    '"visual": {"aura":["2-4 vibe keywords"],"artworkPrompt":"one vivid image-generation prompt matching the supplied theme and palette"}.',
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/* LLM output parsing / repair                                                 */
/* -------------------------------------------------------------------------- */

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim())
    .slice(0, max);
}

function clamp01(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

/** Extract the first JSON object from raw LLM text (tolerates code fences). */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return asRecord(JSON.parse(candidate.slice(start, end + 1)));
  } catch {
    return null;
  }
}

/**
 * Parse and repair raw Gemini output into a complete PoeticAnalysis.
 *
 * Accepts a JSON string (with or without code fences) or an already-decoded
 * object. Every field is validated; anything missing or malformed falls back
 * to the deterministic analysis for that field. Returns `null` only when no
 * JSON object can be recovered at all. Never throws.
 */
export function parsePoeticAnalysis(
  raw: unknown,
  ctx: { profile: PersonalityProfile; songs: string[] },
): PoeticAnalysis | null {
  const fallback = deterministicPoeticAnalysis(ctx.profile, ctx.songs);

  const root = typeof raw === "string" ? extractJsonObject(raw) : asRecord(raw);
  if (!root) return null;

  const songCount = ctx.songs.length;

  const manifesto = asNonEmptyString(root.manifesto) ?? fallback.manifesto;

  // Chapters: keep valid entries; remap out-of-range indexes away.
  const chapters: LifeChapter[] = [];
  if (Array.isArray(root.chapters)) {
    for (const entry of root.chapters) {
      const chapter = asRecord(entry);
      if (!chapter) continue;
      const title = asNonEmptyString(chapter.title);
      const narrative = asNonEmptyString(chapter.narrative);
      if (!title || !narrative) continue;
      const indexes = Array.isArray(chapter.songIndexes)
        ? chapter.songIndexes.filter(
            (n): n is number =>
              typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= songCount,
          )
        : [];
      if (indexes.length === 0) continue;
      chapters.push({
        id: asNonEmptyString(chapter.id) ?? `chapter-${chapters.length + 1}`,
        title,
        songIndexes: [...new Set(indexes)],
        narrative,
        mood: asNonEmptyString(chapter.mood) ?? "luminous",
      });
    }
  }

  // Song insights: merge LLM entries over the deterministic ones by index.
  const insightsByIndex = new Map<number, SongInsight>(
    fallback.songInsights.map((s) => [s.index, s]),
  );
  if (Array.isArray(root.songInsights)) {
    for (const entry of root.songInsights) {
      const insight = asRecord(entry);
      if (!insight) continue;
      const index = insight.index;
      const text = asNonEmptyString(insight.insight);
      if (
        typeof index !== "number" ||
        !Number.isInteger(index) ||
        index < 1 ||
        index > songCount ||
        !text
      ) {
        continue;
      }
      insightsByIndex.set(index, {
        index,
        title: asNonEmptyString(insight.title) ?? ctx.songs[index - 1] ?? `Untitled track ${index}`,
        insight: text,
      });
    }
  }
  const songInsights = [...insightsByIndex.values()].sort((a, b) => a.index - b.index);

  // Emotional curve: exactly one clamped point per song, else fallback.
  let emotionalCurve = fallback.emotionalCurve;
  if (Array.isArray(root.emotionalCurve)) {
    const points: EmotionalCurvePoint[] = [];
    for (const entry of root.emotionalCurve) {
      const point = asRecord(entry);
      if (!point) continue;
      const intensity = clamp01(point.intensity);
      if (intensity === null) continue;
      points.push({
        label:
          asNonEmptyString(point.label) ??
          fallback.emotionalCurve[points.length]?.label ??
          "Reflection",
        intensity: Number(intensity.toFixed(2)),
      });
    }
    if (points.length === songCount) emotionalCurve = points;
  }

  const duality = asRecord(root.coreDuality);
  const coreDuality: CoreDuality =
    duality &&
    asNonEmptyString(duality.left) &&
    asNonEmptyString(duality.right) &&
    asNonEmptyString(duality.resolution)
      ? {
          axis:
            asNonEmptyString(duality.axis) ??
            `${(duality.left as string).trim()} / ${(duality.right as string).trim()}`,
          left: (duality.left as string).trim(),
          right: (duality.right as string).trim(),
          resolution: (duality.resolution as string).trim(),
        }
      : fallback.coreDuality;

  // Visual: deterministic theme is authoritative; accept valid LLM palette
  // refinements (valid hex colors only) and fresh aura/artwork wording.
  const visualRoot = asRecord(root.visual);
  const paletteRoot = asRecord(visualRoot?.palette);
  const pickHex = (value: unknown, base: string) =>
    typeof value === "string" && HEX_COLOR.test(value.trim()) ? value.trim() : base;
  const visual: VisualSpec = {
    ...fallback.visual,
    palette: {
      primary: pickHex(paletteRoot?.primary, fallback.visual.palette.primary),
      accent: pickHex(paletteRoot?.accent, fallback.visual.palette.accent),
      background: pickHex(paletteRoot?.background, fallback.visual.palette.background),
      text: pickHex(paletteRoot?.text, fallback.visual.palette.text),
    },
    aura: asStringArray(visualRoot?.aura, 4).length
      ? asStringArray(visualRoot?.aura, 4)
      : fallback.visual.aura,
    artworkPrompt: asNonEmptyString(visualRoot?.artworkPrompt) ?? fallback.visual.artworkPrompt,
  };

  return {
    manifesto,
    chapters: chapters.length > 0 ? chapters : fallback.chapters,
    songInsights,
    emotionalCurve,
    coreDuality,
    visual,
    source: "gemini",
  };
}
