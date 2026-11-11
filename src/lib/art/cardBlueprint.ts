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
  /** Journey position (0-based) — life-stage fallback when the age is unknown. */
  cardIndex?: number | null;
  /** The song's mood (e.g. "Nostalgic", "Joy") — colours the lore's feeling. */
  mood?: string | null;
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

/* -------------------------------------------------------------------------- */
/* Life stages — the lore's tone follows the listener's age at the encounter  */
/* -------------------------------------------------------------------------- */

export type LifeStage = {
  /** Journey-era index 0..7 (matches the eight life cards). */
  index: number;
  /** Who the lore is about, for the LLM prompt ("a teenager"). */
  subject: string;
  /** Emotional tone brief for the LLM prompt. */
  tone: string;
  /** Deterministic poetic lines; {t} = song title, {a} = artist. Each is 2 sentences. */
  lines: readonly string[];
};

const LIFE_STAGES: readonly LifeStage[] = [
  {
    index: 0,
    subject: "a young child",
    tone: "pure enchantment: the first time a sound feels like magic, feelings too new for words, everything soft and vast",
    lines: [
      "The first time {t} played, {a}'s voice wrapped around a small soul and would not let go. Feelings with no names yet began to rise.",
      "A child heard {a} sing {t}, and the whole room turned to light. Something nameless woke up inside.",
      "{t} arrived like a spell, and {a}'s voice settled over a young heart. Wonder, wide and nameless, filled the room.",
    ],
  },
  {
    index: 1,
    subject: "a child growing into their own taste",
    tone: "the first threshold where taste becomes a mirror: choosing a sound that is truly theirs, a first private identity",
    lines: [
      "With {t}, a sound became truly theirs for the first time. {a} turned into a mirror, and a new self looked back.",
      "Somewhere between childhood and the wide world, {t} became a tiny flag. {a} was the first voice chosen all alone.",
      "Pressing play on {t}, a young listener felt that {a}'s music belonged to them. It was the first line of a signature.",
    ],
  },
  {
    index: 2,
    subject: "a teenager",
    tone: "rebellion and refuge: volume louder than feeling, restless heartbeats finding an anthem, identity forged in sound",
    lines: [
      "{t} turned up the volume on everything unsaid. With {a} nearby, every restless heartbeat found an anthem.",
      "The world was too loud and too quiet at once, until {a} played {t}. A wild young heart finally had a banner to carry.",
      "All lightning and questions, a teenager found thunder in {a}'s {t}. Louder felt like truer.",
    ],
  },
  {
    index: 3,
    subject: "a young adult at the edge of everything",
    tone: "open doors and more questions than answers: new cities, uncertainty turning into courage, the road wide open",
    lines: [
      "Doors opened everywhere, and {t} played softly behind every question. {a} gave no answers, only the courage to keep asking.",
      "New cities, new faces, old songs: {a}'s {t} walked through the great unknown. Each question made the road feel braver.",
      "Questions gathered like stars, and {a}'s {t} lit a few of them. The sky of possibilities stayed wide open.",
    ],
  },
  {
    index: 4,
    subject: "a grown listener finding their strength",
    tone: "fragility wrought into armor: resilience, hard mornings, steadiness found in a song",
    lines: [
      "Life asked for strength, and {t} answered in {a}'s voice. What once felt fragile quietly became armor.",
      "Standing tall on shaky ground, a heart kept time with {a}'s {t}. Soft turned out to be a kind of steel.",
      "Every hard morning had a soundtrack, and {a}'s {t} said keep going. The heart listened, and grew stronger.",
    ],
  },
  {
    index: 5,
    subject: "an adult in the quieter, darker hours",
    tone: "sound arriving before light: long nights, comfort, a song that keeps the silence company until morning",
    lines: [
      "In the long dark hours, {t} arrived before the dawn did. {a} kept the silence company until the light found its way back.",
      "When the lights went out, the sound stayed: {a} singing {t}. In that gentle dark, breathing felt possible again.",
      "Some nights are only bearable with one song, and {a}'s {t} was the one. It carried the hours until morning.",
    ],
  },
  {
    index: 6,
    subject: "a seasoned listener with a long memory",
    tone: "longing and memory: loss made portable through music, people and places living inside a melody",
    lines: [
      "{t} carries every goodbye ever whispered. In {a}'s voice, loss became something to hold gently.",
      "Time took a few things and left {t} behind. {a} showed that what is missed can travel, folded inside a melody.",
      "The people and places long gone live inside {t}. Press play, and {a} opens the door to them once more.",
    ],
  },
  {
    index: 7,
    subject: "a listener at peace with the journey",
    tone: "acceptance: inquiry and peace meeting in one melody, the whole story finally making quiet sense",
    lines: [
      "Now {t} sounds like peace after a long journey. {a} sings what is finally understood: every question was part of the melody.",
      "After all these years, {t} still finds its listener. With {a} humming along, the whole story makes quiet sense.",
      "Here, in the present, {t} feels like coming home. {a} plays the last chord, and nothing is missing.",
    ],
  },
];

