/**
 * SceneRoom — the application's fixed global environment: a mood-lit room
 * whose backdrop image is driven PURELY by the song's mood (Anal_mimari: mood
 * is an independent axis, never a fixed genre->mood mapping).
 *
 * The backdrop IMAGE is resolved from `song.mood` via moodBackdropUrl()
 * (the glob-resolver in `./moodBackdrop`). When the song has no mood yet, or
 * the mood's file is absent, a neutral default ("dreamy") is used so the room
 * never renders with an empty frame. Genre does NOT choose the image — it may
 * only surface as UI text outside this component. The optional theme palette
 * only tints the base wall wash behind the image (identity, not selection).
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

/**
 * The ambient library room. Children render over the desk zone; the backdrop
 * image is the single visual standard (mood wallpapers, see moodBackdrop.ts).
 *
 * `mood` (optional): if a mood-specific wallpaper exists
 * (`src/assets/mood-backdrop-<mood>.png`) its IMAGE is shown; otherwise the
 * neutral `dreamy` image is used. Genre is intentionally never used here to
 * pick the backdrop.
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
  return (
    <div
      data-testid={`scene-room-${themeId}`}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ background: `linear-gradient(to bottom, ${theme.wall[0]}, ${theme.wall[1]})` }}
    >
      {/* Mood wallpaper — the sole visual backdrop standard (genre not used). */}
      <span
        aria-hidden
        data-testid={`scene-backdrop-${moodBackdropSlug(mood ?? FALLBACK_MOOD)}`}
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${moodImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
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