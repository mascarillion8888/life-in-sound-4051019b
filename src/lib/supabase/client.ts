import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client.
 *
 * Credentials come from VITE_* env vars. The anon key is safe to ship to the
 * browser — all access is gated by Row Level Security (see migration 0001).
 * The service-role key is NEVER referenced here or anywhere client-side.
 *
 * When env vars are absent (e.g. local dev without a project), `getSupabase`
 * returns `null` and callers fall back to localStorage-only persistence.
 */

let client: SupabaseClient | null | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey) {
    client = null;
    return null;
  }
  client = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}
