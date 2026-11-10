/**
 * Lore engine — the "cinematic life-journey" prompt + text hygiene + the
 * provider→rewrite→template pipeline for the card's lore box.
 *
 * PURE by design: no app dependencies and no I/O (the provider call is
 * injected), so it is trivially unit-testable and loadable by tooling
 * (`scripts/lore-eval.mjs`). Its only imports are the pure `cardBlueprint`
 * helpers.
 *
 * The prompt is rebuilt around the user's "Cinematic Life-Journey Lore Engine"
 * style guide: the lore names the song's place in a life, never its musical
 * features. Callers (`generateCard.server.ts`) supply the already-resolved
 * inputs — the historical era year, the encounter age, the UI language.
 */
// Explicit `.ts` extension: tsc allows it (`allowImportingTsExtensions`) and it
// keeps this module loadable by plain Node tooling (`scripts/lore-eval.mjs`).
import { deterministicLore, historicalEraYear, type CardEncounter } from "./cardBlueprint.ts";

/** Bumping this invalidates the client lore cache (see `useCardLore.cacheKey`). */
export const LORE_STYLE_VERSION = "lore-v3";

/* -------------------------------------------------------------------------- */
/* Life periods (guide's age interpretation)                                    */
/* -------------------------------------------------------------------------- */

export type LifePeriodKey = "discovery" | "identity" | "exploration" | "choices" | "memory";

export type LifePeriod = {
  key: LifePeriodKey;
  /** Short English label — for code/tests only; never sent to the model. */
  label: string;
  /** Neutral Turkish cue words (app source locale). */
  cues: string;
  /** At most three cue words, used in the natural-language user prompt. */
  hints: string[];
  /** English cue words — for the copied-example echo check (few-shots are EN+TR). */
  hintsEn: string[];
};

const LIFE_PERIODS: Record<LifePeriodKey, LifePeriod> = {
  discovery: {
    key: "discovery",
    label: "Discovery & imagination",
    cues: "keşif, hayal gücü, kahramanlar, ilk heyecan, dünyayı keşfetme, hayranlık",
    hints: ["keşif", "hayal gücü", "kahramanlar"],
    hintsEn: ["discovery", "imagination", "heroes"],
  },
  identity: {
    key: "identity",
    label: "Identity & rebellion",
    cues: "kimlik, isyan, aidiyet, arkadaşlık, özgürlük, ilk güçlü duygular",
    hints: ["kimlik", "isyan", "aidiyet"],
    hintsEn: ["identity", "rebellion", "belonging"],
  },
  exploration: {
    key: "exploration",
    label: "Self-discovery & questioning",
    cues: "kendini bulma, sorgulama, aşk, güç, bağımsızlık, dünya ile çatışma, gerçeklik arayışı",
    hints: ["kendini bulma", "sorgulama", "güç"],
    hintsEn: ["self-discovery", "questioning", "power"],
  },
  choices: {
    key: "choices",
    label: "Choices & responsibility",
    cues: "seçimler, sorumluluk, kayıplar, değişim, yeniden başlama, hayatın ağırlığını fark etme",
    hints: ["seçimler", "sorumluluk", "kayıplar"],
    hintsEn: ["choices", "responsibility", "losses"],
  },
  memory: {
    key: "memory",
    label: "Memory & acceptance",
    cues: "geçmiş, hafıza, kayıplar, kabullenme, derinlik, anlam, huzur, kim olduğuyla barışma",
    hints: ["kabullenme", "hafıza", "derinlik"],
    hintsEn: ["acceptance", "memory", "depth"],
  },
};

