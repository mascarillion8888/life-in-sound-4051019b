import { COERCE_TO_PERSISTED, SONG_FIELDS, type Song } from "./song/types";

export const JOURNEY_STORAGE_KEY = "soundmap.journey.v1";

export type JourneyProgress = {
  current: number;
  answers: Record<number, string>;
  /**
   * Structured Song selections per question id. Persisted alongside the
   * title strings in `answers` so the QuestionCard can restore the full
   * title + artist + artwork after a refresh. A Song is only stored here when
   * it has passed `isValidSong`; malformed entries are dropped on load.
   */
  songs: Record<number, Song>;
};

export const emptyJourney: JourneyProgress = { current: 1, answers: {}, songs: {} };

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Validate a candidate Song object. Only entries with the guaranteed string
 * fields are accepted: `provider`, `providerId`, `title` must be non-empty;
 * `artist` must be a string but MAY be empty (manual entries the user did not
 * split into artist + title legitimately have `artist: ""`, per the Song type
 * contract — dropping them on load would silently lose the selected song and
 * leave a stale title-only answer behind). The nullable fields (album,
 * artworkUrl, isrc) are coerced to null when absent or non-string so a
 * malformed payload can never produce a Song with an undefined field. Mirrors
 * the guarantees of the Song type.
 */
export function isValidSong(value: unknown): value is Song {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.provider === "string" &&
    v.provider.length > 0 &&
    typeof v.providerId === "string" &&
    v.providerId.length > 0 &&
    typeof v.title === "string" &&
    v.title.length > 0 &&
    typeof v.artist === "string"
  );
}

/**
 * Coerce a validated Song's optional fields to their canonical persisted shapes
 * (`null` when absent, `undefined` when the field is optional-by-value). Built
 * from the shared SONG_FIELDS whitelist so the local tier and the remote tier
 * (`toProgress`) can never drift apart: every field of the Song type is
 * covered here and in the same order it is declared in the type.
 *
 * Per-field coercion lives in `coerceToPersisted` (song/types.ts), whose
 * exhaustive switch fails to compile when a new SongField is added without a
 * rule — a new Song field CANNOT be forgotten (it would fail to compile
 * instead of silently dropping data).
 */
export function normalizeSong(song: Song): Song {
  const out: Partial<Record<(typeof SONG_FIELDS)[number], unknown>> = {};
  for (const field of SONG_FIELDS) {
    // The optional verified flag only appears when true (absent otherwise).
    if (field === "verified") {
      if (song.verified === true) out.verified = true;
      continue;
    }
    // Every other field is ALWAYS present in the output: string/number kept as
    //-is, absent/invalid input collapsing to null. A Song that went through
    // load/save keeps its full key set — the round-trip test enforces this.
    out[field] = COERCE_TO_PERSISTED[field](song[field]);
  }
  return out as Song;
}

/** Read saved journey progress from localStorage. Returns null when nothing valid is stored. */
export function loadJourney(): JourneyProgress | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(JOURNEY_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<JourneyProgress>;
    const current =
      typeof parsed.current === "number" && parsed.current >= 1 ? Math.floor(parsed.current) : 1;

    const answers: Record<number, string> = {};
    if (parsed.answers && typeof parsed.answers === "object") {
      for (const [key, value] of Object.entries(parsed.answers)) {
        const id = Number(key);
        if (Number.isFinite(id) && typeof value === "string" && value.length > 0) {
          answers[id] = value;
        }
      }
    }

    const songs: Record<number, Song> = {};
    if (parsed.songs && typeof parsed.songs === "object") {
      for (const [key, value] of Object.entries(parsed.songs)) {
        const id = Number(key);
        if (Number.isFinite(id) && isValidSong(value)) {
          songs[id] = normalizeSong(value);
        }
      }
    }

    return { current, answers, songs };
  } catch {
    return null;
  }
}

/** Persist journey progress to localStorage. Silently ignores quota/private-mode failures. */
export function saveJourney(progress: JourneyProgress): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable — progress simply isn't persisted */
  }
}

/** Remove all saved journey progress from localStorage. */
export function clearJourney(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(JOURNEY_STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}

/** True when there is any meaningful saved progress. */
export function hasJourneyProgress(progress: JourneyProgress | null): boolean {
  if (!progress) return false;
  return progress.current > 1 || Object.keys(progress.answers).length > 0;
}

/**
 * Merge two journey snapshots, preferring the one with more answers (ties break
 * toward higher `current`). Used to reconcile the local cache with the server
 * copy without clobbering newer progress.
 */
export function mergeJourneys(
  a: JourneyProgress | null,
  b: JourneyProgress | null,
): JourneyProgress | null {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  const aCount = Object.keys(a.answers).length;
  const bCount = Object.keys(b.answers).length;
  if (aCount === bCount) {
    return a.current >= b.current ? a : b;
  }
  return aCount > bCount ? a : b;
}
