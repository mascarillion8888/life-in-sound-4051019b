/**
 * Personal Music Collection — journey-independent saved tracks.
 *
 * A lightweight, cross-journey "favorites" layer. Unlike the journey
 * (localStorage `soundmap.journey.v1` — the 8-question interview state) and
 * unlike the Supabase `cards` table (auth-gated persisted paintings with
 * RLS + storage), this is a small client-side list of tracks the user
 * explicitly marked "Add to Collection". It intentionally:
 *
 *   - lives on its OWN localStorage key (`soundmap.collection.v1`), so it
 *     survives `resetJourneySession` / "Start Over" — the collection is a
 *     user preference, not a journey artifact;
 *   - stores only a thin render-oriented Song snapshot (title/artist/artwork
 *     + a few optional fields) — never the whole Song contract, never the
 *     AI painting bytes (those belong to the cards table / artwork cache);
 *   - is bounded (LRU: newest stay, oldest drops past `MAX_COLLECTION_ENTRIES`)
 *     so localStorage quota can never be exceeded by unbounded growth;
 *   - is idempotent: toggling a track already in the collection removes it.
 *
 * Storage failures are swallowed exactly like journey-storage — the UI must
 * never break because persistence is unavailable.
 */
import { COERCE_TO_PERSISTED, type Song } from "./song/types";

export const COLLECTION_STORAGE_KEY = "soundmap.collection.v1";
/** LRU cap — the newest N tracks are kept; the oldest drops beyond this. */
export const MAX_COLLECTION_ENTRIES = 50;

/**
 * The render-oriented slice of a Song the collection carries. Not the full
 * Song contract (no provider/isrc/verified/genre/mood — those don't drive
 * the card face), but enough to draw the saved track from the list.
 */
export type CollectionSnapshot = {
  title: string;
  artist: string;
  artworkUrl: string | null;
  album: string | null;
  releaseYear: number | null;
  previewUrl: string | null;
};

/** One saved track, newest-first ordered by the enclosing state. */
export type CollectionEntry = {
  /** Stable identity — the artwork cache key (`provider:trackId` / `manual:artist:title`). */
  trackKey: string;
  snapshot: CollectionSnapshot;
  /** ISO-8601 timestamp of when it was added. */
  addedAt: string;
};

export type CollectionState = {
  /** Newest-first; the LRU boundary is enforced on write. */
  entries: CollectionEntry[];
  /** ISO-8601 timestamp of the last mutation. */
  updatedAt: string;
};

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function now(): string {
  return new Date().toISOString();
}

export function emptyCollection(): CollectionState {
  return { entries: [], updatedAt: now() };
}

/** Normalize a Song into the collection's thin snapshot shape. */
export function snapshotFromSong(song: Song): CollectionSnapshot {
  return {
    title: typeof song.title === "string" ? song.title : "",
    artist: COERCE_TO_PERSISTED.artist(song.artist),
    artworkUrl: COERCE_TO_PERSISTED.artworkUrl(song.artworkUrl),
    album: COERCE_TO_PERSISTED.album(song.album),
    releaseYear: COERCE_TO_PERSISTED.releaseYear(song.releaseYear),
    previewUrl: COERCE_TO_PERSISTED.previewUrl(song.previewUrl),
  };
}

function normalizeEntry(value: unknown): CollectionEntry | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const s = v.snapshot as Record<string, unknown> | undefined;
  if (typeof v.trackKey !== "string" || v.trackKey.length === 0) return null;
  if (!s || typeof s !== "object" || typeof s.title !== "string") return null;
  return {
    trackKey: v.trackKey,
    snapshot: {
      title: s.title,
      artist: typeof s.artist === "string" ? s.artist : "",
      artworkUrl: typeof s.artworkUrl === "string" ? s.artworkUrl : null,
      album: typeof s.album === "string" ? s.album : null,
      releaseYear:
        typeof s.releaseYear === "number" && Number.isFinite(s.releaseYear)
          ? Math.floor(s.releaseYear)
          : null,
      previewUrl: typeof s.previewUrl === "string" ? s.previewUrl : null,
    },
    addedAt: typeof v.addedAt === "string" ? v.addedAt : now(),
  };
}

/** Read the collection from localStorage. Returns empty when none/unreadable. */
export function loadCollection(): CollectionState {
  if (!isBrowser()) return emptyCollection();
  try {
    const raw = window.localStorage.getItem(COLLECTION_STORAGE_KEY);
    if (!raw) return emptyCollection();
    const parsed = JSON.parse(raw) as Partial<CollectionState>;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) {
      return emptyCollection();
    }
    const entries = parsed.entries
      .map(normalizeEntry)
      .filter((e): e is CollectionEntry => e !== null);
    // Enforce the LRU cap defensively on load too (a hand-edited or stale key).
    const capped = entries.slice(0, MAX_COLLECTION_ENTRIES);
    return {
      entries: capped,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : now(),
    };
  } catch {
    return emptyCollection();
  }
}

/** Persist the collection. Silently ignores quota/private-mode failures. */
export function saveCollection(state: CollectionState): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — the in-memory copy still works this session */
  }
}

/** True when a track is already saved in the collection. */
export function isInCollection(state: CollectionState, trackKey: string): boolean {
  return state.entries.some((e) => e.trackKey === trackKey);
}

/**
 * Idempotent toggle: a track already saved is removed; a new one is added
 * (newest-first, LRU-capped). Returns a NEW state — mutations never happen
 * in place. A missing `trackKey` is a no-op (returns the same state).
 */
export function toggleInCollection(
  state: CollectionState,
  trackKey: string,
  song: Song | null,
): CollectionState {
  if (!trackKey) return state;
  const existing = state.entries.some((e) => e.trackKey === trackKey);

  if (existing) {
    const entries = state.entries.filter((e) => e.trackKey !== trackKey);
    return { ...state, entries, updatedAt: now() };
  }

  if (!song) return state;
  const entry: CollectionEntry = {
    trackKey,
    snapshot: snapshotFromSong(song),
    addedAt: now(),
  };
  const entries = [entry, ...state.entries].slice(0, MAX_COLLECTION_ENTRIES);
  return { ...state, entries, updatedAt: entry.addedAt };
}