/**
 * Map a real encounter age to the guide's life period. The guide's ranges
 * overlap at 12 and 18; we resolve them by the *upper* bound of the earlier
 * range (12 → discovery, 18 → identity, 28 → exploration, 35 → memory), so
 * every age lands in exactly one bucket. Ages below 9 fold into the first
 * period. Returns null when no finite, non-negative age is given — the caller
 * then omits the period hint and tells the model not to invent one.
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
  "SONG FIRST: before anything else, work out what is specific to THIS song — its title, artist, genre, mood and year. The life period is only the frame; it must never replace the song. Two different songs at the same age must NOT receive sentences that could swap places. If you do not know the song's character, do not invent it — lean on its genre, mood and year.",
  "",
  "STYLE: cinematic, poetic, philosophical, short, dense, emotional, mysterious, human-centred, associative.",
  "Do not write it as a poem: no rhymes, no ornate metaphors, no over-literary flourishes. It must read like the summary of a short story or a single life-moment. The reader should feel: this song is not just a song — it belongs to a season of my life.",
  "",
  "FEW-SHOT REFERENCE (style only — NEVER copy, translate or lightly reword any of these lines; learn only the narrative logic):",
  '1) Iron Maiden — The Trooper · age 9–12 — TR: "Epik hikâyeler ve sınırlarını zorlayan bir dünya." / EN: "Epic stories and a world that pushes its own limits." — logic: childhood → imagination → discovery → opening onto bigger worlds.',
  '2) Metallica — For Whom the Bell Tolls · age 9–12 — TR: "Hız, enerji, isyan ve başkaldırı." / EN: "Speed, energy, rebellion and defiance." — logic: early youth → energy → testing limits → pushing back.',
  '3) Queensrÿche — Operation: Mindcrime · age 18–28 — TR: "Zihin kontrol edilebilir mi? Gerçek nedir? Bu albüm bir anahtar oldu." / EN: "Can a mind be controlled? What is real? This album became a key." — logic: young adulthood → questioning → reality → identity → awakening.',
  '4) Judas Priest — Painkiller · age 18–28 — TR: "Metalin özünde güç, gurur, sadakat ve çelik gibi bir inanç." / EN: "At the core of metal: power, pride, loyalty and a faith like steel." — logic: young adulthood → power → identity → values → proving yourself.',
  '5) Draconian — The Curse of Silence · age 35+ — TR: "Melankoli. Kabullenme. Derinlik. Bu, son değil. Bu, senin huzurun." / EN: "Melancholy. Acceptance. Depth. This is not the end. This is your peace." — logic: maturity → losses → turning inward → acceptance → peace.',
  "",
  "LENGTH: 1–3 sentences. Prefer 8–30 words. Never more than 40 words. Short sentences, readable at a glance. Do not explain — open an emotional door.",
  "",
  'OPENING: never begin with the age. No "Age 22.", no "22 yaş.", no "Kırk yaşında.", no "At 22 …". The age may appear at most once, inside the prose, never as the first thing.',
  "",
  "FORBIDDEN PHRASINGS — never use them, in any language, anywhere in the text (not only at the start):",
  '"Bu şarkı…", "Bu parça…", "Bu albüm…", "Bu eser…", "Bu tür…", "Bu şarkı bize…", "Bu parça bize…", "Şarkı, dinleyiciyi…", "Bu albümün ana teması…", "Müzikal olarak…", "Dinlerken kendinizi…", "Hayatın her anında…", "Her zaman hatırlatır…", "Unutulmaz bir yolculuk…", "Ruhun derinliklerine…", "Kalbinize dokunur…", "Size ilham verir…", "Mutlaka dinlemelisiniz…".',
  'English equivalents: "This song…", "This track…", "This album…", "Musically…", "unforgettable journey", "touches your heart", "inspires you", "must-listen".',
  "These are review or advertising language. We do not want ad copy — we want lore.",
  "",
  'NEVER LEAK THE BRIEF: do not output labels, headings, key/value lines or lists. No "Age:", "Period:", "Genre:", "Release year:", "Conflict:", "clues", "cues", "Yaş:", "Dönem:", "Tür:". Write flowing prose only.',
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
/* User prompt — natural language, no "key: value" lines                        */
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
  const parts: string[] = [];

  parts.push(`Write the lore for one music-memory card, about the song "${title}" by ${artist}.`);

  const period = lifePeriodForAge(input.age);
  if (typeof input.age === "number" && Number.isFinite(input.age)) {
    let heard = `The listener first heard it at age ${Math.floor(input.age)}`;
    if (typeof input.eraYear === "number" && Number.isFinite(input.eraYear)) {
      heard += `, around ${Math.floor(input.eraYear)}`;
    }
    parts.push(`${heard}.`);
  } else {
    parts.push("The listener's age when they first heard it is unknown.");
  }

  if (period) {
    parts.push(
      `That age is a life period whose inner conflict is often about ${period.hints.join(", ")}. Use it only as a soft frame; it must not overpower the song.`,
    );
  } else {
    parts.push("Do not invent an age or a life period.");
  }

  const character: string[] = [];
  if (input.genre?.trim()) character.push(`the genre is ${input.genre.trim()}`);
  if (input.mood?.trim()) character.push(`its mood is ${input.mood.trim()}`);
  if (typeof input.releaseYear === "number" && Number.isFinite(input.releaseYear)) {
    character.push(`it was released in ${Math.floor(input.releaseYear)}`);
  }
  if (character.length) parts.push(`For this song, ${character.join("; ")}.`);

  if (input.userMemory?.trim()) {
    parts.push(`Honour this personal memory from the listener: ${input.userMemory.trim()}.`);
  }

  parts.push(
    "Work out the song's own character first (title, artist, genre, mood, year); the life period is only the frame.",
    "Use only these facts: do not invent lyrics, the song's subject or album stories, and never quote lyrics.",
    "Do not start with the age, and mention the age at most once.",
    `Write 1–3 short sentences (prefer 8–30 words, never more than 40) in ${input.languageName}, the app's UI language.`,
    "Write about the song's place in the listener's life, not about its musical features.",
    "Keep it specific and warm, never a generic fortune-cookie compliment.",
    "This is a friend's memory, not a clinical case — never diagnose, label, or pathologize the listener or their feelings.",
    "No lyrics, no quotes, no artist-face descriptions.",
    "Write ONLY the lore text — no labels, no headings, no age/period line, no lists.",
  );
  return parts.join(" ");
}

