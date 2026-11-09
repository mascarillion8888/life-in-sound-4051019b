/**
 * Collection ↔ Supabase mirror (local-first).
 *
 * The UI always reads and writes localStorage (`src/lib/collection.ts`) — this
 * module only mirrors the local list to the `collection_entries` table so a
 * signed-in / anonymous user keeps the same favorites across devices. Every
 * call is best-effort: if Supabase is missing or errors, the local copy is left
 * exactly as it was and nothing throws into the UI.
 *
 * Only the publishable browser client (`getSupabase`) is ever used — never a
 * service-role key. No email, token or user id is logged.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type CollectionEntry,
  type CollectionState,
  collectionFromEntries,
  loadCollection,
  normalizeCollectionEntry,
  saveCollection,
} from "./collection";

export type SyncClient = SupabaseClient | null;

const TABLE = "collection_entries";

/** Newest-first union by `trackKey`; on a clash the newer `addedAt` wins. */
export function mergeCollections(
  local: CollectionEntry[],
  remote: CollectionEntry[],
): CollectionState {
  const byKey = new Map<string, CollectionEntry>();
  for (const entry of [...local, ...remote]) {
    const existing = byKey.get(entry.trackKey);
    // ISO-8601 timestamps compare lexicographically; a tie keeps the earlier
    // (local) entry, so the merge is deterministic.
    if (!existing || entry.addedAt > existing.addedAt) byKey.set(entry.trackKey, entry);
  }
  return collectionFromEntries([...byKey.values()]);
}

/** Map one `collection_entries` row into the local entry shape (or null). */
function fromRow(row: unknown): CollectionEntry | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  return normalizeCollectionEntry({
    trackKey: r.track_key,
    snapshot: r.snapshot,
    addedAt: r.added_at,
  });
}

function toRow(userId: string, entry: CollectionEntry) {
  return {
    user_id: userId,
    track_key: entry.trackKey,
    snapshot: entry.snapshot,
    added_at: entry.addedAt,
  };
}

/** Upsert entries for a user. Never throws — errors are swallowed. */
async function upsertEntries(
  supabase: SyncClient,
  userId: string | null | undefined,
  entries: CollectionEntry[],
): Promise<void> {
  if (!supabase || !userId || entries.length === 0) return;
  try {
    await supabase.from(TABLE).upsert(
      entries.map((e) => toRow(userId, e)),
      { onConflict: "user_id,track_key" },
    );
  } catch {
    /* local-first: the local copy is already saved */
  }
}

/**
 * Read the server copy, merge it with the local list, push local-only entries
 * up, and persist the union locally. Returns the merged state. On any failure
 * the local state is returned unchanged.
 */
export async function pullAndMerge(
  supabase: SyncClient,
  userId: string | null | undefined,
): Promise<CollectionState> {
  const local = loadCollection();
  if (!supabase || !userId) return local;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("track_key, snapshot, added_at")
      .eq("user_id", userId);
    if (error) return local;

    const remote = (data ?? []).map(fromRow).filter((e): e is CollectionEntry => e !== null);
    const merged = mergeCollections(local.entries, remote);

    // Push what the server does not have yet (local-only survivors of the cap).
    const remoteKeys = new Set(remote.map((e) => e.trackKey));
    await upsertEntries(
      supabase,
      userId,
      merged.entries.filter((e) => !remoteKeys.has(e.trackKey)),
    );

    saveCollection(merged);
    return merged;
  } catch {
    return local;
  }
}

/** Mirror one saved track to the server (fire-and-forget). */
export function pushEntry(
  supabase: SyncClient,
  userId: string | null | undefined,
  entry: CollectionEntry,
): void {
  void upsertEntries(supabase, userId, [entry]);
}

/** Drop one track from the server copy (fire-and-forget). */
export function removeEntry(
  supabase: SyncClient,
  userId: string | null | undefined,
  trackKey: string,
): void {
  if (!supabase || !userId || !trackKey) return;
  void (async () => {
    try {
      await supabase.from(TABLE).delete().eq("user_id", userId).eq("track_key", trackKey);
    } catch {
      /* local-first: the local copy is already updated */
    }
  })();
}
