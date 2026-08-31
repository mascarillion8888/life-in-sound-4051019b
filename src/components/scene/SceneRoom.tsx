import type { ReactNode } from "react";

import { SCENE_PALETTES, type SceneThemeId } from "./scenePalettes";

export type { SceneThemeId } from "./scenePalettes";
export type { ScenePalette as SceneTheme } from "./scenePalettes";

/** Theme palette lookup kept for callers that still resolve colors. */
export const SCENE_THEMES = SCENE_PALETTES;

/**
 * SceneRoom - the application fixed global environment.
 * Phase 0: the build-time procedural room backdrop PNG layer is disabled.
 * The environment is now a pure, deep black stage with the neutral gold/amber
 * chiaroscuro light wash derived from the theme palette (never a photo).
 */
export function SceneRoom({ themeId, children }: { themeId: SceneThemeId; children?: ReactNode }) {
  const theme = SCENE_PALETTES[themeId];
  const glow = theme.glow;
  return (
    <div
      data-testid={`scene-room-${themeId}`}
      className="pointer-events-none absolute inset-0 overflow-hidden bg-black"
      style={{ background: "#000000" }}
    >
      {/* Neutral gold/amber chiaroscuro wash - no procedural room photo. */}
      <span
        aria-hidden
        data-testid={`scene-backdrop-${themeId}`}
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 20%, ${glow}26 0%, transparent 55%)`,
          mixBlendMode: "screen",
        }}
      />
      {/* The card zone - children stand on the stage. */}
      <div className="pointer-events-auto absolute inset-0">{children}</div>
    </div>
  );
}