/* -------------------------------------------------------------------------- */
/* Text hygiene: forbidden phrases, leakage, copying, length, cleaning          */
/* -------------------------------------------------------------------------- */

/**
 * Stock phrases / review language, forbidden ANYWHERE in the text (TR + EN).
 * `u` + `(?<![\p{L}\p{N}])` instead of `\b` so Turkish letters ("şarkı") are
 * handled — ASCII `\b` does not see them as word characters.
 */
const FORBIDDEN_LORE =
  /(?<![\p{L}\p{N}])(this (?:song|track|album)|musically|unforgettable journey|touches your heart|inspires you|must-listen|wrapped around|small soul|nameless|whole world|tapestry|echoes of|whispers? of|time stood still|never alone|symphony of|dance of|bu (?:şarkı|parça|albüm|eser)|müzikal olarak|dinlerken kendinizi|hayatın her anında|her zaman hatırlatır|unutulmaz bir yolculuk|ruhun derinliklerine|kalbinize dokunur|size ilham verir|mutlaka dinlemelisiniz)/iu;

/**
 * Skeleton labels the model must not echo from the brief: any "label:" pair, or
 * the distinctive bare tokens "clues"/"cues"/"ipucu(ları)".
 */
const LEAK_PATTERN =
  /(?<![\p{L}\p{N}])(age|period|genre|release year|conflict|clues?|cues?|mood|yaş|dönem|tür|çatışma|ipucu|ipuçları|yıl|ruh hali)\s*[:：]|(?<![\p{L}\p{N}])(clues|cues|ipucu|ipuçları)(?![\p{L}\p{N}])/iu;

