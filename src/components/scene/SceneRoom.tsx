/**
 * SceneRoom — the application's fixed global environment: a mood-lit room
 * whose backdrop image is currently driven by the song's mood. Canonical
 * resolver input (18 Eylül — STATE KARARLAR) is the INTERACTIVE composite
 * `Song {mood, genre, decade}` (the axes are not independent filters); code
 * today resolves only the mood axis, genre/decade declared inputs for the
 * Visual Resolver (Phase 4) — they never pick an image alone, only together
 * with mood (no fixed genre->mood mapping).
 *
 * Backdrop rendering — classic "blurred backdrop fill" (Spotify/Apple Music
 * style) so a landscape asset never looks cropped in the portrait room:
 *   - a SHARP `contain` layer shows the whole image, centered, never cropped;
 *   - a `cover` + heavy-blur fill layer behind it softly fills the whole
 *     container (blur ~28px + slight darkening + scale so blur edges stay
 *     covered), so the empty bands around the contain strip never look blank.
 *
 * The backdrop image is resolved from `song.mood` via moodBackdropUrl() (the
 * glob-resolver in `./moodBackdrop`). When the song has no mood yet, or the
 * mood's file is absent, a neutral default ("dreamy") is used so the room
 * never renders with an empty frame.
 */
import type { ReactNode } from "react";

import type { Mood } from "@/lib/ai/moodInference";

import { SCENE_PALETTES, type ScenePalette, type SceneThemeId } from "./scenePalettes";
import { moodBackdropSlug, moodBackdropUrl } from "./moodBackdrop";

export type { SceneThemeId } from "./scenePalettes";
export type { ScenePalette as SceneTheme } from "./scenePalettes";

/** Theme palette lookup kept for callers that still resolve colors. */
export const SCENE_THEMES = SCENE_PALETTES;

/**
 * Neutral fallback mood used whenever a song has no mood (or its backdrop file
 * is missing). "dreamy" is the least specific mood in MOOD_SET. When a real
 * per-song mood exists its own image is used instead.
 */
const FALLBACK_MOOD: Mood = "Dreamy";

/** Blur applied to the fill layer so it reads as soft ambiance, not a crop. */
const FILL_BLUR_PX = 28;

/**
 * The ambient library room. Children render over the desk zone; the backdrop
 * is the single visual standard (mood wallpapers, see moodBackdrop.ts).
 *
 * `mood` (optional): if a mood-specific wallpaper exists
 * (`src/assets/mood-backdrop-<mood>.png`) its IMAGE is shown; otherwise the
 * neutral `dreamy` image is used. Genre/decade are declared resolver inputs
 * (18 Eylül), not yet in code.
 */
export function SceneRoom({
  themeId,
  mood,
  children,
}: {
  themeId: SceneThemeId;
  mood?: Mood | string | null;
  children?: ReactNode;
}) {
  const theme = SCENE_PALETTES[themeId];
  const moodImage = moodBackdropUrl(mood ?? FALLBACK_MOOD);
  const slug = moodBackdropSlug(mood ?? FALLBACK_MOOD);
  return (
    <div
      data-testid={`scene-room-${themeId}`}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ background: `linear-gradient(to bottom, ${theme.wall[0]}, ${theme.wall[1]})` }}
    >
      {/* Blurred fill layer — covers fully, soft ambiance behind the sharp layer. */}
      <span
        aria-hidden
        data-testid={`scene-backdrop-${slug}`}
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${moodImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: `blur(${FILL_BLUR_PX}px)`,
          transform: "scale(1.2)",
        }}
      />
      {/* Slight darkening over the blur so the sharp layer reads clearly. */}
      <span aria-hidden className="absolute inset-0 bg-black/40" />
      {/* Sharp main layer — whole image visible, centered, never cropped. */}
            <span
              aria-hidden
              data-testid={`scene-backdrop-main-${slug}`}
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${moodImage})`,
                backgroundSize: "contain",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />
            {/* Center fade — softens the "two halves" seam under the card so the
                centered image doesn't read as two disconnected scenes. */}
            <span
              aria-hidden
              data-testid={`scene-backdrop-fade-${slug}`}
              className="absolute inset-0"
              style={{
                background: "radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, transparent 58%)",
              }}
            />
      {/* Ambient room light — the theme's personality over the texture. */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 14% 46%, ${theme.glow}2e 0%, transparent 52%)`,
          mixBlendMode: "screen",
        }}
      />
      {/* The card zone — children stand on the desk. */}
      <div className="pointer-events-auto absolute inset-0">{children}</div>
    </div>
  );
}
