import type { Song } from "./song/types";

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

/** Coerce a validated Song's nullable fields to `null` when absent/non-string. */
export function normalizeSong(song: Song): Song {
  return {
    provider: song.provider,
    providerId: song.providerId,
    title: song.title,
    artist: song.artist,
    album: typeof song.album === "string" ? song.album : null,
    artworkUrl: typeof song.artworkUrl === "string" ? song.artworkUrl : null,
    isrc: typeof song.isrc === "string" ? song.isrc : null,
    verified: song.verified === true ? true : undefined,
  };
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
