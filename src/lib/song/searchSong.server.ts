/**
 * Song verification — TanStack Start server function.
 *
 * Calls the iTunes Search API server-side (NEVER from the browser — the
 * project's architecture keeps all external music access behind this server
 * boundary) and treats it as the sole authority for verifying a user's
 * free-text song entry.
 *
 * The iTunes Search API is keyless and has no strict per-second rate limit, so
 * no throttle gate is needed (the old MusicBrainz one was removed with that
 * provider).
 *
 * Never invents data: any failure — network error, non-OK status, malformed
 * payload, or no confident match — maps to an empty result. The return type is
 * `SearchSongsOutput` ({ results: Song[] }) — never credentials, never raw
 * provider payloads.
 */
import { createServerFn } from "@tanstack/react-start";

import type { SearchSongsInput, SearchSongsOutput } from "./types";
import {
  allSongResults,
  buildSuggestTerm,
  findConfidentMatch,
  rankSongsFuzzy,
  type ITunesSearchResponse,
} from "./itunes-mapping";

const ITUNES_SEARCH_ENDPOINT = "https://itunes.apple.com/search";
const MAX_RESULTS = 10;
/** Hard cap on a provider request — a hung network must never stall the app. */
const DEFAULT_TIMEOUT_MS = 5000;

export type SearchSongsLogicOptions = {
  /** Injectable fetch (for tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Abort timeout for the provider request (tests inject a small value). */
  timeoutMs?: number;
};

/**
 * Pure network logic, separated from the createServerFn wrapper so it is
 * unit-testable with an injected fetch and without a server runtime. Never
 * throws — any failure (network, non-OK, malformed payload) maps to [].
 *
 * Returns at most one song: the first iTunes result that confidently matches
 * the query (see itunes-mapping for the matching rules). No confident match →
 * empty results (verification failure), never a fabricated song.
 */
export async function searchSongsLogic(
  input: SearchSongsInput,
  options: SearchSongsLogicOptions = {},
): Promise<SearchSongsOutput> {
  const query = (input?.query ?? "").trim();
  if (query.length < 2) return { results: [] };

  const fetchImpl = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(
      `${ITUNES_SEARCH_ENDPOINT}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${MAX_RESULTS}`,
      {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      },
    );
  } catch {
    // Network error or timeout → verification failure. Never throw to the client.
    return { results: [] };
  }

  if (!response.ok) return { results: [] };

  let payload: ITunesSearchResponse;
  try {
    payload = (await response.json()) as ITunesSearchResponse;
  } catch {
    return { results: [] };
  }

  const match = findConfidentMatch(query, payload);
  return { results: match ? [match] : [] };
}

/**
 * Ghost-text suggestion logic: returns the top usable iTunes song results,
 * regardless of the strict confidence rules. This only feeds the translucent
 * autocomplete hint in the input — it never becomes the selected Song without
 * passing the confident-matching path above. Never throws; failures map to [].
 */
export async function suggestSongsLogic(
  input: SearchSongsInput,
  options: SearchSongsLogicOptions = {},
): Promise<SearchSongsOutput> {
  const query = (input?.query ?? "").trim();
  if (query.length < 3) return { results: [] };

  const fetchImpl = options.fetchImpl ?? fetch;

  // iTunes does no prefix search and treats hyphens poorly; wordize the raw
  // input and complete the trailing partial word so "sting-frag" is searched
  // as "sting fragile", which yields the real hit. Query-shaping only — the
  // returned result still comes from iTunes, never invented.
  const term = buildSuggestTerm(query);
  if (term.length < 3) return { results: [] };

  let response: Response;
  try {
    response = await fetchImpl(
      `${ITUNES_SEARCH_ENDPOINT}?term=${encodeURIComponent(term)}&media=music&entity=song&limit=5`,
      {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      },
    );
  } catch {
    return { results: [] };
  }

  if (!response.ok) return { results: [] };

  let payload: ITunesSearchResponse;
  try {
    payload = (await response.json()) as ITunesSearchResponse;
  } catch {
    return { results: [] };
  }

  // Fuse.js re-ranks the fetched tracks against the raw typed text so a
  // free-form query ("sting-frag", "hel lionel") surfaces the best hit first.
  return { results: rankSongsFuzzy(query, allSongResults(payload)) };
}

/** Re-exported for tests that want to assert the provider endpoint. */
export { ITUNES_SEARCH_ENDPOINT };
export type { ITunesSearchResponse };

/**
 * TanStack Start server function — the browser-callable entry point.
 * Routes the client request to the server-side iTunes logic. The browser never
 * calls the iTunes Search API directly.
 */
export const searchSongs = createServerFn({ method: "POST" })
  .validator((input: SearchSongsInput): SearchSongsInput => input)
  .handler(async ({ data }) => {
    return (await searchSongsLogic(data)) satisfies SearchSongsOutput;
  });

/**
 * Ghost-text suggestion server function — the browser-callable entry point for
 * the translucent autocomplete hint. Best-effort, never authoritative.
 */
export const suggestSongs = createServerFn({ method: "POST" })
  .validator((input: SearchSongsInput): SearchSongsInput => input)
  .handler(async ({ data }) => {
    return (await suggestSongsLogic(data)) satisfies SearchSongsOutput;
  });
