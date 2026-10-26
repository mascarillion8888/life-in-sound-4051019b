/**
 * Shared artwork verification — single source of truth for iTunes artwork/album/year/preview enrichment.
 *
 * - Called by Journey (when a manual song is committed) and Results (for any remaining manual songs).
 * - Caches by song identity (providerId for verified songs, or hash of title+artist for manual) so
 *   a song verified once in Journey is NOT re-requested in Results.
 * - Returns ONLY the enrichable fields: artworkUrl, album, releaseYear, previewUrl.
 * - Never throws; failures return empty patch (caller keeps the manual song as-is).
 * - Provider identity is NEVER changed — a manual song stays manual; only metadata is enriched.
 * - LRU cache capped at 100 entries; "no match" cached for 10 min; network errors NOT cached.
 * - Artist+title similarity verified before applying patch (uses itunes-mapping logic).
 */
import { searchSongsLogic } from "./searchSong.server";
import type { Song } from "./types";
import { trackToSong, type ITunesTrack } from "./itunes-mapping";

const ARTWORK_CACHE_KEY = "soundmap.artworkVerify.v1";
const MAX_CACHE_ENTRIES = 100;
const NO_MATCH_TTL_MS = 10 * 60 * 1000; // 10 minutes

type CacheValue =
  { kind: "patch"; patch: ArtworkPatch; ts: number } | { kind: "nomatch"; ts: number };

type ArtworkPatch = {
  artworkUrl: string | null;
  album: string | null;
  releaseYear: number | null;
  previewUrl: string | null;
};

