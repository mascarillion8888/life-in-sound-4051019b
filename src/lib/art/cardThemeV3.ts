/**
 * cardThemeV3 â€” token set for the "player card" layout (docs/reference/kart-prototip-v3.html).
 *
 * resolveCardVars(genre, mood) returns plain CSS custom properties. Spread them
 * into the card's `style` prop; the component itself contains no colour literals.
 *
 * Standalone on purpose: no imports, so it cannot be broken by the older
 * cardTheme.ts. Replace familyForGenre with normalizeGenre/cardArtworkSceneForGenre
 * later if exact parity with the artwork scene families is wanted.
 */

export type CardMood =
  | "Nostalgic"
  | "Energetic"
  | "Euphoric"
  | "Playful"
  | "Romantic"
  | "Melancholic"
  | "Dreamy"
  | "Dark"
  | "World";

export type CardFamily = "synth" | "gothic" | "grunge" | "soul" | "jazz" | "reggae" | "hiphop";

export const CARD_MOODS: readonly CardMood[] = [
  "Nostalgic",
  "Energetic",
  "Euphoric",
  "Playful",
  "Romantic",
  "Melancholic",
  "Dreamy",
  "Dark",
  "World",
];

type Trio = readonly [string, string, string];
type Duo = readonly [string, string];

interface FamilySpec {
  neon: boolean;
  /** Frame colours (ignored for neon: those come from the mood). */
  frame?: Trio;
  /** Card body gradient (ignored for neon). */
  body?: Duo;
  text: string;
  display: string;
  body_font: string;
  /** Page backdrop tint used behind non-neon cards. */
  backdrop?: string;
}

const FAMILIES: Record<CardFamily, FamilySpec> = {
  synth: {
    neon: true,
    text: "#ffffff",
    display: "Outfit, system-ui, sans-serif",
    body_font: "Outfit, system-ui, sans-serif",
  },
  gothic: {
    neon: false,
    frame: ["#a2824f", "#6f5836", "#4a3820"],
    body: ["#1c1815", "#0d0a08"],
    text: "#efe3c4",
    display: "Cinzel, Georgia, serif",
    body_font: "Cinzel, Georgia, serif",
    backdrop: "#2a1f14",
  },
  grunge: {
    neon: false,
    frame: ["#7a6a5c", "#4a3d33", "#2a2019"],
    body: ["#1d1a17", "#0c0a09"],
    text: "#e2d9ca",
    display: "'Special Elite', Georgia, serif",
    body_font: "'Special Elite', Georgia, serif",
    backdrop: "#2b2520",
  },
  soul: {
    neon: false,
    frame: ["#c28a3c", "#8a5a22", "#4a2c10"],
    body: ["#2e1015", "#12060a"],
    text: "#f6e4bd",
    display: "'Playfair Display', Georgia, serif",
    body_font: "'Playfair Display', Georgia, serif",
    backdrop: "#3a1218",
  },
  jazz: {
    neon: false,
    frame: ["#9a8855", "#5a4c2c", "#2e2614"],
    body: ["#10202a", "#070f15"],
    text: "#efe6c6",
    display: "'Poiret One', Georgia, serif",
    body_font: "'Poiret One', Georgia, serif",
    backdrop: "#0f1c25",
  },
  reggae: {
    neon: false,
    frame: ["#b3322a", "#c28a1f", "#2f7d3c"],
    body: ["#14210f", "#080f06"],
    text: "#f6eab8",
    display: "Righteous, system-ui, sans-serif",
    body_font: "Righteous, system-ui, sans-serif",
    backdrop: "#1a2a12",
  },
  hiphop: {
    neon: false,
    frame: ["#4a4a4a", "#1c1c1c", "#0a0a0a"],
    body: ["#141414", "#060606"],
    text: "#f2f2f2",
    display: "Bungee, Impact, sans-serif",
    body_font: "Rajdhani, system-ui, sans-serif",
    backdrop: "#1a1a1a",
  },
};

interface MoodSpec {
  sub: string;
  accent: string;
  glow: string;
  filter: string;
  btn2: string;
  frame: Trio;
  body: Duo;
}

