/**
 * Spotify Web API — server-side live song search.
 *
 * Uses the Client Credentials flow (no user login): the server exchanges
 * SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET for a short-lived access token,
 * caches it in module scope, and queries /v1/search?type=track. The browser
 * NEVER talks to Spotify directly and NEVER sees either credential — both
 * stay behind this server boundary (no VITE_ prefix, ever).
 *
 * Provider role: PRIMARY suggestion source when env vars are present. When
 * they are absent (or any request fails) the caller falls back to the iTunes
 * path (`suggestSongsLogic`) and ultimately to free-text manual entry — the
 * user is never blocked. Never invents data: any failure maps to [].
 */
import { createServerFn } from "@tanstack/react-start";

import type { SearchSongsInput, SearchSongsOutput, Song } from "./types";

const SPOTIFY_TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const SPOTIFY_SEARCH_ENDPOINT = "https://api.spotify.com/v1/search";
const MAX_RESULTS = 10;
/** Hard cap on a provider request — a hung network must never stall the app. */
const DEFAULT_TIMEOUT_MS = 5000;
/** Refresh the token this many ms before its nominal expiry. */
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

/** Minimal response shapes — unknown-typed so parsing never trusts the wire. */
type SpotifyTokenResponse = {
  access_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
};

type SpotifyImage = { url?: unknown; width?: unknown; height?: unknown };
type SpotifyAlbum = { name?: unknown; release_date?: unknown; images?: unknown };
type SpotifyArtist = { name?: unknown };
type SpotifyTrack = {
  id?: unknown;
  name?: unknown;
  artists?: unknown;
  album?: unknown;
  preview_url?: unknown;
};
type SpotifySearchResponse = { tracks?: { items?: unknown } };

type CachedToken = { accessToken: string; expiresAt: number };
let tokenCache: CachedToken | null = null;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function env(): { clientId: string; clientSecret: string } | null {
  const clientId = asString(process.env.SPOTIFY_CLIENT_ID);
  const clientSecret = asString(process.env.SPOTIFY_CLIENT_SECRET);
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/**
 * Fetch (and cache) a client-credentials access token. Returns null when the
 * env is missing or the token request fails — the caller treats that as
 * "Spotify unavailable" and falls back to the next provider. Never throws.
 */
async function fetchAccessToken(
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<string | null> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now) return tokenCache.accessToken;

  const creds = env();
  if (!creds) return null;

  const fetchImpl = options.fetchImpl ?? fetch;
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`, "utf8").toString("base64");

  let response: Response;
  try {
    response = await fetchImpl(SPOTIFY_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${basic}`,
        accept: "application/json",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  let payload: SpotifyTokenResponse;
  try {
    payload = (await response.json()) as SpotifyTokenResponse;
  } catch {
    return null;
  }

  const accessToken = asString(payload.access_token);
  if (!accessToken) return null;
  const expiresIn =
    typeof payload.expires_in === "number" && payload.expires_in > 0 ? payload.expires_in : 3600;
  tokenCache = {
    accessToken,
    expiresAt: now + expiresIn * 1000 - TOKEN_EXPIRY_BUFFER_MS,
  };
  return accessToken;
}

/** Reset the in-memory token cache (tests). */
export function resetSpotifyTokenCache(): void {
  tokenCache = null;
}

function firstImageUrl(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0] as SpotifyImage;
  return asString(first?.url);
}

function extractReleaseYear(value: unknown): number | null {
  const s = asString(value);
  if (!s) return null;
  const m = s.match(/^(\d{4})/);
  if (!m) return null;
  const y = Number(m[1]);
  return Number.isInteger(y) && y > 0 ? y : null;
}

function trackToSong(track: SpotifyTrack): Song | null {
  const providerId = asString(track.id);
  const title = asString(track.name);
  const artists = Array.isArray(track.artists) ? (track.artists as SpotifyArtist[]) : [];
  const artist = artists
    .map((a) => asString(a?.name))
    .filter((n): n is string => Boolean(n))
    .join(", ");
  if (!providerId || !title || !artist) return null;

  const album = (track.album ?? {}) as SpotifyAlbum;
  return {
    provider: "spotify",
    providerId,
    title,
    artist,
    album: asString(album.name),
    artworkUrl: firstImageUrl(album.images),
    releaseYear: extractReleaseYear(album.release_date),
    // 30s MP3 preview straight from the API — null when Spotify has none.
    previewUrl: asString(track.preview_url),
    isrc: null,
    verified: true,
  };
}

/**
 * Pure network logic, separated from the createServerFn wrapper so it is
 * unit-testable with an injected fetch. Never throws — missing env, token
 * failure, non-OK, malformed payload → []. The returned songs are real
 * Spotify tracks; an empty result simply means "Spotify had nothing usable".
 */
export async function spotifySuggestSongsLogic(
  input: SearchSongsInput,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<SearchSongsOutput> {
  const query = (input?.query ?? "").trim();
  if (query.length < 3) return { results: [] };

  const accessToken = await fetchAccessToken(options);
  if (!accessToken) return { results: [] };

  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(
      `${SPOTIFY_SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}&type=track&limit=${MAX_RESULTS}`,
      {
        headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      },
    );
  } catch {
    return { results: [] };
  }
  if (!response.ok) return { results: [] };

  let payload: SpotifySearchResponse;
  try {
    payload = (await response.json()) as SpotifySearchResponse;
  } catch {
    return { results: [] };
  }

  const items = payload?.tracks?.items;
  if (!Array.isArray(items)) return { results: [] };

  const results: Song[] = [];
  for (const raw of items) {
    const song = trackToSong((raw ?? {}) as SpotifyTrack);
    if (song) results.push(song);
  }
  return { results };
}

/**
 * TanStack Start server function — the browser-callable entry point for the
 * Spotify suggestion dropdown. Never throws; failures map to []. The client
 * falls back to the iTunes suggest path when this returns no results.
 */
export const spotifySuggestSongs = createServerFn({ method: "POST" })
  .validator((input: SearchSongsInput): SearchSongsInput => input)
  .handler(async ({ data }) => {
    return (await spotifySuggestSongsLogic(data)) satisfies SearchSongsOutput;
  });
