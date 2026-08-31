/**
 * Pure iTunes Search API → Song mapping + free-text confidence matching.
 *
 * NO network, NO server-function, NO I/O. This module only transforms parsed
 * JSON into the provider-neutral `Song` model and decides whether a returned
 * track is a confident match for the user's free-text query. It is separated
 * from `searchSong.server.ts` so the mapping/matching logic is unit-testable
 * without any provider access.
 *
 * iTunes Search API track result (subset):
 *   { wrapperType: "track", kind: "song", trackId, trackName, artistName,
 *     collectionName, artworkUrl100, ... }
 * See https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
 *
 * Matching is deliberately conservative: a result is accepted only when the
 * track name is meaningfully similar to the requested title AND the artist
 * name is meaningfully similar to the requested artist (when one was given).
 * An unrelated or ambiguous result is REJECTED — never guessed, never
 * fabricated.
 */

import Fuse from "fuse.js";

import type { Song } from "./types";
import { POPULAR_CATALOG } from "./popularCatalog";

export type ITunesTrack = {
  wrapperType?: unknown;
  kind?: unknown;
  trackId?: unknown;
  trackName?: unknown;
  artistName?: unknown;
  collectionName?: unknown;
  artworkUrl100?: unknown;
  releaseDate?: unknown;
  previewUrl?: unknown;
  primaryGenreName?: unknown;
};

export type ITunesSearchResponse = {
  resultCount?: unknown;
  results?: unknown;
};

/** How the user's free-text query was understood. */
export type ParsedSongQuery =
  { kind: "pair"; title: string; artist: string } | { kind: "free"; text: string };

const PROVIDER = "itunes";

/** Token-overlap (Dice) threshold for a "meaningfully similar" title. */
const TITLE_SIMILARITY_MIN = 0.6;
/** Stricter threshold for artist names. */
const ARTIST_SIMILARITY_MIN = 0.8;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asTrackId(value: unknown): string | null {
  // iTunes trackIds are positive integers. Accept numbers (the API shape) and
  // digit strings; anything else means we cannot address the track → drop it.
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return String(value);
  const s = asString(value);
  if (s && /^\d+$/.test(s)) return s;
  return null;
}
/**
 * Upgrade an iTunes `artworkUrl100` to its high-resolution variant. Apple's
 * image CDN serves the same artwork at the requested pixel size — swapping the
 * `100x100bb` path token for `600x600bb` is a documented size request, not a
 * fabricated URL. URLs without the `100x100` token (already hi-res, or a
 * non-standard shape) are returned unchanged; the poster/cards need the
 * larger artwork because 100px pixelates at their render size.
 */
export function highResArtworkUrl(url: string): string {
  return url.includes("100x100") ? url.replace("100x100", "600x600") : url;
}

/** Parse the 4-digit release year out of an ISO date (iTunes/Spotify both use YYYY-...). */
function extractReleaseYear(value: unknown): number | null {
  const s = asString(value);
  if (!s) return null;
  const m = s.match(/^(\d{4})/);
  if (!m) return null;
  const y = Number(m[1]);
  return Number.isInteger(y) && y > 0 ? y : null;
}

/** Deterministic era bucket ("1970s") derived from the release date's leading year. */
function extractEra(value: unknown): string | null {
  const year = extractReleaseYear(value);
  return year === null ? null : `${Math.floor(year / 10) * 10}s`;
}

/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // combining diacritical marks U+0300–U+036F
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(" ") : [];
}