/**
 * Life stage for one encounter: from the listener's age when known, otherwise
 * from the journey position (the last card, "Now", has no age). Null when
 * neither signal exists — callers then keep their generic wording.
 */
export function lifeStageFor(encounter: CardEncounter): LifeStage | null {
  const age = encounter.encounterAge;
  if (typeof age === "number" && Number.isFinite(age) && age > 0) {
    const a = Math.floor(age);
    const i = a <= 9 ? 0 : a <= 12 ? 1 : a <= 17 ? 2 : a <= 22 ? 3 : a <= 29 ? 4 : a <= 39 ? 5 : 6;
    return LIFE_STAGES[i];
  }
  const idx = encounter.cardIndex;
  if (typeof idx === "number" && Number.isFinite(idx) && idx >= 0 && idx < LIFE_STAGES.length) {
    return LIFE_STAGES[Math.floor(idx)];
  }
  return null;
}

/**
 * Deterministic 2-sentence lore fallback. Track-seeded so the same song
 * always reads the same snippet; used whenever the LLM lore path is absent
 * or fails — the card never ships an empty lore box. With a known life stage
 * the poetry follows it and names the song and artist; without one the
 * generic lines are kept.
 *
 * The optional `language` selects a localized line set (tr/en/es/de/fr). The
 * English stage lines above are the default (used for `en` and unknown
 * languages); Turkish, Spanish, German and French have their own short,
 * natural, place-free lines. Every line names only the song and artist — no
 * invented events or places.
 */
export function deterministicLore(encounter: CardEncounter, language?: string): string {
  const hash = stableHash(
    `${encounter.artist}::${encounter.songTitle}::${encounter.encounterAge ?? ""}`,
  );
  const key = languageKey(language);
  const set = LOCALIZED[key] ?? DEFAULT_LORE_LINES;
  const stage = lifeStageFor(encounter);
  if (stage) {
    const lines = set.stages[stage.index];
    const line = lines[hash % lines.length];
    return fillLine(line, encounter, key);
  }
  const opener = set.openers[hash % set.openers.length];
  const closer = set.closers[Math.floor(hash / set.openers.length) % set.closers.length];
  return `${opener} ${closer}`;
}

/** Substitute {t} (song) and {a} (artist), with localized placeholders. */
function fillLine(line: string, encounter: CardEncounter, key: string): string {
  const words = PLACEHOLDERS[key] ?? PLACEHOLDERS.en;
  const song = encounter.songTitle.trim()
    ? `\u201C${encounter.songTitle.trim()}\u201D`
    : words.song;
  const artist = encounter.artist.trim() || words.artist;
  return line.replace(/\{t\}/g, song).replace(/\{a\}/g, artist);
}

/** Map a language display name ("Türkçe") or code ("tr") to the line-set key. */
function languageKey(language: string | undefined): string {
  if (!language) return "en";
  const l = language.toLowerCase();
  if (l === "tr" || l.startsWith("türk")) return "tr";
  if (l === "en" || l.startsWith("engl")) return "en";
  if (l === "es" || l.startsWith("espa")) return "es";
  if (l === "de" || l.startsWith("deut")) return "de";
  if (l === "fr" || l.startsWith("fran")) return "fr";
  return l;
}

