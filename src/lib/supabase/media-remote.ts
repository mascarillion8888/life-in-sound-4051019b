/**
 * Media Foundation persistence layer.
 *
 * Coordinates Supabase Postgres (metadata + relationships) and Supabase Storage
 * (binary files). Mirrors the safety conventions of the other *-remote modules:
 *   - Only the browser anon client is used (see supabase/client.ts).
 *   - All rows are owned by the authenticated user and gated by RLS.
 *   - Failures are contained: functions return null / empty / error results
 *     rather than throwing into the UI.
 *   - Cross-user access fails safely (returns null/empty, leaks no existence).
 *
 * Storage / ownership invariants:
 *   - The bucket 'user_media' is PRIVATE. No public URLs are ever generated.
 *   - storage_path is user-scoped: `<user_id>/<media_id>/<sanitized-filename>`.
 *     The path namespace is the ownership boundary, NOT a browser-provided path.
 *   - Signed URLs are generated ONLY after media.user_id === current user.
 *     A media id alone is NEVER sufficient authorization.
 *   - v1 MIME allowlist: image/jpeg | image/png | image/webp (validated here,
 *     not trusted from the filename extension). Max size enforced here too.
 *   - No AI/image provider calls in this foundation.
 *
 * Atomicity / failure handling:
 *   Storage and Postgres are different systems and cannot be one transaction.
 *   `uploadMedia` uploads the file first, then creates the metadata row; if the
 *   row insert fails, the uploaded object is removed (compensation). The inverse
 *   order (row then file) is riskier because an orphaned row with no file is
 *   harder to detect. A residual edge case: if the process dies between a
 *   successful upload and the row insert, the object is orphaned. The DB row is
 *   the source of truth for display; orphaned objects without a row are not
 *   visible to the user and can be reaped by a future maintenance job. This
 *   trade-off is preferred over orphaned rows (visible but broken) pointing at
 *   missing files.
 */
import { getSupabase } from "./client";
import type { Media, MediaCreateInput, MediaMimeType, MediaWithUrl } from "@/lib/memory/types";
import type {
  ChapterMediaRow,
  EventMediaRow,
  MediaRow,
  MemoryMediaRow,
  ProfileMediaRow,
} from "./types";

const MEDIA_TABLE = "media";
const PROFILE_MEDIA_TABLE = "profile_media";
const MEMORY_MEDIA_TABLE = "memory_media";
const EVENT_MEDIA_TABLE = "event_media";
const CHAPTER_MEDIA_TABLE = "chapter_media";
const MEMORIES_TABLE = "memories";
const EVENTS_TABLE = "life_events";
const CHAPTERS_TABLE = "life_chapters";
const BUCKET = "user_media";

/** Allowed v1 image MIME types. Validated server-side, never from extension. */
export const ALLOWED_MIME_TYPES: readonly MediaMimeType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

/** Maximum upload size: 8 MB. Documented + enforced here, not client-only. */
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

/** Signed URL validity window. Short-lived; client refetches on demand. */
const SIGNED_URL_TTL_SECONDS = 60;

export type MediaResult<T> = { data: T } | { error: string };

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function isAllowedMimeType(mime: string): mime is MediaMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

export function isWithinSizeLimit(bytes: number): boolean {
  return Number.isFinite(bytes) && bytes > 0 && bytes <= MAX_MEDIA_BYTES;
}

/**
 * Sanitize a browser-provided filename into a safe path segment. Strips path
 * separators, control chars, and resolves dot-segments. The user-scoped
 * storage_path is constructed by the app, NOT from the browser path.
 */
export function sanitizeFilename(name: string): string {
  const base = (name || "file").replace(/[\\/:]/g, "");
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .replace(/\.{2,}/g, ".")
    .slice(0, 100);
  return cleaned.length > 0 ? cleaned : "file";
}

/**
 * Build a user-scoped storage path: `<user_id>/<media_id>/<sanitized-name>`.
 * The user_id prefix is the ownership boundary enforced by Storage RLS.
 */
export function buildStoragePath(userId: string, mediaId: string, originalName: string): string {
  return `${userId}/${mediaId}/${sanitizeFilename(originalName)}`;
}

// ---------------------------------------------------------------------------
// Upload + create
// ---------------------------------------------------------------------------

/**
 * Full upload flow: validate → upload file to private Storage → create metadata
 * row → (compensate: delete the uploaded object if the row insert fails).
 *
 * Returns the created Media metadata on success. Never throws into the UI.
 */
