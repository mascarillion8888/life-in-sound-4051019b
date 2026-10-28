/**
 * Dynamic card text — deterministic per-track copy for the Era Card face.
 *
 * The card title pairs the life-stage noun with a track-seeded companion word.
 * The body is a short, poetic, friendly line written for the listener's life
 * stage (journey position = age group) and woven with the track's own title and
 * artist, e.g. a 9-year-old meeting "Fragile" by Sting.
 *
 * Pure and deterministic — the same track always reads the same card.
 * This is also the fallback shown whenever the AI-written lore is unavailable.
 */

export type DynamicCardText = {
  /** UPPERCASE card title, e.g. "DISCOVERY & ENCHANTMENT". */
  title: string;
  /** Body line — poetic, tuned to the life stage and the track. */
  body: string;
  /** Collector sequence, e.g. "37/100". */
  sequence: string;
};

/** Per-era (life-stage) title nouns — journey position = user's age stage. */
const ERA_NOUNS = [
  "DISCOVERY",
  "FIRST SIGNAL",
  "REBELLION",
  "INQUIRY",
  "TEMPERING",
  "DARKNESS",
  "LONGING",
  "ACCEPTANCE",
] as const;

/** Track-seeded companions — the second half of the title. */
const COMPANIONS = [
  "ENCHANTMENT",
  "ECHOES",
  "EMBERS",
  "WONDER",
  "HORIZONS",
  "WHISPERS",
  "SPARKS",
  "SHADOWS",
  "VELVET",
  "THUNDER",
  "DAYDREAMS",
  "FIRELIGHT",
  "MILESTONES",
  "WAVELENGTH",
  "CROSSROADS",
  "AFTERGLOW",
] as const;

/**
 * Poetic lines per life stage (journey order: ages 5-9, 9-12, 13-17, 18-22,
 * 23-29, 30-39, 40+, now). `{t}` = song title, `{a}` = artist. Keep each line
 * to ~200 characters so it fits the three-line story panel.
 */
const LORE: readonly (readonly string[])[] = [
  // 0 — ages 5-9: first enchantment
  [
    "The first time {t} reached you, {a}'s voice slipped into your small world and wrapped around your soul. Feelings with no name yet began to rise.",
    "You were so young when {a} sang {t}, and the whole room turned to light. Something nameless woke up inside you.",
    "A child, a melody, a spell: {t} settled over you like a secret. Years later, that first enchantment still hums.",
  ],
  // 1 — ages 9-12: taste becomes a mirror
  [
    "With {t}, you chose a sound that was truly yours for the first time. {a} became a mirror, and you caught a glimpse of who you were becoming.",
    "Somewhere between childhood and the wider world, {t} became your own little flag. {a} was the first voice you picked for yourself.",
    "You pressed play on {t} and felt, quietly, that this music belonged to you. It was the first line of your own signature.",
  ],
  // 2 — ages 13-17: volume above feeling
  [
    "{t} turned up the volume on everything you could not say out loud. With {a} beside you, every restless heartbeat found its anthem.",
    "The world was too loud and too quiet at once, and then {a} played {t}. Suddenly your wild heart had a banner to carry.",
    "You were all lightning and questions, and {t} was the thunder that finally answered. Louder felt like truer.",
  ],
  // 3 — ages 18-22: more questions than answers
  [
    "Doors opened everywhere, and {t} played softly behind each question. {a} gave you no answers, only the courage to keep asking.",
    "New cities, new faces, old songs: {t} walked with you through the great unknown. Each question made you a little braver.",
    "You were gathering questions like stars, and {a}'s {t} lit a few of them. The sky of possibilities stayed wide open.",
  ],
  // 4 — ages 23-29: fragility becomes armor
  [
    "Life asked for strength, and {t} answered in {a}'s voice. What once felt fragile quietly became your armor.",
    "You learned to stand tall on shaky ground, and {t} was the steady drum beneath your feet. {a} reminded you that soft hearts can be steel.",
    "Every hard morning had a soundtrack, and {t} was the one that said keep going. You did, and you grew stronger for it.",
  ],
  // 5 — ages 30-39: sound before light
  [
    "In the long dark hours, {t} arrived before the dawn did. {a} sat with you in the silence until the light found its way back.",
    "When the lights went out, the sound stayed. {a} sang {t}, and in that gentle dark you remembered how to breathe.",
    "Some nights are only bearable with one song, and {t} was yours. It carried you through until morning came.",
  ],
  // 6 — ages 40+: loss becomes portable
  [
    "{t} carries every goodbye you have ever whispered. In {a}'s voice, loss turned into something you could hold gently.",
    "Time took a few things and left you {t}. {a} taught you that what we miss can travel with us, folded inside a melody.",
    "The people and places you long for live inside {t}. Press play, and {a} opens the door to them once more.",
  ],
  // 7 — now: acceptance
  [
    "Now {t} sounds like peace after a long journey. {a} sings what you finally understand: every question was part of the melody.",
    "You have come all this way, and {t} still finds you. With {a} humming along, the whole story makes quiet, beautiful sense.",
    "Here, in the present, {t} feels like coming home. {a} plays the last chord and you smile, because you were never alone.",
  ],
];

function stableHash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Build the card's full copy for one track at one era. `trackKey` is the
 * cache identity (`provider:trackId`) so the copy matches the painting's.
 */
export function dynamicCardText(args: {
  cardIndex: number;
  eraTag: string;
  eraNarrative: string;
  trackKey: string;
  title: string;
  artist: string;
  album: string | null;
}): DynamicCardText {
  const hash = stableHash(args.trackKey);
  const noun = ERA_NOUNS[args.cardIndex % ERA_NOUNS.length];
  const companion = COMPANIONS[hash % COMPANIONS.length];
  const sequenceNumber = (hash % 100) + 1;

  const lines = LORE[args.cardIndex % LORE.length];
  const template = lines[(hash >>> 8) % lines.length];
  const song = args.title ? `“${args.title}”` : "this song";
  const artist = args.artist || "the music";
  const body = template.replace(/\{t\}/g, song).replace(/\{a\}/g, artist);

  return {
    title: `${noun} & ${companion}`,
    body,
    sequence: `${sequenceNumber}/100`,
  };
}
