/**
 * Mood-backdrop selection — places the 9 mood wallpapers into SceneRoom.
 *
 * Background standard (since 2026-09-17): the 9 mood visuals ship as
 * `src/assets/mood-backdrop-{slug}.png` (1920x1080) and are the SINGLE
 * visual backdrop for the room. SceneRoom resolves its image purely from
 * `song.mood`; a missing mood falls back to the neutral "dreamy" wallpaper
 * inside SceneRoom.
 *
 * Canonical resolver input (18 Eylül 2026 — STATE KARARLAR): the visual
 * decision input is NOT a single axis — it is the interactive composite
 * `Song {mood, genre, decade}`. The three axes are NOT independent filters;
 * they interact to form a composite visual identity (same mood with a different
 * genre/decade must be able to produce a different visual). Today only the
 * `mood` axis is implemented in CODE (this module); genre/decade are declared
 * input axes whose multi-axis resolution arrives with the Visual Resolver
 * (Phase 4). Genre or decade ALONE never pick an image — only together with
 * mood. Missing axes degrade deterministically to available data (never
 * fabricate, ANA_YASA §0).
 *
 * Missing-file safety: this module uses Vite `import.meta.glob` (NOT a plain
 * static `import ... from`). A glob that matches NO files yields NO keys (no
 * build/dev error); real files dropped into src/assets are picked up
 * automatically with NO further import edits.
 */
import type { Mood } from "@/lib/ai/moodInference";

/*
 * Canonical visual contract (FAZ 3, 18 Eylül 2026) lives in `src/types/visualSpec.ts`.
 * `SceneVisualSpecInput` / `SceneVisualResolution` / `SceneVisualSpec` are re-exported from there so any
 * existing consumer keeps resolving — the resolution logic is `src/lib/visual/visualResolver.ts`.
 * `moodBackdropUrl` below remains the pure mood→glob helper it always was.
 *
 * Canonical input (18 Eylül 2026 — STATE KARARLAR): the resolver decision is driven by the
 * INTERACTIVE composite `Song {mood, genre, decade}` — the three axes are not independent
 * filters. Today only `mood` is consumed by `moodBackdropUrl` in code; genre/decade are input
 * axes whose multi-axis resolution arrives with the Visual Resolver. Genre or decade ALONE
 * never pick an image — only together with mood (no fixed genre->mood mapping).
 */
export type {
  VisualAxisSource,
  SceneVisualResolution,
  SceneVisualSpec,
  SceneVisualSpecInput,
} from "@/types/visualSpec";

/**
 * The 9 moods, lowercase file slug, same values/order as MOOD_SET. Backdrop files
 * are `mood-backdrop-<slug>.png` (e.g. `mood-backdrop-energetic.png`).
 */
export const MOOD_BACKDROP_SLUGS = [
  "energetic",
  "euphoric",
  "playful",
  "romantic",
  "melancholic",
  "dreamy",
  "nostalgic",
  "dark",
  "world",
] as const;

/** File slug for a mood — lowercased so "Energetic" → "energetic". */
export function moodBackdropSlug(mood: Mood | string): string {
  return mood.toLowerCase();
}

/** The filename portion, e.g. "mood-backdrop-energetic.png". */
export function moodBackdropFilename(mood: Mood | string): string {
  return `mood-backdrop-${moodBackdropSlug(mood)}.png`;
}

/** The module key portion, e.g. "/src/assets/mood-backdrop-energetic.png". */
export function moodBackdropKey(mood: Mood | string): string {
  return `/src/assets/mood-backdrop-${moodBackdropSlug(mood)}.png`;
}

/**
 * Vite build-time glob: `../../assets/mood-backdrop-*.png` → resolved URL via
 * `?url`. Files that do not exist yet yield NO entry (no build error). When the
 * user drops the 9 files, they appear here automatically.
 *
 * We deliberately do NOT key-match on a constructed path: Vite's glob key
 * normalization (alias vs relative, leading `/src/` vs `../../`) is not stable to
 * reason about, so we match by the module key ending with the exact filename.
 */
const MOOD_BACKDROP_URLS: Record<string, string> = import.meta.glob<string>(
  "../../assets/mood-backdrop-*.png",
  { eager: true, import: "default", query: "?url" },
);

/**
 * Return the resolved backdrop URL for a mood, or `undefined` if that mood's file
 * does not exist (yet). `undefined` → SceneRoom keeps its fallback (dreamy).
 */
export function moodBackdropUrl(
  mood: Mood | string | null | undefined,
  map: Record<string, string> = MOOD_BACKDROP_URLS,
): string | undefined {
  if (!mood) return undefined;
  const filename = moodBackdropFilename(mood);
  const entry = Object.entries(map).find(([moduleKey]) =>
    moduleKey.endsWith(filename),
  );
  return entry ? entry[1] : undefined;
}