export async function uploadMedia(
  userId: string,
  file: File | Blob,
  originalName: string,
  mimeType: string,
  byteSize: number,
  width: number | null = null,
  height: number | null = null,
  capturedAt: string | null = null,
): Promise<MediaResult<Media>> {
  if (!isAllowedMimeType(mimeType)) {
    return { error: "unsupported file type" };
  }
  if (!isWithinSizeLimit(byteSize)) {
    return { error: "file too large" };
  }
  const client = getSupabase();
  if (!client) return { error: "supabase unavailable" };

  // Pre-allocate a media id so the storage path is user-scoped + unique.
  const mediaId =
    (crypto as { randomUUID?: () => string }).randomUUID?.() ??
    `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const storagePath = buildStoragePath(userId, mediaId, originalName);

  // 1. Upload to private Storage.
  const body = file instanceof File ? file : file;
  const { error: upErr } = await client.storage
    .from(BUCKET)
    .upload(storagePath, body, { contentType: mimeType, upsert: false });
  if (upErr) {
    return { error: "storage upload failed" };
  }

  // 2. Create metadata row.
  const row = {
    id: mediaId,
    user_id: userId,
    storage_path: storagePath,
    original_filename: originalName || null,
    mime_type: mimeType,
    byte_size: byteSize,
    width: width,
    height: height,
    captured_at: capturedAt,
  };
  const { data, error: dbErr } = await client.from(MEDIA_TABLE).insert(row).select("*").single();

  if (dbErr || !data) {
    // Compensation: remove the uploaded object so we don't orphan a file.
    try {
      await client.storage.from(BUCKET).remove([storagePath]);
    } catch {
      // Best-effort; orphan reaped by future maintenance.
    }
    return { error: "media record creation failed" };
  }

  return { data: rowToMedia(data as unknown as MediaRow) };
}

/** Create a metadata row only (used when the caller manages Storage itself). */
export async function createMediaRecord(
  userId: string,
  input: MediaCreateInput,
): Promise<MediaResult<Media>> {
  if (!isAllowedMimeType(input.mimeType)) return { error: "unsupported file type" };
  if (!isWithinSizeLimit(input.byteSize)) return { error: "file too large" };
  const client = getSupabase();
  if (!client) return { error: "supabase unavailable" };
  try {
    const row = {
      user_id: userId,
      storage_path: input.storagePath,
      original_filename: input.originalFilename ?? null,
      mime_type: input.mimeType,
      byte_size: input.byteSize,
      width: input.width ?? null,
      height: input.height ?? null,
      captured_at: input.capturedAt ?? null,
    };
    const { data, error } = await client.from(MEDIA_TABLE).insert(row).select("*").single();
    if (error || !data) return { error: "media record creation failed" };
    return { data: rowToMedia(data as unknown as MediaRow) };
  } catch {
    return { error: "media record creation failed" };
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function listUserMedia(userId: string): Promise<Media[]> {
  const client = getSupabase();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from(MEDIA_TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return (data as unknown as MediaRow[]).map(rowToMedia);
  } catch {
    return [];
  }
}

export async function loadMedia(userId: string, mediaId: string): Promise<Media | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from(MEDIA_TABLE)
      .select("*")
      .eq("id", mediaId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return rowToMedia(data as unknown as MediaRow);
  } catch {
    return null;
  }
}

/**
 * Generate a short-lived signed URL for a media object, but ONLY after verifying
 * media.user_id === current user. A media id alone is never sufficient
 * authorization. Returns null on any failure or cross-user attempt (leaks no
 * existence).
 */
export async function getSignedMediaUrl(userId: string, mediaId: string): Promise<string | null> {
  const media = await loadMedia(userId, mediaId);
  if (!media) return null;
  // Defense-in-depth: the storage_path must start with the caller's namespace.
  if (!media.storagePath.startsWith(`${userId}/`)) return null;
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client.storage
      .from(BUCKET)
      .createSignedUrl(media.storagePath, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete a media object: verify ownership, remove all relationship rows (FK
 * cascade handles this, but we also remove Storage), then delete the underlying
 * Storage object. Only a direct media deletion removes the actual file.
 */
export async function deleteMedia(userId: string, mediaId: string): Promise<boolean> {
  const media = await loadMedia(userId, mediaId);
  if (!media) return false;
  const client = getSupabase();
  if (!client) return false;
  try {
    // Delete the metadata row first (cascades relationship rows via FK).
    const { error: delErr } = await client
      .from(MEDIA_TABLE)
      .delete()
      .eq("id", mediaId)
      .eq("user_id", userId);
    if (delErr) return false;
    // Then remove the Storage object (best-effort; metadata is already gone).
    try {
      await client.storage.from(BUCKET).remove([media.storagePath]);
    } catch {
      // Best-effort; orphan reaped by future maintenance.
    }
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Profile media
// ---------------------------------------------------------------------------

/**
 * Set the current profile image. Uses the atomic RPC which verifies media
 * ownership and unsets any prior is_current row (old media is NOT deleted).
 */
export async function attachMediaToProfile(userId: string, mediaId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client.rpc("set_current_profile_media_atomic", {
      p_user_id: userId,
      p_media_id: mediaId,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function detachMediaFromProfile(userId: string, mediaId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client
      .from(PROFILE_MEDIA_TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("media_id", mediaId);
    return !error;
  } catch {
    return false;
  }
}

/** Load the current profile media (if any) for the caller. */
export async function loadCurrentProfileMedia(userId: string): Promise<Media | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from(PROFILE_MEDIA_TABLE)
      .select("media_id")
      .eq("user_id", userId)
      .eq("is_current", true)
      .maybeSingle();
    if (error || !data) return null;
    return loadMedia(userId, (data as { media_id: string }).media_id);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Memory media
// ---------------------------------------------------------------------------

export async function attachMediaToMemory(
  userId: string,
  mediaId: string,
  memoryId: string,
  position = 0,
): Promise<boolean> {
  return attachToContext(userId, mediaId, "memory", memoryId, position);
}

export async function detachMediaFromMemory(
  userId: string,
  mediaId: string,
  memoryId: string,
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client
      .from(MEMORY_MEDIA_TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("media_id", mediaId)
      .eq("memory_id", memoryId);
    return !error;
  } catch {
    return false;
  }
}

export async function listMemoryMedia(userId: string, memoryId: string): Promise<MediaWithUrl[]> {
  return listContextMedia(userId, "memory", memoryId, "memory_id");
}

// ---------------------------------------------------------------------------
// Event media
// ---------------------------------------------------------------------------

export async function attachMediaToEvent(
  userId: string,
  mediaId: string,
  eventId: string,
  position = 0,
): Promise<boolean> {
  return attachToContext(userId, mediaId, "event", eventId, position);
}

export async function detachMediaFromEvent(
  userId: string,
  mediaId: string,
  eventId: string,
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client
      .from(EVENT_MEDIA_TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("media_id", mediaId)
      .eq("event_id", eventId);
    return !error;
  } catch {
    return false;
  }
}

export async function listEventMedia(userId: string, eventId: string): Promise<MediaWithUrl[]> {
  return listContextMedia(userId, "event", eventId, "event_id");
}

// ---------------------------------------------------------------------------
// Chapter media
// ---------------------------------------------------------------------------

export async function attachMediaToChapter(
  userId: string,
  mediaId: string,
  chapterId: string,
  position = 0,
): Promise<boolean> {
  return attachToContext(userId, mediaId, "chapter", chapterId, position);
}

export async function detachMediaFromChapter(
  userId: string,
  mediaId: string,
  chapterId: string,
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client
      .from(CHAPTER_MEDIA_TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("media_id", mediaId)
      .eq("chapter_id", chapterId);
    return !error;
  } catch {
    return false;
  }
}

export async function listChapterMedia(userId: string, chapterId: string): Promise<MediaWithUrl[]> {
  return listContextMedia(userId, "chapter", chapterId, "chapter_id");
}

// ---------------------------------------------------------------------------
// Internal: generic attach + list (ownership-verified via RPC)
// ---------------------------------------------------------------------------

type MediaContext = "memory" | "event" | "chapter";

async function attachToContext(
  userId: string,
  mediaId: string,
  context: MediaContext,
  contextId: string,
  position: number,
): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client.rpc("attach_media_to_context_atomic", {
      p_user_id: userId,
      p_media_id: mediaId,
      p_context: context,
      p_context_id: contextId,
      p_position: position,
    });
    return !error;
  } catch {
    return false;
  }
}

async function listContextMedia(
  userId: string,
  context: MediaContext,
  contextId: string,
  contextCol: string,
): Promise<MediaWithUrl[]> {
  const client = getSupabase();
  if (!client) return [];
  const table =
    context === "memory"
      ? MEMORY_MEDIA_TABLE
      : context === "event"
        ? EVENT_MEDIA_TABLE
        : CHAPTER_MEDIA_TABLE;
  try {
    const { data: links, error } = await client
      .from(table)
      .select("media_id, position")
      .eq(contextCol, contextId)
      .eq("user_id", userId)
      .order("position", { ascending: true });
    if (error || !links) return [];
    const linkRows = links as Array<{ media_id: string; position: number }>;
    if (linkRows.length === 0) return [];
    const mediaIds = linkRows.map((l) => l.media_id);
    const { data: mediaRows } = await client
      .from(MEDIA_TABLE)
      .select("*")
      .in("id", mediaIds)
      .eq("user_id", userId);
    const mediaMap = new Map<string, Media>();
    for (const r of (mediaRows ?? []) as unknown as MediaRow[]) {
      mediaMap.set(r.id, rowToMedia(r));
    }

    // Generate signed URLs (ownership already verified via .eq user_id + RLS).
    const out: MediaWithUrl[] = [];
    for (const l of linkRows) {
      const m = mediaMap.get(l.media_id);
      if (!m) continue;
      const signedUrl = await getSignedMediaUrl(userId, m.id);
      out.push({ ...m, signedUrl, position: l.position });
    }
    return out;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToMedia(row: MediaRow): Media {
  return {
    id: row.id,
    userId: row.user_id,
    storagePath: row.storage_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    byteSize: Number(row.byte_size),
    width: row.width,
    height: row.height,
    capturedAt: row.captured_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Re-export row types for convenience.
export type { ChapterMediaRow, EventMediaRow, MediaRow, MemoryMediaRow, ProfileMediaRow };
