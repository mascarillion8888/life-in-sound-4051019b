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
  artist: string;
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
 * The exact set of fields a Song carries, in persistence order. Single source
 * of truth for the storage layers: `normalizeSong` (localStorage) and
 * `toProgress` (Supabase) both derive their field-coercion from this list, so
 * a new Song field can NEVER be dropped by one layer and kept by the other —
 * the compiler would flag the missing mapping.
 *
 * Coercion rules (shared by both layers):
 *   - string | null fields:       kept when a non-empty string, else null
 *   - string | null | undefined:  kept when a non-empty string, else null
 *   - boolean | undefined:        true keeps true; anything else drops to undefined
 */
export const SONG_FIELDS = [
  "provider",
  "providerId",
  "title",
  "artist",
  "album",
  "artworkUrl",
  "releaseYear",
  "previewUrl",
  "isrc",
  "verified",
  "genre",
  "mood",
] as const satisfies readonly SongKey[];

/** Every key a Song carries. */
export type SongKey = keyof Song;

/**
 * A field persisted alongside the Song — every member of SONG_FIELDS.
 * Compile-time contracts:
 *   - SONG_FIELDS only contains real Song keys (`satisfies readonly SongKey[]`),
 *   - COERCE_TO_PERSISTED has a rule for every member of SONG_FIELDS
 *     (the mapped record type demands it),
 *   - the exhaustive `isPersistableValue` switch rejects unknown fields.
 * The remaining drift risk — a NEW Song field not added to SONG_FIELDS — is
 * caught by the storage-layer round-trip tests, which assert the normalize
 * output covers every key of a full Song.
 */
export type SongField = (typeof SONG_FIELDS)[number];

/**
 * Canonical on-disk shape of a Song: every field present, optionals collapsed
 * to their persisted forms. Structurally assignable to `Song` (every field is
 * a valid member of the corresponding Song union), so a storage layer can
 * build its entries field-locally and return them without unsafe casts.
 */
type PersistedSong = {
  [K in SongField]-?:
    K extends "provider" | "providerId" | "title" | "artist" ? string :
    K extends "album" | "artworkUrl" | "previewUrl" | "isrc" | "genre" | "mood" ? string | null :
    K extends "releaseYear" ? number | null :
    boolean | undefined; // "verified"
};

/**
 * True when the value survives the persistence round-trip for its field:
 * `null` is acceptable for every nullable field (possibly-undefined ones
 * normalize to null), the optional booleans drop to undefined, `releaseYear`
 * keeps whole finite numbers, strings keep strings. The exhaustive switch
 * (trailing `never` assertion) makes the compiler fail when a future field is
 * added to `SONG_FIELDS` without a coercion rule here.
 */
export function isPersistableValue(field: SongField, value: unknown): boolean {
  switch (field) {
    case "provider":
    case "providerId":
    case "title":
    case "artist":
      return typeof value === "string";
    case "album":
    case "artworkUrl":
    case "previewUrl":
    case "isrc":
    case "genre":
    case "mood":
      return value === null || typeof value === "string";
    case "releaseYear":
      return value === null || (typeof value === "number" && Number.isFinite(value));
    case "verified":
      return value === undefined || value === true || value === false;
    default: {
      // Exhaustiveness guard: adding a SongField without a rule above is a
      // compile error, never a silent data-loss bug.
      const unreachable: never = field;
      void unreachable;
      return false;
    }
  }
}

/**
 * Per-field coercion table, one entry per SongField (exhaustive by
 * construction — the mapped record requires a rule for EVERY field, so adding
 * a SongField without updating this table is a compile error). Each entry is
 * non-generic: the exact `PersistedSong[K]` type is checked per field, which
 * the shared `normalizeSong` / `toProgress` layers drive by walking the
 * SONG_FIELDS whitelist.
 */
export const COERCE_TO_PERSISTED: {
  [K in SongField]: (raw: unknown) => PersistedSong[K];
} = {
  // Required string keys keep non-empty strings — callers gate these through
  // `isPersistableValue` first, so the `raw as string` narrow is safe.
  provider: (raw) => (typeof raw === "string" && raw.length > 0 ? (raw as Song["provider"]) : ""),
  providerId: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : ""),
  title: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : ""),
  artist: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : ""),
  album: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : null),
  artworkUrl: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : null),
  releaseYear: (raw) => (typeof raw === "number" && Number.isFinite(raw) ? raw : null),
  previewUrl: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : null),
  isrc: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : null),
  verified: (raw) => (raw === true ? true : undefined),
  genre: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : null),
  mood: (raw) => (typeof raw === "string" && raw.length > 0 ? raw : null),
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