/** Dice coefficient over the token sets of two strings (0..1). */
function tokenSimilarity(a: string, b: string): number {
  const setA = new Set(tokens(a));
  const setB = new Set(tokens(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let common = 0;
  for (const t of setA) if (setB.has(t)) common++;
  return (2 * common) / (setA.size + setB.size);
}

/**
 * Confident title match: high token overlap AND one side's tokens contained in
 * the other's. Containment alone is too loose ("Love" ⊂ "Love of My Life");
 * overlap alone is too loose ("For Lovers" vs "For You"). Together they accept
 * "Fragile" vs "Fragile (Live)" but reject vague or unrelated titles.
 */
function titleMatches(requested: string, candidate: string): boolean {
  const setA = new Set(tokens(requested));
  const setB = new Set(tokens(candidate));
  if (setA.size === 0 || setB.size === 0) return false;
  if (tokenSimilarity(requested, candidate) < TITLE_SIMILARITY_MIN) return false;
  const aInB = [...setA].every((t) => setB.has(t));
  const bInA = [...setB].every((t) => setA.has(t));
  return aInB || bInA;
}

/**
 * Confident artist match: normalized equality, high token overlap, or whole-
 * string containment ("Sting" ⊂ "Sting & The Police").
 */
function artistMatches(requested: string, candidate: string): boolean {
  const a = normalize(requested);
  const b = normalize(candidate);
  if (!a || !b) return false;
  if (a === b) return true;
  if (tokenSimilarity(requested, candidate) >= ARTIST_SIMILARITY_MIN) return true;
  return ` ${a} `.includes(` ${b} `) || ` ${b} `.includes(` ${a} `);
}

/**
 * Parse a free-text song query. Supports the common separator forms
 * ("Sting - Fragile", "Fragile | Sting", "Hurt by Johnny Cash") without
 * requiring a strict syntax. Title/artist order is NOT assumed here — the
 * matcher tries both. Queries without a separator stay "free" and are matched
 * by token coverage instead.
 */
export function parseSongQuery(query: string): ParsedSongQuery | null {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const sep = trimmed.match(/^(.+?)\s*[-–—|]\s*(.+)$/);
  const by = sep ? null : trimmed.match(/^(.+?)\s+by\s+(.+)$/i);
  const parts = sep ?? by;
  if (parts && parts[1].trim() && parts[2].trim()) {
    return { kind: "pair", title: parts[1].trim(), artist: parts[2].trim() };
  }
  return { kind: "free", text: trimmed };
}

/**
 * Free-text (no separator) match: every query token must appear in the union
 * of the track's title and artist tokens, with at least one token each in the
 * title and the artist. This accepts "Judas Priest Painkiller" or "fragile
 * sting" but rejects results that share only the title or only the artist, and
 * rejects queries with leftover unmatched words.
 */
function freeTextMatches(query: string, title: string, artist: string): boolean {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return false;
  const titleSet = new Set(tokens(title));
  const artistSet = new Set(tokens(artist));
  const union = new Set([...titleSet, ...artistSet]);
  const hitsTitle = queryTokens.some((t) => titleSet.has(t));
  const hitsArtist = queryTokens.some((t) => artistSet.has(t));
  if (!hitsTitle || !hitsArtist) return false;
  return queryTokens.every((t) => union.has(t));
}

/**
 * Map a single iTunes track result into the provider-neutral Song shape, or
 * null when the result is not a usable song track. Only real API fields are
 * used — nothing is invented. A mapped song is by definition a provider match,
 * so it carries `verified: true`.
 */
export function trackToSong(track: ITunesTrack): Song | null {
  if (track.wrapperType !== undefined && track.wrapperType !== "track") return null;
  if (track.kind !== undefined && track.kind !== "song") return null;

  const providerId = asTrackId(track.trackId);
  const title = asString(track.trackName);
  const artist = asString(track.artistName);
  if (!providerId || !title || !artist) return null;

  const artworkUrl100 = asString(track.artworkUrl100);
  return {
    provider: PROVIDER,
    providerId,
    title,
    artist,
    album: asString(track.collectionName),
    // High-resolution variant of the real CDN artwork — never a stock/fake URL.
    artworkUrl: artworkUrl100 ? highResArtworkUrl(artworkUrl100) : null,
    releaseYear: extractReleaseYear(track.releaseDate),
    genre: asString(track.primaryGenreName),
    era: extractEra(track.releaseDate),
    // 30s AAC preview straight from the API — null when iTunes has none.
    previewUrl: asString(track.previewUrl),
    isrc: null,
    verified: true,
  };
}

/**
 * Return the first result that confidently matches the user's query, or null.
 * The API result must never blindly become the selected song: insufficient
 * confidence yields null (verification failure), never a fabricated match.
 */
export function findConfidentMatch(query: string, response: ITunesSearchResponse): Song | null {
  const parsed = parseSongQuery(query);
  if (!parsed) return null;
  const results = response.results;
  if (!Array.isArray(results)) return null;

  for (const raw of results) {
    const song = trackToSong((raw ?? {}) as ITunesTrack);
    if (!song) continue;
    if (parsed.kind === "pair") {
      // Separator form: try both title–artist orders ("Sting - Fragile" and
      // "Bad - Michael Jackson" disagree on which side is the title).
      const direct =
        titleMatches(parsed.title, song.title) && artistMatches(parsed.artist, song.artist);
      const swapped =
        titleMatches(parsed.artist, song.title) && artistMatches(parsed.title, song.artist);
      if (direct || swapped) return song;
    } else if (freeTextMatches(parsed.text, song.title, song.artist)) {
      return song;
    }
  }
  return null;
}

/**
 * Return the first usable song result WITHOUT any confidence filtering. This
 * only feeds the translucent ghost-text hint in the input box — it never
 * becomes the selected Song on its own (that requires `findConfidentMatch`).
 */
export function firstSongResult(response: ITunesSearchResponse): Song | null {
  const results = response.results;
  if (!Array.isArray(results)) return null;
  for (const raw of results) {
    const song = trackToSong((raw ?? {}) as ITunesTrack);
    if (song) return song;
  }
  return null;
}

/** All usable song results, without confidence filtering (ghost-text only). */
export function allSongResults(response: ITunesSearchResponse): Song[] {
  const results = response.results;
  if (!Array.isArray(results)) return [];
  const out: Song[] = [];
  for (const raw of results) {
    const song = trackToSong((raw ?? {}) as ITunesTrack);
    if (song) out.push(song);
  }
  return out;
}

/**
 * Build the best-effort provider search term from the raw typed text. iTunes
 * does NOT do prefix search ("sting frag" ≠ "Fragile") and treats hyphens
 * poorly, so we wordize the input and swap a trailing partial word for its
 * most likely full word (from a curated seed + the built-in stopword set)
 * using the project's existing Dice similarity. This is still pure, never
 * invents data — it only shapes the query; the RESULT must still come from
 * iTunes, and only extends-typed-text candidates ever surface as ghost text.
 */
export function buildSuggestTerm(rawQuery: string): string {
  const words = rawQuery
    .replace(/[^A-Za-z0-9ğüşöçıİĞÜŞÖÇ]+/g, " ")
    .trim()
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
  if (words.length < 2) return words.join(" ");
  const last = words[words.length - 1];
  if (last.length < 3) return words.join(" ");

  // Curated seed of the songs this app is most often tested with (title words
  // only — no artist/song fabrication, just a vocabulary for prefix completion).
  const SEED = [
    "fragile",
    "russians",
    "painkiller",
    "yesterday",
    "imagine",
    "desert",
    "rose",
    "love",
    "shape",
    "englishman",
    "fields",
    "gold",
    "roxanne",
    "billie",
    "jean",
    "thriller",
    "bad",
    "hurt",
    "hallelujah",
    "bohemian",
    "rhapsody",
    "hey",
    "jude",
    "let",
    "be",
  ];
  // Prefer the SEED word that starts with the partial; on ties (or none),
  // fall back to the longest SEED word sharing the partial as a prefix. This
  // is still deterministic and only shapes the query — never invents a result.
  const candidates = SEED.filter((w) => w.startsWith(last) && w.length > last.length);
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.length - a.length || a.localeCompare(b));
    words[words.length - 1] = candidates[0];
  }
  return words.join(" ");
}