/** A leading age — "Age 22.", "22 yaş.", "Kırk yaşında.", "At 22 …". */
const LEADING_AGE =
  /^\s*(?:age\s*\d{1,3}|\d{1,3}\s*(?:yaş\p{L}*|years?\s*old)|at\s+\d{1,3}|\d{1,3}\s*[-–—]\s*\d{1,3}\s*(?:yaş\p{L}*|years?\s*old)|(?:bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|yirmi|otuz|kırk|elli|altmış|yetmiş|seksen|doksan|yüz)\s*yaş\p{L}*)/iu;

/**
 * Copy references: the five few-shot lore lines (EN + TR) plus the guide's
 * "weak"/"right" example sentences. Output that matches one of these is treated
 * as copied — the guide's examples are NOT in the prompt any more, so the model
 * has no reason to echo them, but we still guard against it.
 */
const COPY_REFERENCES: string[] = [
  "Epic stories and a world that pushes its own limits.",
  "Epik hikâyeler ve sınırlarını zorlayan bir dünya.",
  "Speed, energy, rebellion and defiance.",
  "Hız, enerji, isyan ve başkaldırı.",
  "Can a mind be controlled? What is real? This album became a key.",
  "Zihin kontrol edilebilir mi? Gerçek nedir? Bu albüm bir anahtar oldu.",
  "At the core of metal: power, pride, loyalty and a faith like steel.",
  "Metalin özünde güç, gurur, sadakat ve çelik gibi bir inanç.",
  "Melancholy. Acceptance. Depth. This is not the end. This is your peace.",
  "Melankoli. Kabullenme. Derinlik. Bu, son değil. Bu, senin huzurun.",
  "The years you first questioned your own limits. The moment you began to learn what power is.",
  "This is a powerful heavy metal song. Fast guitars and harsh vocals give you energy.",
];

/** Normalize for comparison: lowercase, punctuation → spaces, collapse. */
function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  const normalized = normalizeForCompare(text);
  return normalized ? normalized.split(" ") : [];
}

function wordNgrams(text: string, n: number): Set<string> {
  const words = tokens(text);
  const grams = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) grams.add(words.slice(i, i + n).join(" "));
  return grams;
}

/**
 * Similarity of `text` to any reference line, as the max over (a) sentence-level
 * containment and (b) 3-gram overlap ratio (|shared| / |text 3-grams|). A
 * near-verbatim copy of a reference line scores 1; an unrelated line scores low.
 */
export function maxCopySimilarity(text: string, references: string[] = COPY_REFERENCES): number {
  const sentences = tokens(text).length
    ? (text.match(/[^.!?]+/g) ?? [text]).map((s) => normalizeForCompare(s)).filter(Boolean)
    : [];
  const textGrams = wordNgrams(text, 3);
  let best = 0;
  for (const reference of references) {
    const refNormalized = normalizeForCompare(reference);
    if (refNormalized && sentences.some((s) => s.includes(refNormalized))) best = Math.max(best, 1);
    const refGrams = wordNgrams(reference, 3);
    if (textGrams.size && refGrams.size) {
      let shared = 0;
      for (const gram of refGrams) if (textGrams.has(gram)) shared++;
      best = Math.max(best, shared / textGrams.size);
    }
  }
  return best;
}

/** Copy/echo threshold: at/above this, the text reads as a lifted few-shot. */
export const COPY_SIMILARITY_THRESHOLD = 0.6;

/** The story panel clamps at three lines; far longer text is cut off. */
export const MAX_LORE_CHARS = 320;
/** Hard word ceiling for a lore line; longer output gets one rewrite, then a cut. */
export const MAX_LORE_WORDS = 40;

/** True when the text uses review language / stock phrases (anywhere). */
export function hasForbiddenPhrase(text: string): boolean {
  return FORBIDDEN_LORE.test(text);
}

