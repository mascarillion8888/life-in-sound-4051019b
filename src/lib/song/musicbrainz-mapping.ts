/**
 * Pure MusicBrainz + Cover Art Archive → Song mapping.
 *
 * NO network, NO server-function, NO I/O. This module only transforms parsed
 * JSON shapes into the provider-neutral `Song` model. It is intentionally
 * separated from `searchSong.server.ts` so the mapping logic is unit-testable
 * without any provider access.
 *
 * MusicBrainz recording search response (fmt=json) is an object of the form:
 *   { created, count, offset, recordings: [ ... ] }
 * where each recording has at minimum { id, title, "artist-credit":[...],
 * "releases":[...], isrcs:[...] }. See https://musicbrainz.org/doc/MusicBrainz_API.
 *
 * Cover Art Archive release image metadata is keyed by MusicBrainz Release ID
 * (MBID) and returns { images:[{ image, thumbnails:{...} }] }. See
 * https://musicbrainz.org/doc/Cover_Art_Archive/API. Artwork is OPTIONAL — a
 * song must remain selectable even when no release has artwork.
 */

export type MusicBrainzRecording = {
  id?: unknown;
  title?: unknown;
  "artist-credit"?: unknown;
  releases?: unknown;
  isrcs?: unknown;
};

export type MusicBrainzSearchResponse = {
  recordings?: unknown;
};

export type CoverArtImage = {
  image?: unknown;
  thumbnails?: unknown;
};

export type CoverArtResponse = {
  images?: unknown;
};

const PROVIDER = "musicbrainz";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asId(value: unknown): string | null {
  // MusicBrainz MBIDs are UUID strings. Keep only well-formed ones so we never
  // produce a Song with an empty/garbage providerId.
  const s = asString(value);
  if (!s) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) ? s : null;
}

/** Extract the first artist-credit name from a recording. */
export function extractArtistName(recording: MusicBrainzRecording): string | null {
  const credit = recording["artist-credit"];
  if (!Array.isArray(credit) || credit.length === 0) return null;
  // Each entry is { name, joinphrase, "artist":{ name } }.
  const first = credit[0] as { name?: unknown; artist?: { name?: unknown } } | null;
  const name = first?.name ?? first?.artist?.name;
  return asString(name);
}

/** Extract the first release (album) name and its MBID from a recording. */
export function extractFirstRelease(recording: MusicBrainzRecording): {
  album: string | null;
  releaseId: string | null;
} {
  const releases = recording.releases;
  if (!Array.isArray(releases) || releases.length === 0) {
    return { album: null, releaseId: null };
  }
  const first = releases[0] as { title?: unknown; id?: unknown } | null;
  return { album: asString(first?.title), releaseId: asId(first?.id) };
}

/** Extract the first ISRC from a recording's `isrcs` array. */
export function extractFirstIsrc(recording: MusicBrainzRecording): string | null {
  const isrcs = recording.isrcs;
  if (!Array.isArray(isrcs) || isrcs.length === 0) return null;
  return asString(isrcs[0]);
}

/**
 * Map a single MusicBrainz recording into the provider-neutral Song shape.
 * Artwork is intentionally NOT resolved here (no network); use
 * `pickArtworkUrl` against a separately-fetched Cover Art Archive response.
 */
export function recordingToSong(recording: MusicBrainzRecording): {
  provider: "musicbrainz";
  providerId: string;
  title: string;
  artist: string;
  album: string | null;
  isrc: string | null;
  artworkUrl: null;
} | null {
  const providerId = asId(recording.id);
  const title = asString(recording.title);
  const artist = extractArtistName(recording);
  // title and artist are guaranteed fields; without a valid MBID we cannot
  // address the recording, so drop it entirely rather than emit a partial row.
  if (!providerId || !title || !artist) return null;

  const { album } = extractFirstRelease(recording);
  const isrc = extractFirstIsrc(recording);

  return {
    provider: PROVIDER,
    providerId,
    title,
    artist,
    album,
    isrc,
    artworkUrl: null,
  };
}

/** Pick the best artwork URL from a Cover Art Archive response, or null. */
export function pickArtworkUrl(coverArt: CoverArtResponse | null): string | null {
  if (!coverArt) return null;
  const images = coverArt.images;
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0] as CoverArtImage | null;
  // Prefer a large thumbnail, fall back to the full image URL.
  const thumbnails = first?.thumbnails as Record<string, unknown> | null;
  const large = asString(thumbnails?.large ?? thumbnails?.["500"] ?? thumbnails?.["1200"]);
  return large ?? asString(first?.image);
}

/**
 * Map the MusicBrainz recording-search response into Song[], dropping any
 * recordings that lack a valid MBID/title/artist. Artwork is left null and
 * resolved separately by the server function (optional, best-effort).
 */
export function mapRecordingsToSongs(response: MusicBrainzSearchResponse): {
  provider: "musicbrainz";
  providerId: string;
  title: string;
  artist: string;
  album: string | null;
  isrc: string | null;
  artworkUrl: null;
}[] {
  const recordings = response.recordings;
  if (!Array.isArray(recordings)) return [];
  const out = [];
  for (const rec of recordings as MusicBrainzRecording[]) {
    const song = recordingToSong(rec);
    if (song) out.push(song);
  }
  return out;
}

export const MUSICBRAINZ_PROVIDER = PROVIDER;
