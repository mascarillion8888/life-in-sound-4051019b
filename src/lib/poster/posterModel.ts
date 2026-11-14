/**
 * Life Poster — pure data model (task P0-1, docs/architecture/CINEMATIC_LIFE_POSTER.md §8.3).
 *
 * Deterministic, I/O-free: no React, no network, no LLM, no randomness. The same
 * input always produces byte-identical JSON (stable key order) and the same `id`.
 * Missing data is NEVER invented — a missing field stays `null` (ANA_YASA §0), and
 * a journey question without a selected song is SKIPPED, never filled.
 *
 * Design choices forced by existing repo types:
 *   - Entries are built from STRUCTURED `Song` selections only. `JourneyProgress`
 *     also carries `answers` (question id → title string), but a bare title cannot
 *     form a track identity (Song requires `provider` + `providerId`) without
 *     inventing them — so `answers` is intentionally not read (see song/types.ts).
 *   - `genre` is canonicalised with the existing `normalizeGenre`; `decade` comes
 *     from the existing visual-resolver helper `decadeOf` (releaseYear → Decade);
 *     `mood` is passed through as-is. No new mapping is invented here.
 *   - `period` is the LISTENER's choice (`Song.period`); it is passed through when
 *     present and stays `null` otherwise — the model never guesses a period.
 */
import { stableHash } from "../ai/personalityScoring";
import { isPeriod, type Period } from "../art/listenerPeriod";
import type { JourneyProgress } from "../journey-storage";
import type { LifeCard } from "../soundmap/lifeCards";
import type { Song } from "../song/types";
import { normalizeGenre } from "../visual/assetRegistry";
import { decadeOf, type Decade } from "../visual/backdropRegistry";

/** Model version. Any change bumps the hash of every poster (cache identity). */
export const POSTER_MODEL_VERSION = "poster-v1";

/** Canonical 2:3 poster output size (2048×3072) — the approved master size. */
export const POSTER_OUTPUT_SIZE = { width: 2048, height: 3072 } as const;

export type PosterOutputSize = typeof POSTER_OUTPUT_SIZE;

/** Provider-neutral track identity carried into the poster. */
export type PosterTrack = {
  provider: Song["provider"];
  providerId: string;
  title: string;
  artist: string;
};

/** One poster row: a journey card plus the real data resolved for its song. */
export type PosterEntry = {
  /** 0-based journey card position. */
  cardIndex: number;
  /** Card stage/era title, e.g. "FIRST SPARK". */
  stageTitle: string;
  track: PosterTrack;
  /** Release year when known; null when the provider did not supply one. */
  releaseYear: number | null;
  /** The listener-assigned life period; null when the listener has not chosen one. */
  period: Period | null;
  /** Song mood when known; null otherwise. */
  mood: string | null;
  /** Canonical genre (normalizeGenre); null when unknown. */
  genre: string | null;
  /** Decade derived from releaseYear (decadeOf); null when the year is unknown. */
  decade: Decade | null;
  /** Optional cinematic lore line; null when absent. */
  loreLine: string | null;
  /** The user's own note; kept in the model but ALWAYS flagged not-for-provider. */
  userNote: string | null;
  /** Always false — the note is never provider-bound (decision 7, 2026-11-14). */
  noteForProvider: false;
};

/** The full, deterministic poster model. */
export type LifePosterModel = {
  /** Deterministic hash of the inputs + POSTER_MODEL_VERSION. */
  id: string;
  version: string;
  outputSize: PosterOutputSize;
  entries: PosterEntry[];
  /** Language the poster was generated from (defaults to "en"). */
  generatedFromLanguage: string;
  /** Listener birth year when known; null otherwise. */
  birthYear: number | null;
};

export type ComposePosterInput = {
  /** Journey storage shape — only the structured `songs` are read (see header). */
  progress: JourneyProgress;
  /** Card metadata in journey order (e.g. `buildLifeCards()`). */
  cards: readonly LifeCard[];
  /** Optional lore line per card index (0-based). */
  loreLines?: Record<number, string | null | undefined>;
  /** Optional user note per card index (0-based); never sent to the provider. */
  notes?: Record<number, string | null | undefined>;
  /** Listener birth year when known; null/absent when unknown. */
  birthYear?: number | null;
  /** Language the poster was generated from; defaults to "en". */
  language?: string;
};

/** A model with the user note stripped out — the only shape safe to hand a provider. */
export type ProviderSafePosterEntry = Omit<PosterEntry, "userNote">;
export type ProviderSafeLifePosterModel = Omit<LifePosterModel, "entries"> & {
  entries: ProviderSafePosterEntry[];
};

/** Trimmed non-empty string, else null — empty/whitespace input is "missing". */
function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Finite number, else null — never fabricate a value for a missing one. */
function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildEntry(card: LifeCard, song: Song, input: ComposePosterInput): PosterEntry {
  const releaseYear = finiteOrNull(song.releaseYear);
  return {
    cardIndex: card.index,
    stageTitle: card.eraTitle,
    track: {
      provider: song.provider,
      providerId: song.providerId,
      title: song.title,
      artist: song.artist,
    },
    releaseYear,
    period: isPeriod(song.period) ? song.period : null,
    mood: trimOrNull(song.mood),
    genre: normalizeGenre(song.genre),
    decade: decadeOf(null, releaseYear),
    loreLine: trimOrNull(input.loreLines?.[card.index]),
    userNote: trimOrNull(input.notes?.[card.index]),
    noteForProvider: false,
  };
}

/**
 * Deterministic id: the canonical JSON of everything but `id` (fixed key order),
 * hashed with the repo's existing FNV-1a `stableHash`. Changes whenever the
 * version, any entry, the language or the birth year changes.
 */
export function posterModelId(model: Omit<LifePosterModel, "id">): string {
  return `poster-${stableHash(JSON.stringify(model)).toString(16)}`;
}

/**
 * Compose the poster model from journey selections + card metadata. Entries follow
 * journey card order (stable for ties); a card whose question has no song is
 * skipped. Missing fields stay null — nothing is invented.
 */
export function composePosterModel(input: ComposePosterInput): LifePosterModel {
  const ordered = [...input.cards].sort((a, b) => a.index - b.index);
  const entries: PosterEntry[] = [];
  for (const card of ordered) {
    const song = input.progress.songs?.[card.songIndex];
    if (!song) continue;
    entries.push(buildEntry(card, song, input));
  }

  const base = {
    version: POSTER_MODEL_VERSION,
    outputSize: POSTER_OUTPUT_SIZE,
    entries,
    generatedFromLanguage: input.language?.trim() || "en",
    birthYear: finiteOrNull(input.birthYear),
  };
  return { id: posterModelId(base), ...base };
}

/**
 * Provider-safe view: the model with every `userNote` removed (not blanked —
 * REMOVED, so no value can leak). Used before any image-provider call.
 */
export function providerSafePosterModel(model: LifePosterModel): ProviderSafeLifePosterModel {
  return {
    id: model.id,
    version: model.version,
    outputSize: model.outputSize,
    generatedFromLanguage: model.generatedFromLanguage,
    birthYear: model.birthYear,
    entries: model.entries.map(({ userNote: _userNote, ...safe }) => safe),
  };
}
