/**
 * Provider-neutral Song model.
 *
 * The external music provider (iTunes Search API today; "musicbrainz" survives
 * only in already-persisted rows) must NOT become the internal application
 * model. All provider responses are mapped into this shape before they cross
 * into the UI or any downstream layer.
 *
 * Only `title` and `artist` are guaranteed; everything else is nullable because
 * the source does not always supply it and a song must remain selectable even
 * when artwork/album/isrc is missing.
 */
export type Song = {
  /**
   * Stable provider slug: "itunes" (external, verified), "spotify" (external, verified),
   * or "musicbrainz" (legacy — only in journeys persisted before the provider/
   * switch; kept so old rows remain type-valid).
   */
  provider: "musicbrainz" | "itunes" | "spotify" | "manual";
  /** Provider-specific identifier (iTunes trackId, legacy MusicBrainz MBID, or a generated UUID for manual entries). */
  providerId: string;
  /** Display title (track/recording name, or a user-typed string). Always present. */
  title: string;
  /** Primary artist/credit name. Empty string for manual entries the user did not split out. */
  artist: string | null;
  /** Album/release name when known. */
  album: string | null;
  /** Artwork image URL when one exists. */
  artworkUrl: string | null;
  /** Release year (4-digit) when the provider supplies a release date. */
  releaseYear?: number | null;
  /**
   * 30-second audio preview URL when the provider supplies one (iTunes
   * returns an AAC m4a preview for most tracks). Absent/null for manual
   * entries that were never verified — never fabricated.
   */
  previewUrl?: string | null;
  /** ISRC when the recording carries one (iTunes does not supply one — always null for itunes). */
  isrc: string | null;
  /**
   * True only when an external provider confidently matched this song against
   * the user's query. Absent/false for manual entries that were never
   * (or could not be) verified — verification never fabricates a song.
   */
  verified?: boolean;
  /** Genre when a provider supplies one. Never fabricated. */
  genre?: string | null;
  /** Mood tag when a provider supplies one. Never fabricated. */
  mood?: string | null;
};

/**
 * Background verification state for a manually entered song. Informational
 * only — it never blocks or replaces the user's input.
 */
export type VerifyStatus = "checking" | "verified" | "failed";

/** Input to the song search server function. */
export type SearchSongsInput = {
  query: string;
};

/** Output of the song search server function. Never throws — failures map to []. */
export type SearchSongsOutput = {
  results: Song[];
};
