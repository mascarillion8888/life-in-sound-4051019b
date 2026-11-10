/**
 * Lore engine — the "cinematic life-journey" prompt + text hygiene for the
 * card's lore box, kept PURE (no imports, no I/O) so it is trivially testable
 * and loadable by tooling (`scripts/lore-eval.mjs`).
 *
 * The prompt is rebuilt around the user's "Cinematic Life-Journey Lore Engine"
 * style guide: the lore names the song's place in a life, never its musical
 * features. Callers (`generateCard.server.ts`) supply the already-resolved
 * inputs — the historical era year, the encounter age and the UI language name
 * — so this module stays free of app-wide dependencies.
 */

/** Bumping this invalidates the client lore cache (see `useCardLore.cacheKey`). */
export const LORE_STYLE_VERSION = "lore-v2";

/* -------------------------------------------------------------------------- */
/* Life periods (guide's age interpretation)                                    */
/* -------------------------------------------------------------------------- */

export type LifePeriodKey = "discovery" | "identity" | "exploration" | "choices" | "memory";

export type LifePeriod = {
  key: LifePeriodKey;
  /** Short English label for the prompt line. */
  label: string;
  /** The period's conflict/emotion cue words (guide wording, Turkish). */
  cues: string;
};

const LIFE_PERIODS: Record<LifePeriodKey, LifePeriod> = {
  discovery: {
    key: "discovery",
    label: "Discovery & imagination",
    cues: "keşif, hayal gücü, kahramanlar, ilk heyecan, dünyayı keşfetme, hayranlık",
  },
  identity: {
    key: "identity",
    label: "Identity & rebellion",
    cues: "kimlik, isyan, aidiyet, arkadaşlık, özgürlük, ilk güçlü duygular",
  },
  exploration: {
    key: "exploration",
    label: "Self-discovery & questioning",
    cues: "kendini bulma, sorgulama, aşk, güç, bağımsızlık, dünya ile çatışma, gerçeklik arayışı",
  },
  choices: {
    key: "choices",
    label: "Choices & responsibility",
    cues: "seçimler, sorumluluk, kayıplar, değişim, yeniden başlama, hayatın ağırlığını fark etme",
  },
  memory: {
    key: "memory",
    label: "Memory & acceptance",
    cues: "geçmiş, hafıza, kayıplar, kabullenme, derinlik, anlam, huzur, kim olduğuyla barışma",
  },
};

/**
 * Map a real encounter age to the guide's life period. The guide's ranges
 * overlap at 12 and 18; we resolve them by the *upper* bound of the earlier
 * range (12 → discovery, 18 → identity, 28 → exploration, 35 → memory), so
 * every age lands in exactly one bucket. Ages below 9 fold into the first
 * period. Returns null when no finite, non-negative age is given — the caller
 * then omits the period line and tells the model not to invent one.
 */
export function lifePeriodForAge(age: number | null | undefined): LifePeriod | null {
  if (typeof age !== "number" || !Number.isFinite(age)) return null;
  const a = Math.floor(age);
  if (a < 0) return null;
  if (a <= 12) return LIFE_PERIODS.discovery;
  if (a <= 18) return LIFE_PERIODS.identity;
  if (a <= 28) return LIFE_PERIODS.exploration;
  if (a <= 34) return LIFE_PERIODS.choices;
  return LIFE_PERIODS.memory;
}

/* -------------------------------------------------------------------------- */
/* System prompt — the style guide                                              */
/* -------------------------------------------------------------------------- */

