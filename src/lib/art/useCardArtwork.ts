/**
 * useCardArtwork — client side of the decoupled visual pipeline.
 *
 * The Era Card face shows a Gemini/Imagen fine-art painting (generated
 * server-side, see `cardArtwork.server.ts`); the provider's album cover is
 * never used as card imagery. This hook owns the client cache tiers so a
 * painting is generated at most once per track:
 *
 *   1. module-level in-memory Map  → instant re-renders within the session,
 *   2. localStorage (LRU-capped)   → survives a reload, quota-safe,
 *   3. the server function         → the only path that spends an API call.
 *
 * Status contract:
 *   - "idle":        no song — the caller renders its empty dark frame.
 *   - "loading":     generation in flight → gothic placeholder (shimmer).
 *   - "ready":       `imageUrl` holds the generated painting.
 *   - "unavailable": no API key / generation failed → static gothic
 *                    placeholder; the cover is never substituted back in.
 */
import { useEffect, useState } from "react";

import type { Song } from "@/lib/song/types";

import { generateCardArtwork } from "./cardArtwork.server";

const CARD_ART_STORAGE_KEY = "soundmap.card-art.v1";
/** Cap the persistent tier — base64 paintings are heavy, quota is finite. */
const MAX_PERSISTED_PAINTINGS = 12;

export type CardArtworkStatus = "idle" | "loading" | "ready" | "unavailable";

/** Session tier — lives for the page lifetime, zero I/O. */
const MEMORY_CACHE = new Map<string, string>();

/**
 * Cache identity: the provider's track id when one exists; manual entries
 * (whose providerId is a per-question slug like `manual-3`) fall back to the
 * artist+title pair so two identical manual entries share one painting.
 */
export function cardArtworkKey(song: Song): string {
  if (song.provider === "manual" || !song.providerId) {
    return `manual:${song.artist.toLowerCase()}:${song.title.toLowerCase()}`;
  }
  return `${song.provider}:${song.providerId}`;
}

function readPersisted(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(CARD_ART_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.startsWith("data:image/")) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

/** Persist LRU-capped; quota failures simply skip persistence (memory tier still works). */
function writePersisted(key: string, image: string): void {
  try {
    const all = readPersisted();
    delete all[key];
    all[key] = image;
    const keys = Object.keys(all);
    while (keys.length > MAX_PERSISTED_PAINTINGS) {
      const oldest = keys.shift();
      if (oldest) delete all[oldest];
    }
    window.localStorage.setItem(CARD_ART_STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* quota/private mode — the in-memory tier already has the painting */
  }
}

/** Test-only: reset the session tier. */
export function __clearCardArtworkMemoryCache(): void {
  MEMORY_CACHE.clear();
}

export function useCardArtwork(
  song: Song | null,
  context: { cardIndex?: number } = {},
): {
  imageUrl: string | null;
  status: CardArtworkStatus;
} {
  // Stable primitives — callers often rebuild Song objects every render, so
  // the effect must key off identity-free values, never the object itself.
  const key = song ? cardArtworkKey(song) : "";
  const artist = song?.artist ?? "";
  const title = song?.title ?? "";
  const album = song?.album ?? null;
  const releaseYear = song?.releaseYear ?? null;
  const cardIndex = context.cardIndex;

  const [state, setState] = useState<{
    key: string;
    imageUrl: string | null;
    status: CardArtworkStatus;
  }>({ key: "", imageUrl: null, status: "idle" });

  useEffect(() => {
    if (!key) {
      setState({ key: "", imageUrl: null, status: "idle" });
      return;
    }

    const memory = MEMORY_CACHE.get(key);
    if (memory) {
      setState({ key, imageUrl: memory, status: "ready" });
      return;
    }
    const persisted = readPersisted()[key];
    if (persisted) {
      MEMORY_CACHE.set(key, persisted);
      setState({ key, imageUrl: persisted, status: "ready" });
      return;
    }

    let active = true;
    setState({ key, imageUrl: null, status: "loading" });
    const fail = () => {
      if (active) setState({ key, imageUrl: null, status: "unavailable" });
    };
    try {
      // Era + genre context travels with the request so the server builds
      // the adaptive scene prompt (reggae wood / gothic candlelight / 80s
      // neon / jazz club) instead of one static aesthetic.
      void generateCardArtwork({
        data: { trackKey: key, artist, title, album, releaseYear, cardIndex },
      })
        .then((out) => {
          if (!active) return;
          if (out.image) {
            MEMORY_CACHE.set(key, out.image);
            writePersisted(key, out.image);
            setState({ key, imageUrl: out.image, status: "ready" });
          } else {
            setState({ key, imageUrl: null, status: "unavailable" });
          }
        })
        .catch(fail);
    } catch {
      fail();
    }

    return () => {
      active = false;
    };
  }, [key, artist, title, album, releaseYear, cardIndex]);

  // A song change renders the placeholder synchronously — never a stale
  // painting from the previous track while the new one generates.
  if (!song) return { imageUrl: null, status: "idle" };
  if (state.key !== key) return { imageUrl: null, status: "loading" };
  return { imageUrl: state.imageUrl, status: state.status };
}