/** True when the text leaks brief-skeleton labels ("Age:", "Period:", …). */
export function hasPromptLeak(text: string): boolean {
  return LEAK_PATTERN.test(text);
}

/** True when the text opens with the age instead of the song. */
export function hasLeadingAge(text: string): boolean {
  return LEADING_AGE.test(text);
}

/** True when the text copies/echoes a few-shot lore line. */
export function isCopiedLore(text: string): boolean {
  return maxCopySimilarity(text) >= COPY_SIMILARITY_THRESHOLD;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function exceedsWordLimit(text: string): boolean {
  return wordCount(text) > MAX_LORE_WORDS;
}

/**
 * True when generated lore is too long, leaks the brief, opens with the age,
 * copies a few-shot line, or leans on forbidden / stock phrases.
 */
export function isGenericLore(text: string): boolean {
  return (
    text.length > MAX_LORE_CHARS ||
    hasForbiddenPhrase(text) ||
    hasPromptLeak(text) ||
    hasLeadingAge(text) ||
    isCopiedLore(text) ||
    exceedsWordLimit(text)
  );
}

/** Strip reasoning blocks some models emit before the answer. */
export function cleanLore(raw: string | null | undefined): string {
  return (raw ?? "").replace(/<think[\s\S]*?<\/think>/gi, "").trim();
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

/* -------------------------------------------------------------------------- */
/* Pipeline: provider → one rewrite → deterministic template                    */
/* -------------------------------------------------------------------------- */

export type LorePipelineInput = CardEncounter & { languageName: string };
export type LoreWriteResult = { text: string | null; via: "openrouter" | "groq" };
/** Where the final lore came from: a provider, the one rewrite, or the template. */
export type LorePath = "provider" | "rewrite" | "template";
export type LoreWrite = (userPrompt: string, languageName: string) => Promise<LoreWriteResult>;

const REWRITE_SUFFIX =
  " Your previous answer opened with the age, leaked the brief, copied an example, used review language, or was too long: write it again, fresh, song-first and shorter.";

/**
 * Resolve the final lore, never throwing: try the provider, reject output that
 * leaks the brief / opens with the age / copies a few-shot / uses review
 * language / runs long, allow exactly one rewrite, then a sentence-boundary cut,
 * and finally the deterministic template. Reports which path produced the text.
 */
export async function generateLoreCore(
  encounter: LorePipelineInput,
  write: LoreWrite,
): Promise<{ text: string; path: LorePath }> {
  const prompt = buildLoreUserPrompt({
    songTitle: encounter.songTitle,
    artist: encounter.artist,
    eraYear: historicalEraYear(encounter),
    releaseYear: encounter.releaseYear ?? null,
    age: encounter.encounterAge ?? null,
    genre: encounter.genre ?? null,
    mood: encounter.mood ?? null,
    userMemory: encounter.userMemory ?? null,
    languageName: encounter.languageName,
  });

  let candidate: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let result: LoreWriteResult;
    try {
      result = await write(
        attempt === 0 ? prompt : `${prompt}${REWRITE_SUFFIX}`,
        encounter.languageName,
      );
    } catch {
      break;
    }
    if (result.text == null) break; // no provider/key configured — retrying cannot help
    const cleaned = cleanLore(result.text);
    if (cleaned.length < 20 || cleaned.length > 600) continue;
    if (!isGenericLore(cleaned)) {
      return { text: cleaned, path: attempt === 0 ? "provider" : "rewrite" };
    }
    candidate = cleaned;
  }
  if (candidate) {
    const cut = truncateToWordLimit(candidate);
    if (
      cut.length >= 20 &&
      !hasForbiddenPhrase(cut) &&
      !hasPromptLeak(cut) &&
      !hasLeadingAge(cut)
    ) {
      return { text: cut, path: "rewrite" };
    }
  }
  return { text: deterministicLore(encounter), path: "template" };
}
