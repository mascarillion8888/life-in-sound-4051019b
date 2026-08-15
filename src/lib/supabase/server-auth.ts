/**
 * Server-side identity resolution — derives the authoritative user identity
 * from the CURRENT authenticated Supabase session, never from a browser-
 * supplied userId.
 *
 * Canonical flow:
 *
 *   SERVER FUNCTION
 *     ↓
 *   CURRENT AUTH SESSION (access token presented by the browser)
 *     ↓
 *   AUTH USER ID  (verified by Supabase Auth via getUser(token))
 *     ↓
 *   DATABASE OWNERSHIP  (RLS = auth.uid() = user_id, final enforcement)
 *
 * WHY THIS EXISTS:
 *   The Companion Conversation server function must not trust a browser-
 *   provided `userId` as the source of identity. The browser holds its own
 *   access token (JWT) in the Supabase session; presenting that token to the
 *   server is presenting a credential, NOT an identity claim. The server
 *   verifies the token against Supabase Auth (`getUser(token)`) and derives
 *   `user.id` from the verified result. A forged or expired token yields null
 *   and the operation is rejected before any database access.
 *
 * WHY NOT @supabase/ssr:
 *   The existing client uses localStorage session persistence
 *   (`persistSession: true`), not cookies. Adding @supabase/ssr + cookie
 *   middleware would change the auth model for the whole application. Instead,
 *   we reuse the existing anon client (`getSupabase()`, which works server-side
 *   because VITE_* env vars are inlined at build time) and call
 *   `auth.getUser(accessToken)`, which the Supabase SDK explicitly recommends
 *   for securely establishing server-side identity. This:
 *     1. preserves the current auth model (localStorage session, no cookies)
 *     2. does not expose service-role credentials (anon client + getUser only)
 *     3. does not add a dependency (no @supabase/ssr)
 *     4. does not weaken RLS (still enforced; userId is the verified id)
 *     5. does not create a second identity system (uses auth.users)
 *
 * SECURITY:
 *   - The access token is the user's OWN bearer credential, presented to the
 *     server over the same origin. It is not a secret leak — it is how the
 *     browser proves who it is. The server never logs or returns it.
 *   - Anonymous users are valid users (anonymous auth); `getUser` returns
 *     their verified id with `is_anonymous: true`. No permanent account is
 *     required yet.
 *   - No service-role key is used anywhere here.
 */
import { getSupabase } from "./client";

export type VerifiedUser = {
  id: string;
  isAnonymous: boolean;
};

/**
 * Verify the presented access token and return the authenticated user.
 *
 * Returns null when:
 *   - Supabase is not configured
 *   - the token is absent, malformed, expired, or revoked
 *   - the user lookup fails for any reason
 *
 * Never throws. Callers treat null as "no authenticated user — reject".
 */
export async function getCurrentUser(
  accessToken: string | undefined | null,
): Promise<VerifiedUser | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  if (!accessToken || typeof accessToken !== "string" || accessToken.length === 0) return null;

  try {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data?.user) return null;
    return { id: data.user.id, isAnonymous: Boolean(data.user.is_anonymous) };
  } catch {
    return null;
  }
}
