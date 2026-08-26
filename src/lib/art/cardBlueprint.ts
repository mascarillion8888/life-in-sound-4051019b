/**
 * Multidimensional Dynamic Card Blueprint — the card-studio port's prompt
 * synthesis engine, rebuilt on the core stack.
 *
 * Three correlated dimensions shape every painting:
 *   1. Time:  birthYear + encounterAge → historicalEraYear (e.g. 1987) —
 *      the room's objects/technology match the year the listener actually
 *      lived the encounter, not the song's release year alone.
 *   2. Genre: the listener's genre preference steers room details, lighting
 *      and ambient objects (gothic folk candlelight vs. hiphop studio glow).
 *   3. Subject: a fixed visual blueprint — the child silhouette absorbed in
 *      music, gazing at a TYPOGRAPHIC vinyl sleeve (abstract glyphs only —
 *      never a photographic face or portrait, no painted artist likeness
 *      anywhere). Card titles live in the HTML layer; the painting renders
 *      the scene only, never card text.
 *
 * Pure and deterministic — no I/O, no randomness. The same encounter always
 * synthesizes the same brief, so the prompt is safe to use as a cache
 * identity downstream.
 */

export type CardEncounter = {
  artist: string;
  songTitle: string;
  /** Listener's birth year — combined with encounterAge for the era year. */
  birthYear?: number | null;
  /** Listener's age when the song was first encountered. */
  encounterAge?: number | null;
  /** Genre preference / track genre — steers room + lighting. */
  genre?: string | null;
  /** Track release year — secondary era signal. */
  releaseYear?: number | null;
  /** Optional personal memory fragment woven into the atmosphere. */
  userMemory?: string | null;
};

/** birthYear + encounterAge → the historical year of the encounter. */
export function historicalEraYear(encounter: CardEncounter): number | null {
  const { birthYear, encounterAge } = encounter;
  if (
    typeof birthYear !== "number" ||
    !Number.isFinite(birthYear) ||
    typeof encounterAge !== "number" ||
    !Number.isFinite(encounterAge)
  ) {
    return null;
  }
  return Math.floor(birthYear) + Math.floor(encounterAge);
}

/** Decade label for prompt text, e.g. "1980s" — null when era is unknown. */
export function eraDecadeLabel(encounter: CardEncounter): string | null {
  const eraYear = historicalEraYear(encounter) ?? encounter.releaseYear ?? null;
  if (eraYear === null || !Number.isFinite(eraYear)) return null;
  return `${Math.floor(eraYear / 10) * 10}s`;
}

type GenreRoom = {
  keywords: string[];
  room: string;
  lighting: string;
  objects: string;
};

/**
 * Genre → room/lighting/ambient-object correlation. Order matters: the
 * first matching family wins (soul before jazz, as in the scene ladder).
 */
const GENRE_ROOMS: GenreRoom[] = [
  {
    keywords: ["goth", "doom", "folk", "metal", "rock", "punk", "acoustic"],
    room: "a wood-panelled bedroom with carved dark furniture",
    lighting: "a single warm desk lamp and candlelight",
    objects: "vinyl records leaning against the wall, a cassette deck, faded band posters",
  },
  {
    keywords: ["rap", "hiphop", "hip hop", "trap", "boom bap"],
    room: "a small bedroom doubling as a home studio",
    lighting: "the plum glow of a desk lamp against violet walls",
    objects: "a pair of studio monitors, stacked CDs, a gold-framed poster",
  },
  {
    keywords: ["grunge", "alternative", "shoegaze", "britpop"],
    room: "a cluttered basement bedroom",
    lighting: "a dim slate-grey lamp fighting the dark",
    objects:
      "a worn guitar in the corner, gig flyers tacked to the wall, a plaid shirt on the chair",
  },
  {
    keywords: ["soul", "funk", "motown", "rnb", "rhythm and blues"],
    room: "a warm bedroom with velvet curtains",
    lighting: "an amber lamp pooling honey-coloured light",
    objects: "a turntable, a crate of 45s, a framed concert ticket",
  },
  {
    keywords: ["jazz", "blues", "swing", "bebop"],
    room: "a quiet bedroom with an antique wooden desk",
    lighting: "a brass-shaded lamp glowing through a smoky haze",
    objects: "a vinyl sleeve open on the desk, a small radio, sheet music",
  },
  {
    keywords: ["reggae", "dub", "ska", "dancehall"],
    room: "a sun-warmed bedroom with rustic wooden shelves",
    lighting: "golden-hour light through thin curtains",
    objects: "a record player, woven tapestries, a small potted plant",
  },
  {
    keywords: ["synth", "electro", "pop", "dance", "disco", "techno", "wave"],
    room: "a bedroom lit by a CRT glow",
    lighting: "cool neon spill from a portable TV mixing with the desk lamp",
    objects: "a walkman with foam headphones, stacked cassettes, a Rubik's cube",
  },
];

const DEFAULT_ROOM: Omit<GenreRoom, "keywords"> = {
  room: "a dimly lit bedroom",
  lighting: "a warm desk lamp",
  objects: "well-loved records and handwritten notes on the desk",
};

function genreRoom(genre: string | null | undefined): Omit<GenreRoom, "keywords"> {
  const haystack = (genre ?? "").toLowerCase();
  if (!haystack) return DEFAULT_ROOM;
  for (const entry of GENRE_ROOMS) {
    if (entry.keywords.some((k) => haystack.includes(k))) {
      return { room: entry.room, lighting: entry.lighting, objects: entry.objects };
    }
  }
  return DEFAULT_ROOM;
}