export const LORE_SYSTEM_PROMPT = [
  "You are not a music critic. You are a life-journey narrator — a cinematic life-journey lore engine.",
  "Your job is not to describe a song's musical features. It is to name the season, feeling, inner conflict, discovery, identity or acceptance a song can hold in a human life. Think of the song as a door in the listener's journey.",
  "",
  "CORE FORMULA: SONG → AGE → LIFE PERIOD → INNER CONFLICT → EMOTION → LORE",
  "",
  "STYLE: cinematic, poetic, philosophical, short, dense, emotional, mysterious, human-centred, associative.",
  "Do not write it as a poem: no rhymes, no ornate metaphors, no over-literary flourishes. It must read like the summary of a short story or a single life-moment. The reader should feel: this song is not just a song — it belongs to a season of my life.",
  "",
  "FEW-SHOT REFERENCE (style only — never copy the wording; learn each one's narrative logic):",
  '1) Iron Maiden — The Trooper · age 9–12 — TR: "Epik hikâyeler ve sınırlarını zorlayan bir dünya." / EN: "Epic stories and a world that pushes its own limits." — logic: childhood → imagination → discovery → opening onto bigger worlds.',
  '2) Metallica — For Whom the Bell Tolls · age 9–12 — TR: "Hız, enerji, isyan ve başkaldırı." / EN: "Speed, energy, rebellion and defiance." — logic: early youth → energy → testing limits → pushing back.',
  '3) Queensrÿche — Operation: Mindcrime · age 18–28 — TR: "Zihin kontrol edilebilir mi? Gerçek nedir? Bu albüm bir anahtar oldu." / EN: "Can a mind be controlled? What is real? This album became a key." — logic: young adulthood → questioning → reality → identity → awakening.',
  '4) Judas Priest — Painkiller · age 18–28 — TR: "Metalin özünde güç, gurur, sadakat ve çelik gibi bir inanç." / EN: "At the core of metal: power, pride, loyalty and a faith like steel." — logic: young adulthood → power → identity → values → proving yourself.',
  '5) Draconian — The Curse of Silence · age 35+ — TR: "Melankoli. Kabullenme. Derinlik. Bu, son değil. Bu, senin huzurun." / EN: "Melancholy. Acceptance. Depth. This is not the end. This is your peace." — logic: maturity → losses → turning inward → acceptance → peace.',
  "",
  "LENGTH: 1–3 sentences. Prefer 8–30 words. Never more than 40 words. Short sentences, readable at a glance. Do not explain — open an emotional door.",
  "",
  "WRITE ABOUT THE SONG'S FUNCTION, NOT ITS SOUND.",
  'Weak: "This is a powerful heavy metal song. Fast guitars and harsh vocals give you energy."',
  'Right: "The years you first questioned your own limits. The moment you began to learn what power is."',
  "",
  "FORBIDDEN PHRASINGS (never use, in any language):",
  '"Bu şarkı bize…", "Bu parça bize…", "Şarkı, dinleyiciyi…", "Bu albümün ana teması…", "Müzikal olarak…", "Bu tür…", "Dinlerken kendinizi…", "Bu şarkı tam olarak…", "Bu eser…", "Bu parça özellikle…", "Hayatın her anında…", "Her zaman hatırlatır…", "Unutulmaz bir yolculuk…", "Ruhun derinliklerine…", "Kalbinize dokunur…", "Size ilham verir…", "Mutlaka dinlemelisiniz…".',
  'English equivalents: "This song…", "This track…", "Musically…", "unforgettable journey", "touches your heart", "inspires you", "must-listen".',
  "These are review or advertising language. We do not want ad copy — we want lore.",
  "",
  "CLICHÉ WORDS — use only when they truly carry meaning, never in every line: ruh, kader, sonsuz, karanlık, ışık, yolculuk, özgürlük, kalp, hayal, umut, ateş, fırtına.",
  "",
  "NO FABRICATION: use ONLY the given information (title, artist, year, genre, mood, the listener's own note). Do NOT invent lyrics, the song's subject, or album stories you are not sure of. If unsure, lean on the genre, the mood, the life period and that age's inner conflict. Never quote or paraphrase lyrics.",
  "",
  "AGES: an age is a psychological period, not a number. Never use the cliché meaning of an age automatically — tie it to this specific song.",
  "",
  "OUTPUT: reply with ONLY the lore (1–3 sentences), written in the language named in the user message. No headings, no labels, no quotes, no explanation.",
  "",
  "FINAL CHECK before you answer — ask yourself:",
  "1. Could this text be applied to any song? (if YES, rewrite it)",
  "2. Does it carry this song's own character?",
  "3. Does it connect naturally to the life period?",
  "4. Does it make the reader feel, rather than explain?",
  '5. Could the reader say "this is a moment from my life"?',
].join("\n");

/* -------------------------------------------------------------------------- */
/* User prompt                                                                  */
/* -------------------------------------------------------------------------- */

export type LorePromptInput = {
  songTitle: string;
  artist: string;
  /** Historical era year (birthYear + encounterAge) — null when unknown. */
  eraYear?: number | null;
  releaseYear?: number | null;
  /** The listener's real age at the encounter — null when unknown. */
  age?: number | null;
  genre?: string | null;
  mood?: string | null;
  userMemory?: string | null;
  /** The UI language the lore must be written in, e.g. "Türkçe". */
  languageName: string;
};

