/**
 * Card Gallery — read path for persisted Era Cards (migration 0003).
 *
 * The browser talks to Supabase with the anon key only; the `cards` table
 * and the `card-artworks` bucket are both owner-scoped by RLS, so this
 * module can only ever see the caller's own rows. Server data is treated
 * as untrusted: every row is validated and malformed entries are dropped
 * rather than allowed to crash the gallery.
 *
 * Paintings live in a PRIVATE bucket — raw object URLs 404 for everyone.
 * `resolveCardImageUrls` mints short-lived signed URLs for the caller's own
 * objects (the storage policy requires the first path segment to equal
 * auth.uid()).
 */
import { getSupabase } from "./client";

const TABLE = "cards";
const BUCKET = "card-artworks";
/** Signed-URL lifetime: one hour — enough for a gallery session. */
const SIGNED_URL_TTL_S = 3600;

/** One persisted era card, mirrors the columns of migration 0003. */
export type CardRow = {
  id: string;
  trackKey: string;
  title: string;
  artist: string;
  genre: string | null;
  releaseYear: number | null;
  birthYear: number | null;
  encounterAge: number | null;
  /** birthYear + encounterAge, materialized by the database. */
  eraYear: number | null;
  userMemory: string | null;
  scene: string;
  lore: string | null;
  imagePath: string | null;
  createdAt: string;
  /** Signed URL minted for this session — not a database column. */
  imageUrl?: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : null;
}

/** Validate one raw row into a CardRow, or null when it is malformed. */
export function toCardRow(raw: unknown): CardRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = asString(r.id);
  const title = asString(r.title);
  const trackKey = asString(r.track_key);
  if (!id || !title || !trackKey) return null;
  return {
    id,
    trackKey,
    title,
    artist: typeof r.artist === "string" ? r.artist : "",
    genre: asString(r.genre),
    releaseYear: asNumber(r.release_year),
    birthYear: asNumber(r.birth_year),
    encounterAge: asNumber(r.encounter_age),
    eraYear: asNumber(r.era_year),
    userMemory: asString(r.user_memory),
    scene: asString(r.scene) ?? "gothic",
    lore: asString(r.lore),
    imagePath: asString(r.image_path),
    createdAt: typeof r.created_at === "string" ? r.created_at : new Date(0).toISOString(),
  };
}

/**
 * Load the caller's own cards, newest first. Returns [] when Supabase is not
 * configured, when no session exists, or on any failure — the gallery shows
 * its empty state rather than an error.
 */
export async function loadRemoteCards(): Promise<CardRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select(
        "id, track_key, title, artist, genre, release_year, birth_year, encounter_age, " +
          "era_year, user_memory, scene, lore, image_path, created_at",
      )
      .order("created_at", { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data.map(toCardRow).filter((row): row is CardRow => row !== null);
  } catch {
    return [];
  }
}

/**
 * Mint signed URLs for every card that has a stored painting. Failures are
 * per-object: a card whose signing fails keeps imageUrl null and renders the
 * gothic placeholder instead of a broken image.
 */
export async function resolveCardImageUrls(cards: CardRow[]): Promise<CardRow[]> {
  const supabase = getSupabase();
  if (!supabase) return cards;
  return Promise.all(
    cards.map(async (card) => {
      if (!card.imagePath) return { ...card, imageUrl: null };
      try {
        const { data, error } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(card.imagePath, SIGNED_URL_TTL_S);
        return { ...card, imageUrl: error ? null : (data?.signedUrl ?? null) };
      } catch {
        return { ...card, imageUrl: null };
      }
    }),
  );
}

/** Convenience: load + sign in one call. */
export async function loadGalleryCards(): Promise<CardRow[]> {
  return resolveCardImageUrls(await loadRemoteCards());
}