/**
 * Resolve the scene family for one encounter — mirrors the scene ladder in
 * `cardArtwork.server.ts` (genre keyword families first, then the decade
 * ladder on the encounter's era year, gothic as the null fallback) so the
 * multidimensional card and the classic era card share one visual identity.
 */
export function cardArtworkSceneForGenre(encounter: CardEncounter): string {
  const haystack = (encounter.genre ?? "").toLowerCase();
  const families: [string, string[]][] = [
    ["gothic", ["goth", "doom", "folk", "metal", "rock", "punk", "acoustic", "classical"]],
    ["hiphop", ["rap", "hiphop", "hip hop", "trap", "boom bap"]],
    ["grunge", ["grunge", "alternative", "shoegaze", "britpop"]],
    ["soul", ["soul", "funk", "motown", "rnb", "rhythm and blues"]],
    ["jazz", ["jazz", "blues", "swing", "bebop"]],
    ["reggae", ["reggae", "dub", "ska", "dancehall"]],
    ["synth", ["synth", "electro", "pop", "dance", "disco", "techno", "wave"]],
  ];
  for (const [id, keywords] of families) {
    if (haystack && keywords.some((k) => haystack.includes(k))) return id;
  }
  const year = historicalEraYear(encounter) ?? encounter.releaseYear ?? null;
  if (year === null) return "gothic";
  if (year <= 1969) return "jazz";
  if (year <= 1979) return "soul";
  if (year <= 1989) return "synth";
  if (year <= 1999) return "grunge";
  return "hiphop";
}

/**
 * Synthesize the full painting brief from the encounter. The three
 * blueprint sentences are fixed in structure (subject / framing / style);
 * the era year, genre room and optional memory fill the variables.
 */
export function buildMultidimensionalPrompt(encounter: CardEncounter): string {
  const age =
    typeof encounter.encounterAge === "number" && Number.isFinite(encounter.encounterAge)
      ? Math.floor(encounter.encounterAge)
      : null;
  const eraLabel = eraDecadeLabel(encounter);
  const { room, lighting, objects } = genreRoom(encounter.genre);
  const artist = encounter.artist.trim() || "the artist";

  const subject = age
    ? `A silhouette of a child (aged ${age}) sitting in ${room} wearing over-ear headphones, ` +
      `deeply absorbed in music.`
    : `A silhouette of a child sitting in ${room} wearing over-ear headphones, ` +
      `deeply absorbed in music.`;

  // Typographic sleeve replaces the artist portrait: abstract glyphs and
  // geometry only — no photographic face, no painted likeness, no real
  // lettering. Card titles live in the HTML layer, never inside the painting.
  const framing =
    `The child holds and gazes at a vinyl album sleeve: pure abstract typographic design — ` +
    `stylized unreadable glyphs and geometric shapes (light rays, circles, angular forms) on a ` +
    `flat muted background, ${artist === "the artist" ? "" : `evoking ${artist}'s aesthetic, `}` +
    `subtly lit by ${lighting}. Absolutely no photographic face, portrait or human figure on the ` +
    `sleeve, and no painted artist portrait anywhere in the scene. Render only the scene — never ` +
    `draw card titles, headings or any readable text into the image.`;

  const eraDetail = eraLabel
    ? `nostalgic ${eraLabel} atmospheric room elements (${objects})`
    : `timeless nostalgic room elements (${objects})`;

  const atmosphere =
    `Dark gothic woodcut engraving style, candlelit chiaroscuro, etched ink textures, ` +
    `${eraDetail}. The song '${encounter.songTitle}' fills the room.`;

  const memory = encounter.userMemory?.trim()
    ? ` Personal memory woven into the scene: ${encounter.userMemory.trim()}.`
    : "";

  return `${subject} ${framing} ${atmosphere}${memory}`;
}

/* -------------------------------------------------------------------------- */
/* Poetic lore — the 2-sentence nostalgia snippet for the card's lore box     */
/* -------------------------------------------------------------------------- */

const LORE_OPENERS = [
  "A child sits in a dim room, headphones on, the whole world shrinking to a single song.",
  "In the lamplight of a small bedroom, a young listener meets the song that will follow them for years.",
  "The house is quiet; only the headphones glow with sound, and something in the child quietly changes.",
  "A door closes, a record spins, and a private universe opens between two ears.",
] as const;

const LORE_CLOSERS = [
  "The first spark is struck — and a whole world opens up.",
  "Nothing outside the room exists for three and a half minutes.",
  "Some doors, once opened by a melody, never fully close again.",
  "Years later, the first notes still bring back the lamplight.",
] as const;

function stableHash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic 2-sentence lore fallback. Track-seeded so the same song
 * always reads the same snippet; used whenever the LLM lore path is absent
 * or fails — the card never ships an empty lore box.
 */
export function deterministicLore(encounter: CardEncounter): string {
  const hash = stableHash(
    `${encounter.artist}::${encounter.songTitle}::${encounter.encounterAge ?? ""}`,
  );
  const opener = LORE_OPENERS[hash % LORE_OPENERS.length];
  const closer = LORE_CLOSERS[Math.floor(hash / LORE_OPENERS.length) % LORE_CLOSERS.length];
  return `${opener} ${closer}`;
}