type LoreLineSet = {
  openers: readonly string[];
  closers: readonly string[];
  /** One line array per life stage, indexed 0..7. */
  stages: readonly (readonly string[])[];
};

const DEFAULT_LORE_LINES: LoreLineSet = {
  openers: LORE_OPENERS,
  closers: LORE_CLOSERS,
  stages: LIFE_STAGES.map((stage) => stage.lines),
};

const PLACEHOLDERS: Record<string, { song: string; artist: string }> = {
  en: { song: "this song", artist: "the music" },
  tr: { song: "adı bilinmeyen bir şarkı", artist: "bilinmeyen bir sanatçı" },
  es: { song: "esta canción", artist: "la música" },
  de: { song: "dieses Lied", artist: "die Musik" },
  fr: { song: "cette chanson", artist: "la musique" },
};

/**
 * Localized line sets for the non-English UI languages. Turkish is a genuine
 * Turkish set (the English `LIFE_STAGES` lines are the default, not Turkish).
 * Each stage line is 1–2 short sentences and never invents a place or event.
 */
const LOCALIZED: Record<string, LoreLineSet> = {
  tr: {
    openers: [
      "Bütün dünya tek bir şarkıya daralır; geriye yalnızca o ses kalır.",
      "Küçük bir an, tek bir şarkıyla yıllarca taşınan bir hâle dönüşür.",
      "Sessizlik içinde bir şarkı başlar ve içeride bir şey usulca değişir.",
      "Bir şarkı başlar ve iki kulak arasında özel bir evren açılır.",
    ],
    closers: [
      "İlk kıvılcım çakar ve koca bir dünya açılır.",
      "Birkaç dakika boyunca dışarıda hiçbir şey yoktur.",
      "Bir melodiyle açılan bazı kapılar bir daha tam kapanmaz.",
      "Yıllar sonra ilk notalar hâlâ o anı geri getirir.",
    ],
    stages: [
      [
        "{t}, {a}'ın sesiyle dünyaya ilk kez büyülü bir kapı açtı.",
        "{a}'ı dinlerken {t} ile tanışan çocuk, henüz adı olmayan bir hayranlıkla doldu.",
        "{t} çaldığında dünya genişledi; {a}'ın sesi ilk büyük hayali uyandırdı.",
      ],
      [
        "{t} ile kendi sesini ilk kez seçti; {a} bir aynaya dönüştü.",
        "Çocuklukla dünya arasında {t} küçük bir bayrak oldu; {a} tek başına seçtiği ilk sesti.",
        "{t}'i çalarken müziğin kendisine ait olduğunu hissetti; {a} kendi imzasının ilk satırıydı.",
      ],
      [
        "{t} söylenmeyen her şeyin sesini yükseltti; {a} ile her huzursuz kalp bir marş buldu.",
        "Dünya hem çok gürültülü hem çok sessizdi, ta ki {a} {t}'i çalana kadar; genç bir yürek taşıyacak bir bayrak buldu.",
        "Şimşek ve sorular içinde {t} bir kimliğe dönüştü; {a} isyanı duyulur kıldı.",
      ],
      [
        "Kapılar her yere açıldı ve {t} her sorunun ardında çaldı; {a} cevap değil, sormaya devam etme cesareti verdi.",
        "Yeni şehirler, yeni yüzler, eski şarkılar: {a}'ın {t}'i bilinmeyenin içinden geçti.",
        "Sorular yıldızlar gibi birikti; {a}'ın {t}'i birkaçını aydınlattı ve olasılıkların göğü açık kaldı.",
      ],
      [
        "Hayat güç istedi ve {t} {a}'ın sesiyle cevap verdi; kırılgan görünen şey sessizce zırha dönüştü.",
        "Sarsak zeminde dimdik duran bir kalp {a}'ın {t}'iyle ritim tuttu; yumuşaklık bir tür çeliğe dönüştü.",
        "Her zor sabahın bir müziği vardı; {a}'ın {t}'i devam et dedi ve kalp dinledi.",
      ],
      [
        "Uzun karanlık saatlerde {t} şafaktan önce geldi; {a} ışık geri dönene kadar sessizliğe eşlik etti.",
        "Işıklar sönünce ses kaldı: {a} {t}'i söyledi; o yumuşak karanlıkta nefes almak yeniden mümkün oldu.",
        "Bazı geceler tek bir şarkıyla taşınır; {a}'ın {t}'i sabaha kadar o saatleri taşıdı.",
      ],
      [
        "{t} fısıldanmış her vedayı taşır; {a}'ın sesinde kayıp, usulca tutulacak bir şeye dönüştü.",
        "Zaman birkaç şeyi alıp {t}'i bıraktı; {a} özlenenin bir melodide taşınabileceğini gösterdi.",
        "Çoktan gitmiş insanlar ve yerler {t}'in içinde yaşar; çal, {a} o kapıyı bir kez daha açar.",
      ],
      [
        "Şimdi {t} uzun bir yolun ardından huzur gibi tınlıyor; {a} nihayet anlaşılanı söylüyor.",
        "Bunca yıl sonra {t} hâlâ dinleyicisini buluyor; {a} eşlik ederken bütün hikâye sessizce anlam kazanıyor.",
        "Burada, şimdide, {t} eve dönüş gibi; {a} son akoru çalıyor ve hiçbir şey eksik değil.",
      ],
    ],
  },
  es: {
    openers: [
      "El mundo entero se reduce a una sola canción; solo queda esa voz.",
      "Un instante pequeño se vuelve un lugar que se lleva durante años.",
      "En el silencio empieza una canción y algo cambia por dentro.",
      "Empieza una canción y se abre un universo privado entre dos oídos.",
    ],
    closers: [
      "Se enciende la primera chispa y se abre todo un mundo.",
      "Durante unos minutos, fuera no existe nada.",
      "Algunas puertas que abre una melodía no vuelven a cerrarse del todo.",
      "Años después, las primeras notas siguen trayendo aquel momento.",
    ],
    stages: [
      [
        "La primera vez que sonó {t}, la voz de {a} abrió una puerta mágica al mundo.",
        "Al escuchar a {a}, quien descubrió {t} se llenó de una admiración aún sin nombre.",
        "Cuando sonó {t}, el mundo se hizo más grande; la voz de {a} despertó un primer gran sueño.",
      ],
      [
        "Con {t} eligió su propia voz por primera vez; {a} se volvió un espejo.",
        "Entre la infancia y el mundo, {t} fue una pequeña bandera; {a} fue la primera voz elegida a solas.",
        "Al poner {t} sintió que la música era suya; {a} fue la primera línea de su firma.",
      ],
      [
        "{t} subió el volumen de todo lo no dicho; con {a}, cada corazón inquieto encontró un himno.",
        "El mundo era demasiado ruidoso y demasiado silencioso hasta que {a} puso {t}; un corazón joven encontró una bandera.",
        "Entre rayos y preguntas, {t} se volvió una identidad; {a} hizo audible la rebeldía.",
      ],
      [
        "Se abrieron puertas por todas partes y {t} sonó detrás de cada pregunta; {a} dio valor para seguir preguntando.",
        "Ciudades nuevas, rostros nuevos, canciones viejas: {t} de {a} cruzó lo desconocido.",
        "Las preguntas se juntaron como estrellas; {t} de {a} iluminó algunas y el cielo quedó abierto.",
      ],
      [
        "La vida pidió fuerza y {t} respondió con la voz de {a}; lo frágil se volvió armadura en silencio.",
        "Un corazón firme sobre suelo inestable siguió el ritmo de {t} de {a}; lo suave se volvió acero.",
        "Cada mañana dura tenía su música; {t} de {a} dijo sigue y el corazón escuchó.",
      ],
      [
        "En las horas oscuras {t} llegó antes del amanecer; {a} acompañó al silencio hasta que volvió la luz.",
        "Cuando se apagó la luz quedó el sonido: {a} cantó {t}; en esa oscuridad suave se pudo respirar otra vez.",
        "Algunas noches solo se sostienen con una canción; {t} de {a} llevó esas horas hasta la mañana.",
      ],
      [
        "{t} guarda cada adiós susurrado; en la voz de {a} la pérdida se volvió algo que se sostiene con cuidado.",
        "El tiempo se llevó unas cosas y dejó {t}; {a} mostró que lo que se añora viaja dentro de una melodía.",
        "Las personas y los lugares que se fueron viven dentro de {t}; ponla y {a} abre esa puerta otra vez.",
      ],
      [
        "Ahora {t} suena como paz tras un largo camino; {a} canta lo que por fin se entiende.",
        "Tras tantos años {t} sigue encontrando a quien la escucha; con {a}, toda la historia cobra sentido.",
        "Aquí, en el presente, {t} se siente como volver a casa; {a} toca el último acorde y nada falta.",
      ],
    ],
  },
  de: {
    openers: [
      "Die ganze Welt schrumpft auf ein einziges Lied; nur diese Stimme bleibt.",
      "Ein kleiner Augenblick wird zu einem Ort, den man jahrelang trägt.",
      "In der Stille beginnt ein Lied, und innen verändert sich etwas leise.",
      "Ein Lied beginnt, und zwischen zwei Ohren öffnet sich ein eigener Kosmos.",
    ],
    closers: [
      "Der erste Funke springt über, und eine ganze Welt öffnet sich.",
      "Für ein paar Minuten existiert draußen nichts.",
      "Manche Türen, die eine Melodie öffnet, schließen sich nie ganz.",
      "Jahre später bringen die ersten Töne noch immer jenen Moment zurück.",
    ],
    stages: [
      [
        "Als {t} zum ersten Mal lief, öffnete {a}s Stimme eine magische Tür zur Welt.",
        "Wer {a} hörte und {t} entdeckte, füllte sich mit einer noch namenlosen Bewunderung.",
        "Als {t} lief, wurde die Welt größer; {a}s Stimme weckte einen ersten großen Traum.",
      ],
      [
        "Mit {t} wählte es zum ersten Mal die eigene Stimme; {a} wurde zum Spiegel.",
        "Zwischen Kindheit und Welt wurde {t} zu einer kleinen Flagge; {a} war die erste ganz allein gewählte Stimme.",
        "Beim Abspielen von {t} spürte es, dass die Musik ihm gehörte; {a} war die erste Zeile einer Signatur.",
      ],
      [
        "{t} drehte die Lautstärke für alles Ungesagte auf; mit {a} fand jedes unruhige Herz eine Hymne.",
        "Die Welt war zu laut und zu still, bis {a} {t} spielte; ein junges Herz fand eine Flagge.",
        "Zwischen Blitz und Fragen wurde {t} zu einer Identität; {a} machte die Rebellion hörbar.",
      ],
      [
        "Überall öffneten sich Türen, und {t} spielte hinter jeder Frage; {a} gab Mut weiterzufragen.",
        "Neue Städte, neue Gesichter, alte Lieder: {a}s {t} ging durch das Unbekannte.",
        "Die Fragen sammelten sich wie Sterne; {a}s {t} erhellte einige, und der Himmel blieb offen.",
      ],
      [
        "Das Leben verlangte Stärke, und {t} antwortete mit {a}s Stimme; das Zerbrechliche wurde leise zur Rüstung.",
        "Ein Herz stand fest auf schwankendem Grund im Takt von {a}s {t}; das Weiche wurde zu einer Art Stahl.",
        "Jeder harte Morgen hatte eine Musik; {a}s {t} sagte weiter, und das Herz hörte zu.",
      ],
      [
        "In den langen dunklen Stunden kam {t} vor der Dämmerung; {a} leistete dem Schweigen Gesellschaft, bis das Licht zurückkam.",
        "Als das Licht ausging, blieb der Klang: {a} sang {t}; in diesem sanften Dunkel war Atmen wieder möglich.",
        "Manche Nächte trägt nur ein einziges Lied; {a}s {t} trug diese Stunden bis zum Morgen.",
      ],
      [
        "{t} trägt jeden geflüsterten Abschied; in {a}s Stimme wurde Verlust zu etwas, das man sanft hält.",
        "Die Zeit nahm einiges und ließ {t} zurück; {a} zeigte, dass Vermisstes in einer Melodie reisen kann.",
        "Die längst gegangenen Menschen und Orte leben in {t}; spiel es, und {a} öffnet diese Tür noch einmal.",
      ],
      [
        "Jetzt klingt {t} wie Frieden nach einem langen Weg; {a} singt, was endlich verstanden ist.",
        "Nach all den Jahren findet {t} noch immer seine Hörer; mit {a} ergibt die ganze Geschichte leisen Sinn.",
        "Hier, in der Gegenwart, fühlt sich {t} wie Heimkommen an; {a} spielt den letzten Akkord, und nichts fehlt.",
      ],
    ],
  },
  fr: {
    openers: [
      "Le monde entier se réduit à une seule chanson ; seule cette voix demeure.",
      "Un petit instant devient un lieu qu'on porte pendant des années.",
      "Dans le silence, une chanson commence et quelque chose change au-dedans.",
      "Une chanson commence, et un univers privé s'ouvre entre deux oreilles.",
    ],
    closers: [
      "La première étincelle jaillit, et tout un monde s'ouvre.",
      "Pendant quelques minutes, dehors il n'existe rien.",
      "Certaines portes qu'ouvre une mélodie ne se referment jamais tout à fait.",
      "Des années plus tard, les premières notes ramènent encore cet instant.",
    ],
    stages: [
      [
        "La première fois que {t} a joué, la voix de {a} a ouvert une porte magique sur le monde.",
        "En écoutant {a}, celui qui a découvert {t} s'est rempli d'une admiration encore sans nom.",
        "Quand {t} a joué, le monde s'est agrandi ; la voix de {a} a réveillé un premier grand rêve.",
      ],
      [
        "Avec {t}, il a choisi sa propre voix pour la première fois ; {a} est devenu un miroir.",
        "Entre l'enfance et le monde, {t} est devenu un petit drapeau ; {a} fut la première voix choisie seul.",
        "En lançant {t}, il a senti que la musique lui appartenait ; {a} fut la première ligne d'une signature.",
      ],
      [
        "{t} a monté le volume sur tout ce qui restait tu ; avec {a}, chaque cœur agité a trouvé un hymne.",
        "Le monde était trop bruyant et trop silencieux jusqu'à ce que {a} joue {t} ; un jeune cœur a trouvé un drapeau.",
        "Entre éclairs et questions, {t} est devenu une identité ; {a} a rendu la révolte audible.",
      ],
      [
        "Des portes s'ouvraient partout et {t} jouait derrière chaque question ; {a} a donné le courage de continuer à demander.",
        "Villes nouvelles, visages nouveaux, chansons anciennes : {t} de {a} a traversé l'inconnu.",
        "Les questions se sont amassées comme des étoiles ; {t} de {a} en a éclairé quelques-unes et le ciel est resté ouvert.",
      ],
      [
        "La vie a demandé de la force et {t} a répondu par la voix de {a} ; ce qui semblait fragile est devenu une armure.",
        "Un cœur debout sur un sol instable a suivi le rythme de {t} de {a} ; la douceur est devenue une sorte d'acier.",
        "Chaque matin difficile avait sa musique ; {t} de {a} a dit continue, et le cœur a écouté.",
      ],
      [
        "Dans les longues heures sombres, {t} est arrivé avant l'aube ; {a} a tenu compagnie au silence jusqu'au retour de la lumière.",
        "Quand la lumière s'est éteinte, le son est resté : {a} a chanté {t} ; dans cette douce obscurité, respirer est redevenu possible.",
        "Certaines nuits ne tiennent qu'à une seule chanson ; {t} de {a} a porté ces heures jusqu'au matin.",
      ],
      [
        "{t} porte chaque adieu murmuré ; dans la voix de {a}, la perte est devenue quelque chose qu'on tient doucement.",
        "Le temps a pris quelques choses et a laissé {t} ; {a} a montré que ce qui manque voyage dans une mélodie.",
        "Les gens et les lieux disparus vivent dans {t} ; lance-la, et {a} rouvre cette porte encore une fois.",
      ],
      [
        "Maintenant {t} sonne comme la paix après un long chemin ; {a} chante ce qui est enfin compris.",
        "Après tant d'années, {t} trouve encore son auditeur ; avec {a}, toute l'histoire prend un sens discret.",
        "Ici, au présent, {t} ressemble à un retour à la maison ; {a} joue le dernier accord, et rien ne manque.",
      ],
    ],
  },
};
