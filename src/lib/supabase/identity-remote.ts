/**
 * Identity Continuity — anonymous → permanent identity linking.
 *
 * Architecture:
 *   - We do NOT migrate or copy user data between user ids.
 *   - We use Supabase's supported anonymous-user linking flow
 *     (`supabase.auth.updateUser({ email })`), which promotes the CURRENT
 *     anonymous auth.users record to a permanent identity while preserving the
 *     SAME auth.users.id. Because every domain row is owned by that id (and
 *     gated by RLS on `auth.uid() = user_id`), all existing data — Journey,
 *     Memories, Media, Events, Chapters, Patterns, Connections, Reflections —
 *     remains visible with zero data movement. RLS policies require no changes.
 *
 * Invariant (enforced in code + tests):
 *   beforeUserId === afterUserId
 *
 * If the invariant fails we stop the flow: we do not copy data, do not delete
 * data, and surface a failure.
 *
 * Conflict handling:
 *   - If the entered email is already associated with another account,
 *     Supabase returns an error (`User already registered` / similar). We never
 *     merge, never overwrite, never disclose whether the account exists beyond
 *     an existence-safe message. The user may sign into the existing account
 *     separately.
 *
 * Security:
 *   - Operates only on the currently authenticated session via the anon client.
 *   - No service-role key, no admin auth API, no provider secrets.
 *   - Passwords are never stored in application tables. If the project's auth
 *     configuration requires a password to finalize email linking, the caller
 *     passes it through to `updateUser` only; it is forwarded to Supabase Auth
 *     and never persisted by this module.
 */

import { getSupabase } from "./client";

export type IdentityStatus = "anonymous" | "authenticated" | "unavailable";

/**
 * Read the live identity status from the current Supabase session.
 * `user.is_anonymous` is the single source of truth — no app-level flag.
 */
export async function getIdentityStatus(): Promise<{
  status: IdentityStatus;
  userId: string | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { status: "unavailable", userId: null };
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user) return { status: "unavailable", userId: null };
  return {
    status: user.is_anonymous ? "anonymous" : "authenticated",
    userId: user.id,
  };
}

export type ConversionResult =
  | { ok: true; beforeUserId: string; afterUserId: string; verificationEmailSent: boolean }
  | { ok: false; error: ConversionError; beforeUserId: string | null; afterUserId: string | null };

export type ConversionError =
  | "no-session"
  | "not-anonymous"
  | "invalid-email"
  | "email-already-registered"
  | "user-id-mismatch"
  | "rate-limited"
  | "unknown";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Promote the current anonymous user to a permanent email identity.
 *
 * Steps:
 *   1. Capture `beforeUserId` from the current session; abort if no session or
 *      if the current user is not anonymous (already linked → no-op failure).
 *   2. Validate the email client-side (defense-in-depth; Supabase also
 *      validates).
 *   3. Call `supabase.auth.updateUser({ email })`. Supabase sends a
 *      verification email/OTP; the user must confirm to finalize. The current
 *      anonymous session remains the owner — no second user is created.
 *   4. Re-read the session and verify `afterUserId === beforeUserId`. If the
 *      invariant fails, return a mismatch failure without touching any domain
 *      data.
 *
 * No data is copied or deleted at any point. On any failure the existing
 * anonymous account and its data are left intact.
 */
export async function convertAnonymousToEmail(email: string): Promise<ConversionResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: "no-session", beforeUserId: null, afterUserId: null };
  }

  // 1. Capture beforeUserId + confirm anonymous.
  const { data: before } = await supabase.auth.getSession();
  const beforeUser = before.session?.user;
  const beforeUserId = beforeUser?.id ?? null;
  if (!beforeUser) {
    return { ok: false, error: "no-session", beforeUserId, afterUserId: null };
  }
  if (!beforeUser.is_anonymous) {
    // Already permanent — do not re-link.
    return { ok: false, error: "not-anonymous", beforeUserId, afterUserId: beforeUserId };
  }

  // 2. Validate email.
  const trimmed = email.trim();
  if (!EMAIL_RE.test(trimmed)) {
    return { ok: false, error: "invalid-email", beforeUserId, afterUserId: beforeUserId };
  }

  // 3. updateUser({ email }) on the current anonymous session. Supabase
  //    preserves auth.users.id and flips is_anonymous once the email is
  //    verified. A verification email is sent when email confirmation is on.
  const { error } = await supabase.auth.updateUser({ email: trimmed });

  if (error) {
    const msg = error.message.toLowerCase();
    // Existence-safe: map "already registered" to a dedicated code but the UI
    // surfaces the same existence-safe message as other failures to avoid
    // account enumeration.
    const code: ConversionError =
      msg.includes("already registered") || msg.includes("already in use")
        ? "email-already-registered"
        : msg.includes("rate limit")
          ? "rate-limited"
          : "unknown";
    return { ok: false, error: code, beforeUserId, afterUserId: beforeUserId };
  }

  // 4. Verify same user id. The access token may not yet reflect the verified
  //    email (verification pending), but the user id must remain unchanged.
  const { data: after } = await supabase.auth.getSession();
  const afterUserId = after.session?.user?.id ?? null;
  if (!afterUserId || afterUserId !== beforeUserId) {
    // Invariant violated — stop. No data touched.
    return { ok: false, error: "user-id-mismatch", beforeUserId, afterUserId };
  }

  return {
    ok: true,
    beforeUserId,
    afterUserId,
    // We cannot know for certain whether the project requires email
    // confirmation without Dashboard config; we report that a verification
    // step MAY be expected. The caller surfaces "check your email" guidance.
    verificationEmailSent: true,
  };
}

/**
 * Sign out the current session. Sign-out does NOT delete the user or any data.
 * After sign-out the caller will sign back in (anonymously or to an existing
 * account); all previously-owned rows remain owned by the original user id and
 * are still protected by RLS.
 */
export async function signOutIdentity(): Promise<{ ok: boolean }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false };
  const { error } = await supabase.auth.signOut();
  return { ok: !error };
}

/**
 * Refresh the live identity state after an auth change (e.g. email verified,
 * token refreshed). Re-reads the session so `user.is_anonymous` reflects the
 * current access token. Used by the UI to re-derive status without a full
 * reload; the auth state subscription in use-session.ts is the primary driver.
 */
export async function refreshIdentity(): Promise<{
  status: IdentityStatus;
  userId: string | null;
}> {
  const supabase = getSupabase();
  if (!supabase) return { status: "unavailable", userId: null };
  await supabase.auth.refreshSession();
  return getIdentityStatus();
}
