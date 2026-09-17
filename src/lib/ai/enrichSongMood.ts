/**
 * Song mood enrichment — client-safe, per-session deduped.
 *
 * Anal_mimari §2.2: mood is a DERIVED field (AI-inferred), not provider-sourced
 * and never typed in from the UI. It is computed by `inferMood` (the sanctioned
 * mood layer) and stamped onto the journey Song's `mood` so SceneRoom can show
 * the matching mood wallpaper during the journey. Unknown/unrecoverable mood
 * stays null — never guessed (ANA_YASA §0).
 *
 * Per-session dedupe: each distinct song is inferred at most once per page
 * lifetime, so a re-render enrichment effect can never trigger a duplicate
 * OpenRouter call (mitigates the historic multi-call storm in the same spirit
 * as the results-page content-keyed memo).
 */
import type { Song } from "@/lib/song/types";

import { inferMood } from "./moodInference";

/** Stable identity key for a Song — the same track always yields the same key. */
export function songMoodKey(song: Song): string {
  return song.provider === "manual" || !song.providerId
    ? `manual:${song.artist.toLowerCase()}:${song.title.toLowerCase()}`
    : `${song.provider}:${song.providerId}`;
}

/**
 * Per-session guard keyed by `songMoodKey`. Success AND null/failure are kept
 * in the set, so an un-inferable song is not retried on every render (no call
 * storm); a genuinely unknown mood stays null and recomputes only after a new
 * page load.
 */
const attempted = new Set<string>();

/** Test-only: clear the per-session guard. */
export function __resetSongMoodAttempts(): void {
  attempted.clear();
}

/**
 * Return `song` with its inferred mood on `song.mood`, or the same `song`
 * untouched when a mood is already present, already attempted, or inference
 * returned null/failed. Never throws; never fabricates.
 */
export async function resolveSongMood(song: Song): Promise<Song> {
  if (song.mood?.trim()) return song;
  const key = songMoodKey(song);
  if (attempted.has(key)) return song;
  attempted.add(key);
  try {
    const mood = await inferMood({
      title: song.title,
      artist: song.artist,
      genre: song.genre ?? null,
    });
    return mood ? { ...song, mood } : song;
  } catch {
    return song;
  }
}