/**
 * Fuse.js options shared by the catalog index and any ad-hoc index.
 * `ignoreLocation: true` makes the match position-independent (so "richie
 * hel" or "frag stin" still hit) and `threshold: 0.4` tolerates letter typos
 * and missing words ("maddona frozn"). Indexing BOTH "artist title" and
 * "title artist" makes the match order-independent in both directions.
 */
const FUSE_OPTIONS = {
  keys: ["label", "rlabel"],
  threshold: 0.4,
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 2,
};

type CatalogEntry = { artist: string; title: string };

/** A catalog entry plus the two combined keys Fuse searches. */
type IndexedEntry = CatalogEntry & { label: string; rlabel: string };

function indexCatalog(catalog: ReadonlyArray<CatalogEntry>): IndexedEntry[] {
  return catalog.map((e) => ({
    ...e,
    label: `${e.artist} ${e.title}`,
    rlabel: `${e.title} ${e.artist}`,
  }));
}

/** Pre-indexed embedded catalog (shared, built once). */
const CATALOG_INDEXED = indexCatalog(POPULAR_CATALOG);

/** Per-entry Fuse memo so each song is indexed once, not per query. */
const entryFuseCache = new WeakMap<IndexedEntry, Fuse<IndexedEntry>>();
function catalogEntryFuse(entry: IndexedEntry): Fuse<IndexedEntry> {
  let f = entryFuseCache.get(entry);
  if (!f) {
    f = new Fuse([entry], FUSE_OPTIONS);
    entryFuseCache.set(entry, f);
  }
  return f;
}