/** Build a stable cache key from the song's identity. */
function songCacheKey(song: Song): string {
  // Verified songs: use providerId (itunes:12345)
  if (song.provider !== "manual" && song.providerId) {
    return `${song.provider}:${song.providerId}`;
  }
  // Manual songs: hash of normalized title+artist
  const normalized = `${song.title.trim().toLowerCase()}|${song.artist.trim().toLowerCase()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `manual:${h >>> 0}`;
}

/** Load the persistent cache from localStorage. */
function loadCache(): Record<string, CacheValue> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ARTWORK_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Save the cache to localStorage with LRU eviction. */
function saveCache(cache: Record<string, CacheValue>) {
  if (typeof window === "undefined") return;
  try {
    // LRU: keep most recent MAX_CACHE_ENTRIES
    const entries = Object.entries(cache);
    if (entries.length > MAX_CACHE_ENTRIES) {
      entries.sort((a, b) => a[1].ts - b[1].ts);
      const toKeep = entries.slice(-MAX_CACHE_ENTRIES);
      cache = Object.fromEntries(toKeep);
    }
    localStorage.setItem(ARTWORK_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore quota errors */
  }
}

/**
 * Check if the iTunes match has sufficient title+artist similarity to the requested song.
 * Reuses the same logic as findConfidentMatch to avoid weak matches.
 */
function isConfidentMatch(requested: Song, candidate: ITunesTrack): boolean {
  const reqTitle = requested.title.trim().toLowerCase();
  const reqArtist = requested.artist.trim().toLowerCase();
  const candTitle = String(candidate.trackName ?? "")
    .trim()
    .toLowerCase();
  const candArtist = String(candidate.artistName ?? "")
    .trim()
    .toLowerCase();

  if (!candTitle || !candArtist) return false;

  // Token overlap (Dice) similarity
  function tokens(s: string): string[] {
    return s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
  }
  function tokenSimilarity(a: string, b: string): number {
    const setA = new Set(tokens(a));
    const setB = new Set(tokens(b));
    if (setA.size === 0 || setB.size === 0) return 0;
    let common = 0;
    for (const t of setA) if (setB.has(t)) common++;
    return (2 * common) / (setA.size + setB.size);
  }
  function titleMatches(a: string, b: string): boolean {
    const setA = new Set(tokens(a));
    const setB = new Set(tokens(b));
    if (setA.size === 0 || setB.size === 0) return false;
    if (tokenSimilarity(a, b) < 0.6) return false;
    const aInB = [...setA].every((t) => setB.has(t));
    const bInA = [...setB].every((t) => setA.has(t));
    return aInB || bInA;
  }
  function artistMatches(a: string, b: string): boolean {
    const na = normalizeArtist(a);
    const nb = normalizeArtist(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    if (tokenSimilarity(a, b) >= 0.8) return true;
    return ` ${na} `.includes(` ${nb} `) || ` ${nb} `.includes(` ${na} `);
  }
  function normalizeArtist(s: string): string {
    return s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  return titleMatches(reqTitle, candTitle) && artistMatches(reqArtist, candArtist);
}

/**
 * Verify and enrich a single song's artwork/metadata from iTunes.
 * Returns the patch to apply, or null if no match / error.
 * The cache is updated internally.
 *
 * @param song - The song to verify. Caller MUST ensure this is the CURRENT song
 *   for the question (caller checks song.key/title match before applying).
 */
export async function verifySongArtwork(song: Song): Promise<ArtworkPatch | null> {
  const cache = loadCache();
  const key = songCacheKey(song);
  const now = Date.now();

  // Cache hit → return immediately (check TTL for no-match)
  const cached = cache[key];
  if (cached) {
    if (cached.kind === "patch") return cached.patch;
    if (cached.kind === "nomatch" && now - cached.ts < NO_MATCH_TTL_MS) return null;
    // TTL expired → fall through to re-verify
  }

  // Skip if already has artwork (already verified)
  if (song.artworkUrl) {
    const patch: ArtworkPatch = {
      artworkUrl: song.artworkUrl,
      album: song.album ?? null,
      releaseYear: song.releaseYear ?? null,
      previewUrl: song.previewUrl ?? null,
    };
    cache[key] = { kind: "patch", patch, ts: now };
    saveCache(cache);
    return patch;
  }

  // Build query: title + artist (required for iTunes confident matching)
  const query = [song.title, song.artist].filter(Boolean).join(" ");
  if (query.length < 3) return null;

  try {
    const out = await searchSongsLogic({ query });
    const rawMatch = out.results?.[0];
    if (!rawMatch) {
      // Cache "no match" for short TTL
      cache[key] = { kind: "nomatch", ts: now };
      saveCache(cache);
      return null;
    }

    // Verify title+artist similarity before accepting
    if (!isConfidentMatch(song, rawMatch as ITunesTrack)) {
      cache[key] = { kind: "nomatch", ts: now };
      saveCache(cache);
      return null;
    }

    const match = trackToSong(rawMatch as ITunesTrack);
    if (!match) {
      cache[key] = { kind: "nomatch", ts: now };
      saveCache(cache);
      return null;
    }

    const patch: ArtworkPatch = {
      artworkUrl: match.artworkUrl ?? null,
      album: match.album ?? null,
      releaseYear: match.releaseYear ?? null,
      previewUrl: match.previewUrl ?? null,
    };
    cache[key] = { kind: "patch", patch, ts: now };
    saveCache(cache);
    return patch;
  } catch {
    // Network error → do NOT cache, return null so caller can retry later
    return null;
  }
}

/**
 * Verify artwork for multiple songs in parallel.
 * Returns a map of song cache key → patch (only for songs that got enriched).
 * Caller applies patches to their song state.
 */
export async function verifySongsArtwork(songs: Song[]): Promise<Record<string, ArtworkPatch>> {
  const cache = loadCache();
  const uncached = songs.filter((s) => {
    const key = songCacheKey(s);
    const cached = cache[key];
    if (!cached) return true;
    if (cached.kind === "patch") return false;
    // nomatch: allow re-verify if TTL expired
    return Date.now() - cached.ts >= NO_MATCH_TTL_MS;
  });

  if (uncached.length === 0) {
    // Return cached patches for all requested songs
    const out: Record<string, ArtworkPatch> = {};
    for (const s of songs) {
      const key = songCacheKey(s);
      const cached = cache[key];
      if (cached?.kind === "patch") out[key] = cached.patch;
    }
    return out;
  }

  const results = await Promise.all(
    uncached.map(async (s) => {
      const key = songCacheKey(s);
      const patch = await verifySongArtwork(s);
      return patch ? { key, patch } : null;
    }),
  );

  const out: Record<string, ArtworkPatch> = {};
  for (const r of results) {
    if (r) out[r.key] = r.patch;
  }
  // Also include already-cached entries
  for (const s of songs) {
    const key = songCacheKey(s);
    const cached = cache[key];
    if (cached?.kind === "patch" && !(key in out)) out[key] = cached.patch;
  }
  return out;
}

/** Clear the cache (for testing). */
export function clearArtworkCache() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ARTWORK_CACHE_KEY);
  }
}

/** Test helpers - exported for unit tests only. */
export { loadCache, saveCache, songCacheKey, isConfidentMatch, type CacheValue };
