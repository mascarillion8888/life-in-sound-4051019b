/**
 * Auth session for Sprint 011 — minimum viable user identity.
 *
 * Uses Supabase anonymous auth: no login UI, no password, no friction. Each
 * browser gets an anonymous user id; the journeys row is owned by that id and
 * protected by RLS. When Supabase is not configured, `useSession` resolves to
 * `null` and persistence falls back to localStorage.
 */
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./client";

export type SessionState =
  { status: "loading" } | { status: "anonymous"; user: User | null } | { status: "unavailable" };

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

    // Resolve the current session, signing in anonymously if none exists.
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (data.session) {
        setState({ status: "anonymous", user: data.session.user });
        return;
      }
      const { data: signInData } = await supabase.auth.signInAnonymously();
      if (!active) return;
      if (signInData.session) {
        setState({ status: "anonymous", user: signInData.session.user });
      } else {
        // Anonymous sign-in not enabled on the project — degrade gracefully.
        setState({ status: "unavailable" });
      }
    });

    // Keep state in sync if the token refreshes or the session changes.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState(session ? { status: "anonymous", user: session.user } : { status: "unavailable" });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
