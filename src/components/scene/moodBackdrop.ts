/**
 * Mood-backdrop selection — places the 9 mood wallpapers into SceneRoom.
 *
 * PLACEHOLDER SKELETON (2026-09-16): the actual image files do NOT exist yet.
 * The user is generating 9 mood visuals with ChatGPT (MOOD_SET: Energetic,
 * Euphoric, Playful, Romantic, Melancholic, Dreamy, Nostalgic, Dark, World)
 * to arrive as `src/assets/mood-backdrop-{mood}.png` (lowercase).
 *
 * CRITICAL — missing-file safety: this module uses Vite `import.meta.glob` (NOT a
 * plain static `import ... from`). With plain static imports Vite FAILS the build
 * with "Failed to resolve import" if the file is missing. With glob, a glob that
 * matches NO files simply yields NO keys — no build/dev error, and the caller
 * (SceneRoom) falls back to the existing genre-themed backdrop. Real files dropped
 * into src/assets are picked up automatically with NO further import edits.
 *
 * Design decision (2b, from the approved plan): mood selects the BACKDROP IMAGE,
 * replacing the genre/decade choice for that layer. Genre still drives palette
 * (ScenePalette) — visual identity preserved; missing mood file keeps the genre
 * backdrop, so nothing regresses while files are still arriving.
 */
import type { Mood } from "@/lib/ai/moodInference";

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
 * does not exist (yet). `undefined` → SceneRoom keeps its genre backdrop.
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