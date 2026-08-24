/**
 * Full session reset — the single "start over" choke point.
 *
 * Wipes every app-owned storage artifact so a new journey can never inherit
 * stale state from a previous one:
 *   - journey progress (localStorage `soundmap.journey.v1` + the Supabase row
 *     when authenticated, via `clearRemoteJourney`),
 *   - the Life Feed timeline (`soundmap.life-feed.v1`),
 *   - the remembered journey completion flag (`completed` in the journey
 *     route's module-level memory), which the caller clears via the returned
 *     flag semantics — see `useResetJourney`.
 *
 * Deliberately preserved: the language preference (`soundmap:language`) and
 * the Supabase auth session — "Start Over" must never sign the user out or
 * change their UI language.
 *
 * Cached AI results (Life Story / insight / chapter text) are derived from
 * the journey answers and recomputed on the next visit — once the answers are
 * gone there is nothing to cache, so clearing the journey clears them too.
 */
import { clearJourney } from "./journey-storage";
import { clearLifeFeed } from "./life-feed";
import { clearRemoteJourney } from "./supabase/journey-remote";

/**
 * Remove all app-owned journey artifacts from storage. Returns a promise that
 * settles when the remote row delete has been attempted — the local state is
 * cleared synchronously, so callers may navigate immediately.
 */
export async function resetJourneySession(userId: string | null): Promise<void> {
  clearLifeFeed();
  if (userId) {
    await clearRemoteJourney(userId);
  } else {
    clearJourney();
  }
}
