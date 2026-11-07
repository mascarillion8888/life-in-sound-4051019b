/**
 * Listener profile (birth year). Backed by `public.profiles` when Supabase is
 * configured, with a localStorage fallback so the app still works without it.
 * Never throws into the UI.
 *
 * `ready` is false while the auth session is still resolving. Until it flips to
 * true the hook stays in `loading` and decides nothing, so the birth-year
 * prompt cannot flash before we know whether a year already exists.
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

function writeLocal(year: number): void {
  try {
    window.localStorage.setItem(LS_KEY, String(year));
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

function writeSkipped(): void {
  try {
    window.localStorage.setItem(LS_SKIP_KEY, "1");
  } catch {
    /* in-memory only */
  }
}

export type ProfileState = {
  loading: boolean;
  birthYear: number | null;
  /** True when the listener chose to skip the birth-year question. */
  skipped: boolean;
  save: (year: number) => Promise<void>;
  skip: () => Promise<void>;
};

export function useProfile(userId: string | null | undefined, ready: boolean): ProfileState {
  const [loading, setLoading] = useState(true);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    // Session still resolving: stay in loading and decide nothing.
    if (!ready) {
      setLoading(true);
      return;
    }

    let active = true;
    const supabase = isSupabaseConfigured() ? getSupabase() : null;

    // No backend or no user: the local copy is the source of truth.
    if (!supabase || !userId) {
      setBirthYear(readLocal());
      setSkipped(readSkipped());
      setLoading(false);
      return;
    }

    setLoading(true);
    void (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("birth_year")
          .eq("user_id", userId)
          .maybeSingle();
        if (!active) return;
        const remote = typeof data?.birth_year === "number" ? data.birth_year : null;
        if (remote != null) writeLocal(remote);
        setBirthYear(remote ?? readLocal());
        setSkipped(readSkipped());
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
  }, [userId, ready]);

  const save = useCallback(
    async (year: number) => {
      setBirthYear(year);
      setSkipped(false);
      writeLocal(year);
      const supabase = isSupabaseConfigured() ? getSupabase() : null;
      if (!supabase || !userId) return;
      try {
        await supabase
          .from("profiles")
          .upsert({ user_id: userId, birth_year: year }, { onConflict: "user_id" });
      } catch {
        /* local copy already saved */
      }
    },
    [userId],
  );

  const skip = useCallback(async () => {
    setSkipped(true);
    writeSkipped();
  }, []);

  return { loading, birthYear, skipped, save, skip };
}
