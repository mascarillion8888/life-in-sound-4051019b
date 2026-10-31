import { createClient } from "@supabase/supabase-js";

export type GenerationAccess = {
  userId: string;
  supabase: ReturnType<typeof createClient>;
};

/**
 * Validate the caller's Supabase JWT and reserve one distinct track slot
 * before any paid provider work begins. Anonymous Supabase users have the
 * authenticated database role, so no registration is required.
 */
export async function authorizeCardGeneration(
  accessToken: string | null | undefined,
  trackKey: string,
): Promise<GenerationAccess | null> {
  const token = accessToken?.trim();
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey || !trackKey || trackKey.length > 200) return null;

  try {
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await supabase.auth.getUser(token);
    const userId = data.user?.id;
    if (error || !userId) return null;

    const { data: reserved, error: reserveError } = await supabase.rpc(
      "reserve_card_generation",
      { p_track_key: trackKey },
    );
    if (reserveError || reserved !== true) return null;

    return { userId, supabase };
  } catch {
    return null;
  }
}
