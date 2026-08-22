/**
 * Life Feed — state & persistence layer for the post-journey experience.
 *
 * The 8-question journey is finite; the Life Feed is not. Once the 8th song
 * is answered, the journey "graduates" into an unrestricted feed: every new
 * song the user adds continuously expands the existing Music Map (chapters,
 * emotional curve, poster) instead of replacing it.
 *
 * This module owns ONLY the state + persistence contract (localStorage,
 * versioned key, validation on load). UI and remote-sync wiring build on top
 * of it. Storage failures are swallowed exactly like journey-storage: the app
 * must never break because persistence is unavailable.
 */
import { questions } from "./questions";
import type { Song } from "./song/types";
import { isValidSong, normalizeSong, type JourneyProgress } from "./journey-storage";

export const LIFE_FEED_STORAGE_KEY = "soundmap.life-feed.v1";

/** A single unrestricted post-journey addition to the map. */
export type LifeFeedEntry = {
  /** Stable id (UUID when available) so entries can be removed/reordered. */
  id: string;
  song: Song;
  /** Optional personal memory note attached to this song. */
  note: string | null;
  /** ISO-8601 timestamp. */
  addedAt: string;
};

export type LifeFeedState = {
  /** The original journey answers (question id -> song title) the feed grew from. */
  baseAnswers: Record<number, string>;
  /** The original 8 structured selections, in journey order. */
  baseSongs: Record<number, Song>;
  /** Unrestricted post-journey entries, oldest first. */
  entries: LifeFeedEntry[];
  createdAt: string;
  updatedAt: string;
};

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to the manual id */
  }
  return `lf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * True once all 8 journey questions have an answer — the moment the journey
 * transitions into the unrestricted Life Feed.
 */
export function isJourneyComplete(progress: JourneyProgress | null): boolean {
  if (!progress) return false;
  return questions.every((q) => {
    const answer = progress.answers[q.id];
    return typeof answer === "string" && answer.length > 0;
  });
}

/**
 * Graduate a completed journey into a fresh Life Feed state. Returns `null`
 * when the journey is not complete — the feed must never start from a partial
 * map.
 */
export function graduateToLifeFeed(progress: JourneyProgress | null): LifeFeedState | null {
  if (!isJourneyComplete(progress) || !progress) return null;
  const now = new Date().toISOString();
  return {
    baseAnswers: { ...progress.answers },
    baseSongs: { ...progress.songs },
    entries: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Append a new song to the feed. The map grows; nothing is overwritten.
 * Returns a NEW state object (immutable update) with `updatedAt` bumped.
 */
export function appendLifeFeedEntry(
  state: LifeFeedState,
  input: { song: Song; note?: string | null; addedAt?: string },
): LifeFeedState {
  const entry: LifeFeedEntry = {
    id: newId(),
    song: normalizeSong(input.song),
    note: typeof input.note === "string" && input.note.trim().length > 0 ? input.note.trim() : null,
    addedAt: input.addedAt ?? new Date().toISOString(),
  };
  return {
    ...state,
    entries: [...state.entries, entry],
    updatedAt: entry.addedAt,
  };
}

/** Remove a feed entry by id. The base 8 are immutable and cannot be removed. */
export function removeLifeFeedEntry(state: LifeFeedState, id: string): LifeFeedState {
  return {
    ...state,
    entries: state.entries.filter((entry) => entry.id !== id),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * The full map in order: the original 8 journey songs followed by every feed
 * entry. This is the input the Music Map engine (poetic-analyzer) expands
 * from as the feed grows.
 */
export function lifeFeedSongs(state: LifeFeedState): Song[] {
  const base = questions
    .map((q) => state.baseSongs[q.id])
    .filter((song): song is Song => Boolean(song));
  return [...base, ...state.entries.map((entry) => entry.song)];
}

/** Memory notes in map order (`null` where none), for the analyzer prompt. */
export function lifeFeedMemories(state: LifeFeedState): (string | null)[] {
  const baseCount = questions.filter((q) => state.baseSongs[q.id]).length;
  return [
    ...Array<string | null>(baseCount).fill(null),
    ...state.entries.map((entry) => entry.note),
  ];
}

function isValidEntry(value: unknown): value is LifeFeedEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    isValidSong(v.song) &&
    (typeof v.note === "string" || v.note === null || v.note === undefined) &&
    typeof v.addedAt === "string" &&
    v.addedAt.length > 0
  );
}

function normalizeEntry(entry: LifeFeedEntry): LifeFeedEntry {
  return {
    id: entry.id,
    song: normalizeSong(entry.song),
    note: typeof entry.note === "string" && entry.note.length > 0 ? entry.note : null,
    addedAt: entry.addedAt,
  };
}

/** Read the Life Feed from localStorage. Returns null when nothing valid is stored. */
export function loadLifeFeed(): LifeFeedState | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(LIFE_FEED_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LifeFeedState>;
    if (!parsed || typeof parsed !== "object") return null;

    const baseAnswers: Record<number, string> = {};
    if (parsed.baseAnswers && typeof parsed.baseAnswers === "object") {
      for (const [key, value] of Object.entries(parsed.baseAnswers)) {
        const id = Number(key);
        if (Number.isFinite(id) && typeof value === "string" && value.length > 0) {
          baseAnswers[id] = value;
        }
      }
    }

    const baseSongs: Record<number, Song> = {};
    if (parsed.baseSongs && typeof parsed.baseSongs === "object") {
      for (const [key, value] of Object.entries(parsed.baseSongs)) {
        const id = Number(key);
        if (Number.isFinite(id) && isValidSong(value)) {
          baseSongs[id] = normalizeSong(value);
        }
      }
    }

    // A stored feed without a complete base is not a Life Feed — refuse it.
    if (Object.keys(baseAnswers).length < questions.length) return null;

    const entries = Array.isArray(parsed.entries)
      ? parsed.entries.filter(isValidEntry).map(normalizeEntry)
      : [];

    const now = new Date().toISOString();
    return {
      baseAnswers,
      baseSongs,
      entries,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : now,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : now,
    };
  } catch {
    return null;
  }
}

/** Persist the Life Feed. Silently ignores quota/private-mode failures. */
export function saveLifeFeed(state: LifeFeedState): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(LIFE_FEED_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — the feed simply isn't persisted */
  }
}

/** Remove the persisted Life Feed (the journey itself is untouched). */
export function clearLifeFeed(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(LIFE_FEED_STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}
