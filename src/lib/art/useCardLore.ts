/**
 * useCardLore — client side of the multidimensional card route.
 *
 * Owns the lore line (and the card persistence side-effect) for one era
 * card. The painting itself still flows through `useCardArtwork`'s three
 * cache tiers — this hook deliberately does NOT race it; it only asks the
 * server for the poetic 2-sentence lore snippet and, when the user is
 * authenticated, lets the server persist the full card state (migration
 * 0003) under the caller's own RLS session.
 *
 * Cache contract mirrors the artwork hook: module-level memory Map keyed by
 * the track's artwork key, so the same track never re-generates its lore
 * within a session. Failures resolve to null — the card then keeps its
 * deterministic narrative (never an empty lore box).
 */
import { useEffect, useState } from "react";

import { getSupabase } from "@/lib/supabase/client";
import type { Song } from "@/lib/song/types";

import { generateCard } from "./generateCard.server";
import { cardArtworkKey } from "./useCardArtwork";

const LORE_CACHE = new Map<string, string>();

/** Test-only: reset the session tier. */
export function __clearCardLoreCache(): void {
  LORE_CACHE.clear();
}

export type CardLoreContext = {
  cardIndex?: number;
  birthYear?: number | null;
  encounterAge?: number | null;
  genre?: string | null;
  userMemory?: string | null;
};

export function useCardLore(song: Song | null, context: CardLoreContext = {}): string | null {
  const key = song ? cardArtworkKey(song) : "";
  const artist = song?.artist ?? "";
  const title = song?.title ?? "";
  const releaseYear = song?.releaseYear ?? null;
  const { cardIndex, birthYear, encounterAge, genre, userMemory } = context;

  const [state, setState] = useState<{ key: string; lore: string | null }>({
    key: "",
    lore: null,
  });

  useEffect(() => {
    if (!key) {
      setState({ key: "", lore: null });
      return;
    }
    const cached = LORE_CACHE.get(key);
    if (cached) {
      setState({ key, lore: cached });
      return;
    }

    let active = true;
    setState({ key, lore: null });

    // The caller's own session token — persistence runs under that user's
    // RLS context server-side; anonymous/no-session users simply skip it.
    void (async () => {
      let accessToken: string | null = null;
      try {
        const supabase = getSupabase();
        const session = supabase ? (await supabase.auth.getSession()).data.session : null;
        accessToken = session?.access_token ?? null;
      } catch {
        accessToken = null;
      }

      try {
        const out = await generateCard({
          data: {
            trackKey: key,
            artist,
            songTitle: title,
            releaseYear,
            cardIndex,
            birthYear: birthYear ?? null,
            encounterAge: encounterAge ?? null,
            genre: genre ?? null,
            userMemory: userMemory ?? null,
            accessToken,
          },
        });
        if (!active) return;
        if (out.lore) {
          LORE_CACHE.set(key, out.lore);
          setState({ key, lore: out.lore });
        }
      } catch {
        /* lore is an enhancement — the deterministic narrative stays */
      }
    })();

    return () => {
      active = false;
    };
  }, [key, artist, title, releaseYear, cardIndex, birthYear, encounterAge, genre, userMemory]);

  if (!song || state.key !== key) return null;
  return state.lore;
}
