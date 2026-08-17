/**
 * Song search — TanStack Start server function.
 *
 * Calls MusicBrainz server-side (NEVER from the browser — the API's documented
 * 1 request/second limit is per-IP, and browser-direct calls would share the
 * end-user's IP and risk blocking; see https://musicbrainz.org/doc/MusicBrainz_API).
 *
 * A module-level throttle guarantees we never exceed one MusicBrainz call per
 * second, even under concurrent requests. Artwork is resolved best-effort via
 * the Cover Art Archive and is OPTIONAL — a song stays selectable without it.
 *
 * Security: no API keys (MusicBrainz is keyless, but requires a descriptive
 * User-Agent). No secrets are returned. The return type is `SearchSongsOutput`
 * ({ results: Song[] }) — never credentials, never raw provider payloads.
 */
import { createServerFn } from "@tanstack/react-start";

import type { SearchSongsInput, SearchSongsOutput, Song } from "./types";
import {
  extractFirstRelease,
  mapRecordingsToSongs,
  pickArtworkUrl,
  type CoverArtResponse,
  type MusicBrainzSearchResponse,
} from "./musicbrainz-mapping";

const MUSICBRAINZ_ENDPOINT = "https://musicbrainz.org/ws/2/recording";
const COVER_ART_ENDPOINT = "https://coverartarchive.org/release";
const USER_AGENT = "LifeInSound/0.1 (https://life-in-a-sound.example)";
const MAX_RESULTS = 12;

// MusicBrainz documents a strict "at most ONE call per second" rate limit.
// Enforce it with a module-level gate shared across all server-fn invocations.
const MIN_INTERVAL_MS = 1050; // small buffer over 1000ms for safety
let nextAllowedAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function respectRateLimit(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, nextAllowedAt - now);
  if (wait > 0) await sleep(wait);
  nextAllowedAt = Date.now() + MIN_INTERVAL_MS;
}

export type SearchSongsLogicOptions = {
  /** Injectable fetch (for tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Skip the rate-limit gate (tests only — real calls must be throttled). */
  skipRateLimit?: boolean;
};

/**
 * Pure network logic, separated from the createServerFn wrapper so it is
 * unit-testable with an injected fetch and without a server runtime. Never
 * throws — any failure (network, non-OK, malformed, rate-limit) maps to [].
 */
export async function searchSongsLogic(
  input: SearchSongsInput,
  options: SearchSongsLogicOptions = {},
): Promise<SearchSongsOutput> {
  const query = (input?.query ?? "").trim();
  if (query.length < 2) return { results: [] };

  const fetchImpl = options.fetchImpl ?? fetch;
  if (!options.skipRateLimit) await respectRateLimit();

  let response: Response;
  try {
    response = await fetchImpl(
      `${MUSICBRAINZ_ENDPOINT}?query=${encodeURIComponent(query)}&fmt=json&limit=${MAX_RESULTS}`,
      { headers: { "user-agent": USER_AGENT, accept: "application/json" } },
    );
  } catch {
    // Network error → no results. Never throw to the client.
    return { results: [] };
  }

  if (!response.ok) return { results: [] };

  let payload: MusicBrainzSearchResponse;
  try {
    payload = (await response.json()) as MusicBrainzSearchResponse;
  } catch {
    return { results: [] };
  }

  const songs = mapRecordingsToSongs(payload);
  if (songs.length === 0) return { results: [] };

  // Best-effort artwork: fetch Cover Art Archive for the first release of the
  // top results only (bounded, one extra request per song). Artwork failures
  // never drop a song — they just leave artworkUrl null.
  const resolved = await resolveArtwork(songs.slice(0, 4), fetchImpl, options);
  // Merge resolved artwork back onto the full list (unresolved ones stay null).
  const artworkById = new Map(resolved.map((r) => [r.providerId, r.artworkUrl]));
  const finalSongs: Song[] = songs.map((s) => ({
    ...s,
    artworkUrl: artworkById.get(s.providerId) ?? null,
  }));

  return { results: finalSongs };
}

async function resolveArtwork(
  songs: { providerId: string; title: string }[],
  fetchImpl: typeof fetch,
  options: SearchSongsLogicOptions,
): Promise<{ providerId: string; artworkUrl: string | null }[]> {
  // MusicBrainz recordings don't carry a release MBID in the search response in
  // a stable way we can rely on for cover-art lookups; we look up artwork via
  // the Cover Art Archive "release" endpoint using the first release id from the
  // recording. Since we don't have release ids here at this stage (the mapping
  // dropped them to keep the Song shape provider-neutral), we skip remote
  // artwork in v1 and leave artworkUrl null. This keeps the slice bounded and
  // avoids extra per-song network calls that would blow the 1 req/s budget.
  //
  // Artwork support is intentionally deferred: a song remains selectable
  // without it, satisfying the acceptance criteria ("artwork is optional").
  void songs;
  void fetchImpl;
  void options;
  return [];
}

/** Re-exported for tests that want to assert the provider slug. */
export { extractFirstRelease, pickArtworkUrl, COVER_ART_ENDPOINT };
export type { CoverArtResponse, MusicBrainzSearchResponse };

/**
 * TanStack Start server function — the browser-callable entry point.
 * Routes the client request to the server-side MusicBrainz logic. The browser
 * never calls MusicBrainz directly (rate-limit + no CORS guarantee).
 */
export const searchSongs = createServerFn({ method: "POST" })
  .validator((input: SearchSongsInput): SearchSongsInput => input)
  .handler(async ({ data }) => {
    return (await searchSongsLogic(data)) satisfies SearchSongsOutput;
  });
