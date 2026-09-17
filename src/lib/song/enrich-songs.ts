/**
 * Committed-song verification helpers — the guarantee that a free-text manual
 * song is ALWAYS verified once in the background, even if the user has already
 * navigated to the next question.
 *
 * Why this exists (QA Bug 2 — "first song's album art missing"): the live
 * debounced verification is cancelled when `question.id` changes, so a FAST
 * first submission (type → Next within the debounce window) never got its
 * iTunes match — the song stayed `manual` with `artworkUrl: null`. These
 * helpers let the journey track which committed manual songs still need a
 * verification REQUEST (decoupled from navigation) so none are lost.
 */
import type { Song } from "./types";

/** Stable key for "question id + committed manual title" dedupe. */
export function songVerifyKey(questionId: number, title: string): string {
  return `${questionId}:${title.trim().toLowerCase()}`;
}

/**
 * Return the committed manual songs (still needing verification) whose
 * (questionId, title) is not already in `requested`. Deduped so each manual
 * song is requested at most once per session; once requested, the caller
 * invokes its verification (which runs on its own, independent of navigation).
 */
export function collectUnverifiedManualSongs(
  songs: Record<number, Song>,
  requested: ReadonlySet<string>,
): Array<{ questionId: number; song: Song }> {
  const out: Array<{ questionId: number; song: Song }> = [];
  for (const [id, s] of Object.entries(songs)) {
    if (!s || s.provider !== "manual" || !s.title.trim()) continue;
    const key = songVerifyKey(Number(id), s.title);
    if (requested.has(key)) continue;
    out.push({ questionId: Number(id), song: s });
  }
  return out;
}