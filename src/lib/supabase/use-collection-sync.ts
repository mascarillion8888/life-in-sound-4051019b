/**
 * Bridges the local-first collection to Supabase.
 *
 * One hook instance (in the journey route) resolves the sync target from the
 * session and pulls+merges the server copy ONCE per user. Deep components
 * (QuizCard) then mirror individual toggles through the module-level
 * `syncCollectionToggle`, so the hearts never each spin up their own auth
 * subscription. When there is no user or Supabase is unavailable, the target is
 * cleared and everything stays local — nothing throws into the UI.
 */
import { useEffect } from "react";

import type { CollectionEntry } from "@/lib/collection";
import { getSupabase, isSupabaseConfigured } from "./client";
import { type SyncClient, pullAndMerge, pushEntry, removeEntry } from "@/lib/collection-sync";
import type { SessionState } from "./use-session";

type Target = { supabase: SyncClient; userId: string | null };

let target: Target = { supabase: null, userId: null };
/** The user id already pulled for, so a remount does not re-request. */
let pulledFor: string | null = null;

/** Test seam — reset the module-level target between tests. */
export function __resetCollectionSync(): void {
  target = { supabase: null, userId: null };
  pulledFor = null;
}

/**
 * Mirror one toggle to the server. `entry` present means "saved" (upsert);
 * `null` means "removed" (delete). No-op without a resolved user.
 */
export function syncCollectionToggle(trackKey: string, entry: CollectionEntry | null): void {
  if (!target.userId) return;
  if (entry) pushEntry(target.supabase, target.userId, entry);
  else removeEntry(target.supabase, target.userId, trackKey);
}

/** Resolve the sync target from the session and pull the server copy once. */
export function useCollectionSync(session: SessionState): void {
  const userId = session.status === "anonymous" && session.user ? session.user.id : null;

  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) {
      target = { supabase: null, userId: null };
      return;
    }
    const supabase = getSupabase();
    target = { supabase, userId };
    if (!supabase || pulledFor === userId) return;

    pulledFor = userId;
    void pullAndMerge(supabase, userId);

    return () => {
      target = { supabase: null, userId: null };
    };
  }, [userId]);
}