const MOODS: Record<CardMood, MoodSpec> = {
  Nostalgic: { btn2: "#ffd9a8", sub: "#ffb76b", accent: "#e0b070", glow: "rgba(255,160,90,.45)", filter: "sepia(.2) contrast(1.05)", frame: ["#ffb76b", "#c26a3a", "#6b3a24"], body: ["#2a1810", "#120a06"] },
  Energetic: { btn2: "#ffc24d", sub: "#ff6b3d", accent: "#ff9a2e", glow: "rgba(255,90,30,.5)", filter: "saturate(1.3) contrast(1.12)", frame: ["#ff8a3d", "#ff3d2e", "#8f1d3d"], body: ["#3a1408", "#150704"] },
  Euphoric: { btn2: "#2ad0ff", sub: "#ff7ce8", accent: "#ffe81a", glow: "rgba(255,61,240,.5)", filter: "saturate(1.2) contrast(1.06)", frame: ["#ff4fd8", "#8f3dff", "#2ad0ff"], body: ["#20105c", "#0d0728"] },
  Playful: { btn2: "#3d9bff", sub: "#ff8fd0", accent: "#3ddc97", glow: "rgba(61,220,151,.45)", filter: "saturate(1.35)", frame: ["#ff8fd0", "#3ddc97", "#3d9bff"], body: ["#1a1a52", "#0c0b2a"] },
  Romantic: { btn2: "#ffc2d4", sub: "#ff9bb8", accent: "#ff8aa8", glow: "rgba(255,80,130,.45)", filter: "sepia(.12) saturate(1.1)", frame: ["#ff8aa8", "#d6336c", "#7a1f4a"], body: ["#3a0f2a", "#170512"] },
  Melancholic: { btn2: "#8fd0ff", sub: "#9bb4d6", accent: "#8fb3d9", glow: "rgba(100,140,210,.35)", filter: "saturate(.7) brightness(.92)", frame: ["#9bb4d6", "#4a6fa5", "#24325c"], body: ["#13203d", "#080e1e"] },
  Dreamy: { btn2: "#4cc9f0", sub: "#d3b8ff", accent: "#c9a7ff", glow: "rgba(170,120,255,.5)", filter: "saturate(1.1) brightness(1.05)", frame: ["#d3b8ff", "#8f6bff", "#4cc9f0"], body: ["#2a1a5c", "#100a2e"] },
  Dark: { btn2: "#ff8a8a", sub: "#d85a5a", accent: "#d1403a", glow: "rgba(190,30,30,.4)", filter: "saturate(.8) contrast(1.15) brightness(.82)", frame: ["#b83a3a", "#5a1a2a", "#1a0a14"], body: ["#1a0a10", "#07030a"] },
  World: { btn2: "#9fd6a0", sub: "#e0a050", accent: "#e0903a", glow: "rgba(224,144,58,.4)", filter: "sepia(.15) saturate(1.1)", frame: ["#e0903a", "#8f5a2a", "#3a5a3a"], body: ["#2a1c0e", "#0f0904"] },
};

/** Keyword families, checked in order. Unknown genres fall back to gothic. */
const GENRE_KEYWORDS: ReadonlyArray<readonly [CardFamily, readonly string[]]> = [
  ["hiphop", ["hip-hop", "hip hop", "hiphop", "rap", "trap", "soundtrack"]],
  ["reggae", ["reggae", "ska", "dub", "dancehall", "latin", "world"]],
  ["jazz", ["jazz", "blues", "swing", "bebop", "folk", "acoustic", "country"]],
  ["soul", ["soul", "funk", "motown", "r&b", "rnb", "rhythm", "gospel"]],
  ["grunge", ["grunge", "punk", "rock", "alternative", "indie", "shoegaze", "britpop"]],
  ["synth", ["synth", "pop", "electro", "dance", "disco", "techno", "wave", "new age"]],
  ["gothic", ["gothic", "metal", "classical", "opera", "doom"]],
];

export function familyForGenre(genre: string | null | undefined): CardFamily {
  const g = (genre ?? "").toLowerCase();
  if (!g) return "gothic";
  for (const [family, words] of GENRE_KEYWORDS) {
    if (words.some((w) => g.includes(w))) return family;
  }
  return "gothic";
}

export function asCardMood(value: string | null | undefined): CardMood {
  return (CARD_MOODS as readonly string[]).includes(value ?? "") ? (value as CardMood) : "Nostalgic";
}

const grad3 = (c: Trio) => `linear-gradient(135deg, ${c[0]} 0%, ${c[1]} 50%, ${c[2]} 100%)`;
const grad2 = (c: Duo) => `linear-gradient(135deg, ${c[0]} 0%, ${c[1]} 100%)`;

export type CardVars = Record<`--${string}`, string>;

export interface ResolvedCardTheme {
  family: CardFamily;
  mood: CardMood;
  neon: boolean;
  /** Spread into the card element's style prop. */
  vars: CardVars;
  /** Colour behind the card for non-neon families (empty for neon). */
  backdrop: string;
}

export function resolveCardVars(genre: string | null | undefined, mood: string | null | undefined): ResolvedCardTheme {
  const family = familyForGenre(genre);
  const m = asCardMood(mood);
  const F = FAMILIES[family];
  const M = MOODS[m];
  const frame: Trio = F.neon ? M.frame : (F.frame as Trio);
  const body: Duo = F.neon ? M.body : (F.body as Duo);

  const vars: CardVars = {
    "--frameW": F.neon ? "3px" : "14px",
    "--bevel": F.neon
      ? "inset 0 0 0 1px rgba(255,255,255,.25)"
      : "inset 4px 4px 0 rgba(255,255,255,.4), inset -4px -4px 0 rgba(0,0,0,.5)",
    "--frameGradient": grad3(frame),
    "--frameGlow": F.neon
      ? `0 0 8px ${frame[0]}, 0 0 28px ${M.glow}, 0 0 64px ${M.glow}`
      : `0 0 34px ${M.glow}`,
    "--bodyBg": `linear-gradient(180deg, ${body[0]}, ${body[1]})`,
    "--text": F.text,
    "--sub": M.sub,
    "--accent": M.accent,
    "--line": `${M.sub}55`,
    "--glowTxt": F.neon ? `0 0 10px ${M.accent}88` : "none",
    "--btn1": F.neon ? frame[0] : M.accent,
    "--btn2": F.neon ? M.btn2 : M.sub,
    "--coverBorder": F.neon ? "rgba(255,255,255,.9)" : frame[0],
    "--coverFilter": M.filter,
    "--display": F.display,
    "--body": F.neon ? F.body_font : F.display,
    "--badgeBg": grad2([F.neon ? frame[0] : M.accent, F.neon ? frame[1] : frame[0]]),
  };

  return { family, mood: m, neon: F.neon, vars, backdrop: F.backdrop ?? "" };
}