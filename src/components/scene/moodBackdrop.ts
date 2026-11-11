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

/** The filename portion, e.g. "mood-backdrop-energetic.jpg". */
export function moodBackdropFilename(mood: Mood | string): string {
  return `mood-backdrop-${moodBackdropSlug(mood)}.jpg`;
}

/**
 * Genre-agnostic neutral mood-wall source folder. Reached only when a song's
 * genre has NO registered backdrop (e.g. an unknown genre) or when the
 * decade-aware registry resolves nothing. A REAL pop-class mood asset is shown,
 * never an invented/generated image (ANA_YASA §0). Genre-specific + decade
 * selection is the Asset Registry's job (`SCENE_ASSET_REGISTRY` /
 * `backdropRegistry`); this module only supplies the neutral mood wall.
 */
export const NEUTRAL_BACKDROP_GENRE = "pop" as const;

/**
 * Neutral fallback candidate (most specific first) as `<folder>/mood-backdrop-
 * <mood>.jpg`. The genre+decade axes are resolved by the decade-aware backdrop
 * registry (`backdropRegistry.resolveBackdrop`), so this genre-agnostic fallback
 * always points at the neutral mood wall (NEUTRAL_BACKDROP_GENRE) and the
 * `_genre`/`_decade` parameters are retained only for call compatibility.
 */
export function backdropCandidates(
  mood: Mood | string,
  _genre?: string | null,
  _decade?: string | null,
): string[] {
  const m = moodBackdropSlug(mood);
  return [`${NEUTRAL_BACKDROP_GENRE}/mood-backdrop-${m}.jpg`];
}

/** The module key portion for the neutral mood wall, e.g. "/src/assets/pop/mood-backdrop-dreamy.jpg". */
export function moodBackdropKey(mood: Mood | string): string {
  return `/src/assets/${NEUTRAL_BACKDROP_GENRE}/mood-backdrop-${moodBackdropSlug(mood)}.jpg`;
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
/**
 * Vite build-time glob: the four genre folders' mood walls,
 * `assets/<folder>/mood-backdrop-<mood>.jpg` (pop/punk/rock/soul) → resolved URL
 * via `?url`. The single-level `*` matches any one folder so each genre's 9 mood
 * walls are included. Files that don't exist yield NO entry (no build error).
 * Exact-match registry `assetRef`s (`<folder>/mood-backdrop-<mood>.jpg`) are
 * resolved here via `moodBackdropUrlByFilename`.
 */
const MOOD_BACKDROP_URLS: Record<string, string> = import.meta.glob<string>(
  ["../../assets/*/mood-backdrop-*.jpg"],
  { eager: true, import: "default", query: "?url" },
);

/**
 * Return the resolved URL of the NEUTRAL (pop) mood wall for a mood, or
 * `undefined` if no such file exists. `undefined` → SceneRoom keeps its own
 * neutral fallback.
 *
 * This is the genre-agnostic last resort only: genre- and decade-aware selection
 * lives in `backdropRegistry.resolveBackdrop`. `genre`/`decade` are accepted for
 * call compatibility but no longer shape the filename (see `backdropCandidates`).
 */
export function moodBackdropUrl(
  mood: Mood | string | null | undefined,
  genre?: string | null,
  decade?: string | null,
  map: Record<string, string> = MOOD_BACKDROP_URLS,
): string | undefined {
  if (!mood) return undefined;
  const entries = Object.entries(map);
  for (const filename of backdropCandidates(mood, genre, decade)) {
    const entry = entries.find(([moduleKey]) => moduleKey.endsWith(filename));
    if (entry) return entry[1];
  }
  return undefined;
}

/**
 * Resolve a bare backdrop filename (e.g. "mood-backdrop-energetic.png") to its
 * URL via the same glob map used by `moodBackdropUrl`. This is the bridge the
 * exact-match Asset Registry (FAZ 3.1) uses: `SceneAssetEntry.assetRef` is a
 * bare filename, not a URL — the registry points at one of the
 * `mood-backdrop-*.png` files and this helper turns that name into the actual
 * asset URL. Returns `undefined` when the glob has no file ending with that
 * name (not baked yet / out of the glob pattern).
 */
export function moodBackdropUrlByFilename(
  filename: string | null | undefined,
  map: Record<string, string> = MOOD_BACKDROP_URLS,
): string | undefined {
  if (!filename) return undefined;
  return Object.entries(map).find(([moduleKey]) => moduleKey.endsWith(filename))?.[1];
}
