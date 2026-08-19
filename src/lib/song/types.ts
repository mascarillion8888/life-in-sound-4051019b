/**
 * Provider-neutral Song model.
 *
 * The external music provider (MusicBrainz today; could be replaced later) must
 * NOT become the internal application model. All provider responses are mapped
 * into this shape before they cross into the UI or any downstream layer.
 *
 * Only `title` and `artist` are guaranteed; everything else is nullable because
 * the source (MusicBrainz + Cover Art Archive) does not always supply it and a
 * song must remain selectable even when artwork/album/isrc is missing.
 */
export type Song = {
  /** Stable provider slug: "musicbrainz" (external) or "manual" (user-typed). */
  provider: "musicbrainz" | "manual";
  /** Provider-specific identifier (MusicBrainz MBID or a generated UUID for manual entries). */
  providerId: string;
  /** Display title (track/recording name, or a user-typed string). Always present. */
  title: string;
  /** Primary artist/credit name. Empty string for manual entries the user did not split out. */
  artist: string;
  /** Album/release name when known. */
  album: string | null;
  /** Cover Art Archive image URL when one exists. */
  artworkUrl: string | null;
  /** ISRC when the recording carries one. */
  isrc: string | null;
};

/** Input to the song search server function. */
export type SearchSongsInput = {
  query: string;
};

/** Output of the song search server function. Never throws — failures map to []. */
export type SearchSongsOutput = {
  results: Song[];
};