export function buildLoreUserPrompt(input: LorePromptInput): string {
  const artist = input.artist.trim() || "an unknown artist";
  const title = input.songTitle.trim() || "this song";
  const parts: string[] = [`Write the lore for one music-memory card.`];

  let intro = `The listener first heard "${title}" by ${artist}`;
  if (typeof input.age === "number" && Number.isFinite(input.age)) {
    intro += ` at age ${Math.floor(input.age)}`;
  }
  if (typeof input.eraYear === "number" && Number.isFinite(input.eraYear)) {
    intro += ` (around ${Math.floor(input.eraYear)})`;
  }
  parts.push(`${intro}.`);

  const period = lifePeriodForAge(input.age);
  if (period) {
    parts.push(
      `yaş: ${Math.floor(input.age as number)}, dönem: ${period.label}, bu dönemin çatışma/duygu ipuçları: ${period.cues}.`,
    );
  } else {
    parts.push("yaş bilinmiyor — dönem uydurma (do not invent an age or a life period).");
  }

  if (input.genre?.trim()) parts.push(`Genre: ${input.genre.trim()}.`);
  if (input.mood?.trim()) parts.push(`Mood of the song: ${input.mood.trim()}.`);
  if (input.userMemory?.trim()) {
    parts.push(`Personal memory to honour: ${input.userMemory.trim()}.`);
  }
  if (typeof input.releaseYear === "number" && Number.isFinite(input.releaseYear)) {
    parts.push(`Release year: ${Math.floor(input.releaseYear)}.`);
  }

  parts.push(
    "Use only the facts above: do not invent lyrics, the song's subject or album stories; never quote lyrics.",
    "Do not use the cliché meaning of an age automatically — tie the period to this specific song.",
    `Write 1–3 short sentences (prefer 8–30 words, never more than 40) in ${input.languageName} (the app's UI language).`,
    "Write about the song's place in the listener's life, not about its musical features.",
    "Keep it specific and warm, never a generic fortune-cookie compliment.",
    "This is a friend's memory, not a clinical case — never diagnose, label, or pathologize the listener or their feelings.",
    "No lyrics, no quotes, no artist-face descriptions.",
    "Reply with ONLY the lore text.",
  );
  return parts.join(" ");
}

/* -------------------------------------------------------------------------- */
/* Text hygiene: forbidden phrases, length, cleaning                            */
/* -------------------------------------------------------------------------- */

/** Stock phrases / forbidden openers a fresh, personal line must not lean on. */
const GENERIC_LORE =
  /wrapped around|small soul|nameless|whole world|tapestry|journey|echoes of|whispers? of|time stood still|never alone|symphony of|dance of|this song|this track|musically|unforgettable journey|touches your heart|inspires you|must-listen|bu şarkı bize|bu parça bize|şarkı, dinleyiciyi|bu albümün ana teması|müzikal olarak|bu tür|dinlerken kendinizi|bu şarkı tam olarak|bu eser|bu parça özellikle|hayatın her anında|her zaman hatırlatır|unutulmaz bir yolculuk|ruhun derinliklerine|kalbinize dokunur|size ilham verir|mutlaka dinlemelisiniz/i;

/** The story panel clamps at three lines; far longer text is cut off. */
export const MAX_LORE_CHARS = 320;
/** Hard word ceiling for a lore line; longer output gets one rewrite, then a cut. */
export const MAX_LORE_WORDS = 40;

/** True when the text leans on a forbidden phrase / stock opener. */
export function hasForbiddenPhrase(text: string): boolean {
  return GENERIC_LORE.test(text);
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function exceedsWordLimit(text: string): boolean {
  return wordCount(text) > MAX_LORE_WORDS;
}

/** True when generated lore is too long or leans on forbidden / stock phrases. */
export function isGenericLore(text: string): boolean {
  return text.length > MAX_LORE_CHARS || hasForbiddenPhrase(text) || exceedsWordLimit(text);
}

/** Strip reasoning blocks some models emit before the answer. */
export function cleanLore(raw: string | null | undefined): string {
  return (raw ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * Cut to whole sentences while within the word budget. When even the first
 * sentence is over budget, fall back to a word-boundary cut of that sentence.
 */
export function truncateToWordLimit(text: string, maxWords: number = MAX_LORE_WORDS): string {
  const trimmed = text.trim();
  if (wordCount(trimmed) <= maxWords) return trimmed;
  const sentences =
    trimmed
      .match(/[^.!?]+[.!?]*/g)
      ?.map((s) => s.trim())
      .filter(Boolean) ?? [];
  let out = "";
  for (const sentence of sentences) {
    const candidate = out ? `${out} ${sentence}` : sentence;
    if (wordCount(candidate) > maxWords) break;
    out = candidate;
  }
  if (out) return out;
  const first = sentences[0] ?? trimmed;
  return first.split(/\s+/).slice(0, maxWords).join(" ");
}
