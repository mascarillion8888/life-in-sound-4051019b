/**
 * Listener profile (birth year). Backed by `public.profiles` when Supabase is
 * configured, with a localStorage fallback so the app still works without it.
 * Never throws into the UI.
 */
import { useCallback, useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "./client";
import { parseBirthYear } from "./birthYear";

const LS_KEY = "lis.birthYear";
const LS_SKIP_KEY = "lis.birthYearSkipped";

function readLocal(): number | null {
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? parseBirthYear(raw) : null;
  } catch {
    return null;
  }
}

function writeLocal(year: number | null): void {
  try {
    if (year == null) window.localStorage.removeItem(LS_KEY);
    else window.localStorage.setItem(LS_KEY, String(year));
  } catch {
    /* storage unavailable: keep in memory only */
  }
}

function readSkipped(): boolean {
  try {
    return window.localStorage.getItem(LS_SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSkipped(value: boolean): void {
  try {
    if (value) window.localStorage.setItem(LS_SKIP_KEY, "1");
    else window.localStorage.removeItem(LS_SKIP_KEY);
  } catch {
    /* storage unavailable: keep in memory only */
  }
}

export type ProfileState = {
  loading: boolean;
  birthYear: number | null;
  skipped: boolean;
  save: (year: number) => Promise<void>;
  skip: () => Promise<void>;
};

export function useProfile(userId: string | null | undefined): ProfileState {
  const [loading, setLoading] = useState(true);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = isSupabaseConfigured() ? getSupabase() : null;
    if (!supabase || !userId) {
      setBirthYear(readLocal());
      setSkipped(readSkipped());
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("birth_year")
          .eq("user_id", userId)
          .maybeSingle();
        if (!active) return;
        const remote = typeof data?.birth_year === "number" ? data.birth_year : null;
        setBirthYear(remote ?? readLocal());
        // If there's a remote birth_year, we consider it not skipped
        // Only check localStorage skip flag if no remote birth_year
        if (!remote) {
          setSkipped(readSkipped());
        }
      } catch {
        if (active) {
          setBirthYear(readLocal());
          setSkipped(readSkipped());
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const save = useCallback(
    async (year: number) => {
      setBirthYear(year);
      setSkipped(false);
      writeLocal(year);
      writeSkipped(false);
      const supabase = isSupabaseConfigured() ? getSupabase() : null;
      if (!supabase || !userId) return;
      try {
        await supabase
          .from("profiles")
          .upsert({ user_id: userId, birth_year: year }, { onConflict: "user_id" });
      } catch {
        /* local copy already saved; remote retry happens on next save */
      }
    },
    [userId],
  );

  const skip = useCallback(
    async () => {
      setSkipped(true);
      setBirthYear(null);
      writeLocal(null);
      writeSkipped(true);
      const supabase = isSupabaseConfigured() ? getSupabase() : null;
      if (!supabase || !userId) return;
      try {
        await supabase
          .from("profiles")
          .upsert({ user_id: userId, birth_year: null }, { onConflict: "user_id" });
      } catch {
        /* local copy already saved; remote retry happens on next save */
      }
    },
    [userId],
  );

  return { loading, birthYear, skipped, save, skip };
}