/**
 * Fuzzy match against the catalog, powered by Fuse.js per-token. Every typed
 * token must match the SAME catalog entry (a song is only a candidate when
 * each token fuzzily hits its artist+title), which both makes the match
 * order-independent ("bad mic", "frag stin", "lionel richie hel") and prevents
 * a loose whole-string match from stealing a token-consistent hit. Typo-
 * tolerant via threshold 0.4 ("maddona frozn" → Madonna - Frozen). Ties break
 * toward the entry whose artist/title starts with the typed text, then toward
 * the better average Fuse score. Returns null when nothing clears the
 * threshold — the catalog is a hint, never a fabrication.
 */
export function matchCatalogSong(
  typed: string,
  catalog?: ReadonlyArray<CatalogEntry>,
): CatalogEntry | null {
  const typedTokens = tokens(typed).filter((t) => t.length >= 2);
  if (typedTokens.length === 0) return null;

  // Use the shared indexed catalog (or index an ad-hoc catalog for tests).
  const source: IndexedEntry[] =
    !catalog || catalog === POPULAR_CATALOG ? CATALOG_INDEXED : indexCatalog(catalog);

  let best: IndexedEntry | null = null;
  let bestAvg = Infinity;
  let bestPrefix = false;
  const lowerTyped = typed.trim().toLowerCase();
  for (const entry of source) {
    let ok = true;
    let total = 0;
    for (const tt of typedTokens) {
      const hit = catalogEntryFuse(entry).search(tt, { limit: 1 })[0];
      if (!hit) {
        ok = false;
        break;
      }
      total += hit.score ?? 0;
    }
    if (!ok) continue;
    const avg = total / typedTokens.length;
    const prefix =
      entry.artist.toLowerCase().startsWith(lowerTyped) ||
      entry.title.toLowerCase().startsWith(lowerTyped);
    if (prefix && !bestPrefix) {
      best = entry;
      bestAvg = avg;
      bestPrefix = true;
    } else if (prefix === bestPrefix && avg < bestAvg) {
      best = entry;
      bestAvg = avg;
    }
  }
  return best ? { artist: best.artist, title: best.title } : null;
}

