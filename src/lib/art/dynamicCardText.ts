/**
 * Dynamic card text — deterministic per-track copy for the Era Card face.
 *
 * Every string on the card is derived from the song's identity + the era's
 * emotion, never static filler: the era title pairs the life-stage noun with
 * a track-seeded companion word, the body line weaves the era's narrative
 * with the track's own metadata, the collector number and the score shield
 * are computed from a stable hash of the track key.
 *
 * Pure and deterministic — the same track always reads the same card.
 */

export type DynamicCardText = {
  /** UPPERCASE card title, e.g. "DISCOVERY & ENCHANTMENT". */
  title: string;
  /** Body line — the era's narrative tuned to the track. */
  body: string;
  /** Collector sequence, e.g. "37/100". */
  sequence: string;
  /** Shield score 1..10, e.g. 9. */
  score: number;
  /** Shield label — the era's emotion, UPPERCASE (e.g. "INNOCENCE"). */
  scoreLabel: string;
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

function stableHash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Title-case the first letter of each word for the metadata clause. */
function metadataFor(
  trackKey: string,
  title: string,
  artist: string,
  album: string | null,
): string {
  if (album) return `${title} by ${artist}, from ${album}`;
  if (artist) return `${title} by ${artist}`;
  return title;
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
  const score = (Math.floor(hash / 100) % 9) + 2; // 2..10

  // Body: the era's narrative + the track's own metadata clause.
  const meta = metadataFor(args.trackKey, args.title, args.artist, args.album);
  const body = `${args.eraNarrative.replace(/\.$/, "")} — this time carried by ${meta}.`;

  return {
    title: `${noun} & ${companion}`,
    body,
    sequence: `${sequenceNumber}/100`,
    score,
    scoreLabel: args.eraTag.toUpperCase(),
  };
}
