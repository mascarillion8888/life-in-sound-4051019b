/**
 * Scene selection + scene library — shared, client-safe.
 *
 * The scene family (gothic / hiphop / grunge / soul / jazz / reggae /
 * synth) is the cache discriminator for the artwork: stal the same track
 * in a different scene must generate a new painting, never reuse the old.
 * The client cache key AND the server prompt builder share this one module,
 * so they can never drift apart. The module is environment-free (no
 * process.env, no imports) and is imported by both the client artwork hook
 * and the server-only generation code.
 *
 * Resolution order (strongest signal first):
 *   1. explicit user aesthetic preference,
 *   2. genre keywords in the song's metadata (artist/title/album),
 *   3.the decade ladder by release year; a null year → gothic base.void
 */
export const SCENE_IDS = ["gothic", "hiphop", "grunge", "soul", "jazz", "reggae", "synth"] as const;

export type SceneSpec = {
  id: string;
  keywords: string[];
  prompt: (artist: string) => string;
};

/**
 * One scene per aesthetic family. Order matters:the first matching family
 * wins. (Data was previously inlined in cardArtwork.server.ts; moved here
 * so the cache matcher and the prompt builder share one source.)
 */
export const SCENE_SPECS: SceneSpec[] = [
  {
    id: "gothic",
    keywords: [
      "goth",
      "doom",
      "folk",
      "metal",
      "thrash",
      "slayer",
      "sabbath",
      "priest",
      "maiden",
      "punk",
      "acoustic",
      "country",
      "americana",
      "bluegrass",
      "classical",
      "orchestra",
      "piano",
      "symphony",
      "sonata",
    ],
    prompt: (a) =>
      `Atmospheric dark gothic oil painting concept, candlelit vintage room with detailed wood ` +
      `carvings,the child gazing at a typographic vinyl sleeve echoing ${a} — abstract glyphs ` +
      `and geometry only, seamlessly integrated into the scene.`,
  },
  {
    id: "hiphop",
    keywords: [
      "rap",
      "hiphop",
      "hip hop",
      "boombap",
      "gangsta",
      "trap",
      "eminem",
      "tupac",
      "biggie",
      "kendrick",
      "drake",
      "nas",
      "jay z",
      "wu tang",
      "outkast",
    ],
    prompt: (a) =>
      `Late-night studio glow, a typographic album sleeve echoing ${a} on a plum wall, abstract ` +
      `glyph design in a gold frame, cinematic contemporary fine-art oil painting concept.`,
  },
  {
    id: "grunge",
    keywords: [
      "grunge",
      "nirvana",
      "soundgarden",
      "shoegaze",
      "britpop",
      "mudhoney",
      "pumpkins",
      "radiohead",
      "oasis",
      "alternative",
    ],
    prompt: (a) =>
      `Moody 90s rehearsal basement, faded gig posters on the wall, dim slate ` +
      `light, an abstract typographic gig flyer for ${a} — shapesand glyphs only, no faces — ` +
      `tacked beside a worn canvas sleeve.`,
  },
  {
    id: "soul",
    keywords: [
      "soul",
      "funk",
      "motown",
      "stax",
      "rnb",
      "rhythm and blues",
      "aretha",
      "supremes",
      "temptations",
      "otis",
      "wonder",
    ],
    prompt: (a) =>
      `Warm vinyl listening room, amber lamp light and velvet textures,a typographic album ` +
      `sleeve for ${a} — abstract gold-on-plum glyph design — beside a turntable, golden ` +
      `soul-era memorial glow.`,
  },
  {
    id: "jazz",
    keywords: ["jazz", "blues", "swing", "bebop", "lounge", "crooner"],
    prompt: (a) =>
      `Dimly lit vintage jazz club atmosphere, warm brass accents, smoky haze,a typographic ` +
      `vinyl sleeve for ${a} — abstract brass-age glyphsand circles — resting on an antique desk.`,
  },
  {
    id: "reggae",
    keywords: ["reggae", "dub", "ska", "dancehall", "marley", "rastafari", "tosh"],
    prompt: (a) =>
      `Warm golden-hour sunlight, vintage Jamaican wood aesthetic, tropical/reggae fine-art oil ` +
      `painting concept featuring a typographic album sleeve for ${a} — abstract sun-ray glyphs — ` +
      `on a rustic wooden shelf, relaxed atmosphere.`,
  },
  {
    id: "synth",
    keywords: [
      "synth",
      "electro",
      "techno",
      "house",
      "pop",
      "dance",
      "disco",
      "kraftwerk",
      "depeche",
      "wave",
      "neon",
      "edm",
      "eurodance",
    ],
    prompt: (a) =>
      `Retro 80s neon-lit studio aesthetic, moody cyan and magenta ambient lighting, stylized ` +
      `typographic cassette J-card for ${a} — abstract neon glyphsand grid shapes only.`,
  },
];

/** Word-ish boundary match — "dub" must not eat "Double Fantasy". */
export function keywordIn(haystack: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
}

/**
 * Resolve the scene family for one card — pure and deterministic.
 *
 * Mirrors former `cardArtworkScene` in cardArtwork.server.ts — moved here(
 * same signature) so test imports keep working and the client cache key
 * can never diverge from what the server actually generates. Strongest signal
 * first: aesthetic preference, then genre keywords in the song's metadata,
 * then the decade ladder by release year (null year → gothic base).
 */
export function cardArtworkScene(
  input: { aesthetic?: string | null },
  genreText: string,
  releaseYear: number | null,
): string {
  const preference = input.aesthetic?.toLowerCase() ?? "";
  for (const spec of SCENE_SPECS) {
    if (preference && spec.keywords.some((k) => preference.includes(k))) return spec.id;
  }
  const haystack = genreText.toLowerCase();
  for (const spec of SCENE_SPECS) {
    if (spec.keywords.some((k) => keywordIn(haystack, k))) return spec.id;
  }
  if (releaseYear === null) return "gothic";
  if (releaseYear <= 1969) return "jazz";
  if (releaseYear <= 1979) return "soul";
  if (releaseYear <= 1989) return "synth";
  if (releaseYear <= 1999) return "grunge";
  return "hiphop";
}
