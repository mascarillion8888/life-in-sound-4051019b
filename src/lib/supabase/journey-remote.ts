/**
 * Server-side Journey persistence (Sprint 011).
 *
 * Coordinates Supabase (source of truth when authenticated) with the existing
 * localStorage layer (cache + offline fallback). The route never talks to
 * Supabase directly — it goes through this module so the fallback rules live in
 * one place.
 *
 * Security:
 *   - Only the browser anon client is used (see supabase/client.ts).
 *   - All rows are owned by the authenticated user and gated by RLS.
 *   - No service-role credentials ever reach the browser.
 */
import { getSupabase } from "./client";
import type { JourneyRow } from "./types";
import type { Song } from "../song/types";
import {
  clearJourney,
  isValidSong,
  loadJourney,
  mergeJourneys,
  saveJourney,
  type JourneyProgress,
} from "../journey-storage";
import { dbCache } from "../cache/supabaseCache";

const TABLE = "journeys";

/** In-memory cache key (30s TTL) for a user's reconciled journey row. */
function journeyCacheKey(userId: string): string {
  return `journey:${userId}`;
}

/**
 * Load the journey for the given user id. Reconciles the server copy with the
 * local cache and writes the winner back to localStorage so subsequent loads
 * are instant and offline-safe. Returns null if nothing exists anywhere.
 */
export async function loadRemoteJourney(userId: string): Promise<JourneyProgress | null> {
  const cached = dbCache.get<JourneyProgress | null>(journeyCacheKey(userId));
  if (cached) return cached;

  const supabase = getSupabase();
  if (!supabase) return loadJourney();

  const local = loadJourney();

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("current, answers, songs")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      // Network/permission issue — fall back to local cache.
      dbCache.set(journeyCacheKey(userId), local);
      return local;
    }

    const remote = toProgress(data);
    const merged = mergeJourneys(local, remote);

    if (merged) {
      saveJourney(merged);
      dbCache.set(journeyCacheKey(userId), merged);
    }
    return merged;
  } catch {
    // Offline or request failed — keep using local cache.
    dbCache.set(journeyCacheKey(userId), local);
    return local;
  }
}

/**
 * Persist the journey for the given user id. Writes to localStorage first
 * (instant, offline-safe), then upserts to Supabase. Failures are swallowed so
 * a network blip never blocks the UI.
 */
export async function saveRemoteJourney(userId: string, progress: JourneyProgress): Promise<void> {
  // Mutation invalidates any cached copy so the next read re-fetches.
  dbCache.invalidate(journeyCacheKey(userId));
  // Always cache locally first.
  saveJourney(progress);

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.from(TABLE).upsert(
      {
        user_id: userId,
        current: progress.current,
        answers: progress.answers,
        songs: progress.songs,
        version: 1,
      },
      { onConflict: "user_id" },
    );
  } catch {
    /* offline — localStorage copy is the fallback; next save retries */
  }
}

/**
 * Delete the journey for the given user id (called when the journey completes
 * and the user moves to results). Clears both the server row and local cache.
 */
export async function clearRemoteJourney(userId: string): Promise<void> {
  // Invalidate the cached copy — the row no longer exists.
  dbCache.invalidate(journeyCacheKey(userId));
  clearJourney();

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.from(TABLE).delete().eq("user_id", userId);
  } catch {
    /* offline — local cache already cleared */
  }
}

function toProgress(
  row: Pick<JourneyRow, "current" | "answers" | "songs"> | null,
): JourneyProgress | null {
  if (!row) return null;
  const current = typeof row.current === "number" && row.current >= 1 ? Math.floor(row.current) : 1;
  const answers =
    row.answers && typeof row.answers === "object" ? (row.answers as Record<number, string>) : {};

  // Server data is untrusted — validate each Song entry and drop malformed ones
  // so a corrupt/partial row can never produce a Song with undefined fields.
  const songs: Record<number, Song> = {};
  if (row.songs && typeof row.songs === "object") {
    for (const [key, value] of Object.entries(row.songs as Record<string, unknown>)) {
      const id = Number(key);
      if (Number.isFinite(id) && isValidSong(value)) {
        const song = value as Song;
        // Preserve EVERY metadata field — including releaseYear (era), genre/mood
        // (musical characteristics) so reloaded journeys still feed real Music DNA.
        songs[id] = {
          provider: song.provider,
          providerId: song.providerId,
          title: song.title,
          artist: song.artist,
          album: typeof song.album === "string" ? song.album : null,
          artworkUrl: typeof song.artworkUrl === "string" ? song.artworkUrl : null,
          previewUrl: typeof song.previewUrl === "string" ? song.previewUrl : null,
          isrc: typeof song.isrc === "string" ? song.isrc : null,
          releaseYear:
            typeof song.releaseYear === "number" && !Number.isNaN(song.releaseYear)
              ? song.releaseYear
              : null,
          genre: typeof song.genre === "string" && song.genre.length > 0 ? song.genre : null,
          mood: typeof song.mood === "string" && song.mood.length > 0 ? song.mood : null,
          verified: song.verified === true ? true : undefined,
        };
      }
    }
  }

  return { current, answers, songs };
}
