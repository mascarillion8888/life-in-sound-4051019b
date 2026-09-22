/**
 * Manual card-frame templates — optional decorative overlays for the journey
 * QuizCard (EraCardReveal), fully INDEPENDENT of the per-song generated
 * artwork (cardArtwork.server.ts) and of the SceneRoom backdrop system
 * (moodBackdrop / visualResolver / assetRegistry).
 *
 * V1 ships with NO registered template and NO uploaded asset: the overlay is
 * opt-in and off by default, so existing look/behavior is unchanged.
 *
 * To add a template later:
 *   1. drop a 1:1 PNG (transparent center, opaque frame) into
 *      `src/assets/card-templates/` — Vite's glob below picks it up with no
 *      import edits (missing files yield no entry, no build error);
 *   2. pass that filename directly to `QuizCard templateFile`, and/or add a
 *      `{ id, file }` row to `CARD_TEMPLATES` for named/mapped selection.
 * When `cardTemplateUrl` cannot resolve a file, callers render nothing.
 */

/** Vite glob — same mechanism as `moodBackdrop.ts` (missing files → no key). */
const CARD_TEMPLATE_URLS: Record<string, string> = import.meta.glob<string>(
  "../../assets/card-templates/*.png",
  { eager: true, import: "default", query: "?url" },
);

/** A registered, reusable card-frame template. */
export interface CardTemplateEntry {
  /** Stable logical id — the mapping key a scene/era resolver would use. */
  id: string;
  /** File under `src/assets/card-templates/`, e.g. "frame-gothic.png". */
  file: string;
}

/** Registered templates — EMPTY in v1 (opt-in; no asset committed yet). */
export const CARD_TEMPLATES: CardTemplateEntry[] = [];

/**
 * Resolve a template filename (e.g. "frame-gothic.png") to its asset URL.
 * Returns undefined when no matching uploaded file exists yet — callers
 * render nothing. `map` is injectable for tests (mirrors moodBackdrop).
 */
export function cardTemplateUrl(
  file: string | null | undefined,
  map: Record<string, string> = CARD_TEMPLATE_URLS,
): string | undefined {
  if (!file) return undefined;
  return Object.entries(map).find(([moduleKey]) => moduleKey.endsWith(file))?.[1];
}