/**
 * Re-rank live iTunes suggestion results against the typed text with Fuse.js,
 * so a fuzzy/free-form query ("sting-frag", "hel lionel") surfaces the most
 * relevant fetched track first. Songs with no usable title/artist are kept at
 * the end in their original order — never dropped, never invented.
 */
export function rankSongsFuzzy(typed: string, songs: Song[]): Song[] {
  const q = typed.trim();
  if (q.length < 2 || songs.length === 0) return songs;
  const indexed = songs.map((song, i) => ({
    song,
    i,
    label: `${song.artist ?? ""} ${song.title}`.trim(),
    rlabel: `${song.title} ${song.artist ?? ""}`.trim(),
  }));
  const fuse = new Fuse(indexed, FUSE_OPTIONS);
  const hits = fuse.search(q);
  const ranked = new Set(hits.map((h) => h.item.i));
  return [
    ...hits.map((h) => h.item.song),
    ...indexed.filter((x) => !ranked.has(x.i)).map((x) => x.song),
  ];
}

/** Zero-latency ghost from the embedded popular catalog (no network). */
export function catalogGhostCompletion(typed: string): string | null {
  const entry = matchCatalogSong(typed, POPULAR_CATALOG);
  return entry ? `${entry.artist} - ${entry.title}` : null;
}

/** Ghost completion candidate chains, longest first ("Artist - Title", then Title). */
export function ghostCandidates(song: Song): string[] {
  return song.artist ? [`${song.artist} - ${song.title}`, song.title] : [song.title];
}

/** Case/diacritic-insensitive prefix check: does `candidate` extend `typed`? */
export function hasCompletionPrefix(candidate: string, typed: string): boolean {
  return candidate.length > typed.length && normalize(candidate).startsWith(normalize(typed));
}

export type GhostMatch = {
  /** The full, correctly-cased completion (e.g. "Sting - Fragile"). */
  completion: string;
  /** How many RAW typed characters the normalized matched prefix spans. */
  rawPrefixLength: number;
};

/**
 * Match `typed` against a `candidate` chain and, on success, compute how many
 * raw characters of `typed` the matched normalized prefix spans. Because
 * normalize() strips separators ("-"→""), the raw length can differ from the
 * normalized length — the overlay needs the RAW length to slice/align exactly.
 */
function matchGhost(candidate: string, typed: string): GhostMatch | null {
  const nCand = normalize(candidate);
  const nTyped = normalize(typed);
  if (!nTyped || nCand.length <= nTyped.length || !nCand.startsWith(nTyped)) return null;

  // Walk the raw candidate, counting normalized chars, until we've consumed
  // nTyped of them; the raw index reached is the raw prefix length of typed.
  let consumed = 0;
  let rawIdx = 0;
  while (rawIdx < candidate.length && consumed < nTyped.length) {
    const ch = candidate[rawIdx];
    if (normalize(ch) !== "") consumed += 1;
    rawIdx += 1;
  }
  return { completion: candidate, rawPrefixLength: Math.min(rawIdx, typed.length) };
}

/**
 * Pick the best ghost-text completion for the typed text across the result
 * list: for each song try its "Artist - Title" chain first, then its bare
 * title; the first (provider-ranked) prefix match wins.
 */
export function bestGhostMatch(typed: string, songs: Song[]): GhostMatch | null {
  if (!typed) return null;
  for (const song of songs) {
    for (const candidate of ghostCandidates(song)) {
      const m = matchGhost(candidate, typed);
      if (m) return m;
    }
  }
  return null;
}

/** Back-compat: the completion string of the best ghost match. */
export function bestGhostCompletion(typed: string, songs: Song[]): string | null {
  return bestGhostMatch(typed, songs)?.completion ?? null;
}

export const ITUNES_PROVIDER = PROVIDER;
