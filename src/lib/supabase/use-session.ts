/**
 * Auth session — anonymous-first identity with optional permanent conversion.
 *
 * Uses Supabase anonymous auth: no login UI, no password, no friction. Each
 * browser gets an anonymous user id; every domain row is owned by that id and
 * protected by RLS. When Supabase is not configured, `useSession` resolves to
 * `unavailable` and persistence falls back to localStorage.
 *
 * Identity continuity:
 *   - `user.is_anonymous` is the single source of truth for identity state.
 *     No second application-level flag that can drift.
 *   - An anonymous user can be promoted to a permanent identity via
 *     `updateUser({ email })` (see identity-remote.ts). This preserves the
 *     SAME auth.users.id, so all existing RLS-owned data remains visible — no
 *     data copy, no new user. See `convertAnonymousToEmail`.
 *   - Consumers should prefer `useUserId(session)` to obtain the owner id; it
 *     is non-null for both `anonymous` and `authenticated` (backward
 *     compatible with the original `status === "anonymous"` usage).
 */
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./client";

export type SessionState =
  | { status: "loading" }
  | { status: "anonymous"; user: User; accessToken: string }
  | { status: "authenticated"; user: User; accessToken: string }
  | { status: "unavailable" };

/**
 * Resolve the owner user id from a session. Non-null for both anonymous and
 * authenticated sessions (same id before/after conversion), null otherwise.
 * Use this in consumers instead of hand-rolling `session.status === ...`.
 */
export function useUserId(session: SessionState): string | null {
  if (session.status === "anonymous" || session.status === "authenticated") {
    return session.user.id;
  }
  return null;
}

/**
 * Resolve the access token (credential) from a session, for presenting to
 * server functions that verify identity server-side. Null when there is no
 * authenticated session.
 */
export function useAccessToken(session: SessionState): string | null {
  if (session.status === "anonymous" || session.status === "authenticated") {
    return session.accessToken;
  }
  return null;
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState({ status: "unavailable" });
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setState({ status: "unavailable" });
      return;
    }

    let active = true;

    const syncFromSession = (session: { user?: User; access_token?: string } | null) => {
      if (!active) return;
      if (session?.user && session.access_token) {
        setState(
          session.user.is_anonymous
            ? { status: "anonymous", user: session.user, accessToken: session.access_token }
            : { status: "authenticated", user: session.user, accessToken: session.access_token },
        );
      } else {
        setState({ status: "unavailable" });
      }
    };

    // Resolve the current session, signing in anonymously if none exists.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (data.session) {
        syncFromSession(data.session);
        return;
      }
      const { data: signInData } = await supabase.auth.signInAnonymously();
      if (!active) return;
      if (signInData.session) {
        syncFromSession(signInData.session);
      } else {
        // Anonymous sign-in not enabled on the project — degrade gracefully.
        setState({ status: "unavailable" });
      }
    });

    // Keep state in sync if the token refreshes or the session changes (e.g.
    // after a successful identity update the user.is_anonymous claim flips).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      syncFromSession(session);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
