/**
 * Scene palettes — the raw color vocabulary of the fixed library room.
 * React-free so both the component layer (`SceneRoom`) and the build-time
 * backdrop generator (`scripts/generate-room-backdrop.mjs`) can import it.
 */
export type SceneThemeId = "gothic" | "reggae" | "synth" | "jazz" | "soul" | "grunge" | "hiphop";

export type ScenePalette = {
  /** Back wall wash (behind the shelves). */
  wall: [string, string];
  /** Shelf frame color. */
  wood: string;
  /** Book spine palette (deterministically arranged). */
  books: string[];
  /** Desk surface gradient. */
  desk: [string, string];
  /** Lamp glow + accent light for the room. */
  glow: string;
  /** Small desk artifact tint (box / artifact accent). */
  artifact: string;
};

export const SCENE_PALETTES: Record<SceneThemeId, ScenePalette> = {
  gothic: {
    wall: ["#17110b", "#070503"],
    wood: "#241a10",
    books: ["#3a2c1a", "#4a3820", "#2c2014", "#52402a", "#342616"],
    desk: ["#2a1f12", "#120c06"],
    glow: "#d8a65a",
    artifact: "#8a6a3a",
  },
  reggae: {
    wall: ["#241a08", "#0e0a04"],
    wood: "#3a2a12",
    books: ["#5a4a1e", "#6b5a26", "#4a3c16", "#7a6a30", "#54441c"],
    desk: ["#3c2c14", "#1a1208"],
    glow: "#ffc766",
    artifact: "#2e7d4f",
  },
  synth: {
    wall: ["#140f22", "#070510"],
    wood: "#1d1830",
    books: ["#2c2450", "#3a2f66", "#241e42", "#443878", "#2e2658"],
    desk: ["#221a3a", "#0e0a1c"],
    glow: "#22d3ee",
    artifact: "#ff2fb3",
  },
  jazz: {
    wall: ["#171310", "#080605"],
    wood: "#2a2018",
    books: ["#40342a", "#4c3e30", "#362c22", "#584838", "#3e3226"],
    desk: ["#2e241a", "#140e08"],
    glow: "#d4b06a",
    artifact: "#a8863e",
  },
  soul: {
    wall: ["#1c1206", "#0a0602"],
    wood: "#3a2810",
    books: ["#6b4a1e", "#7a5a26", "#543c16", "#8a6a30", "#5f4a20"],
    desk: ["#3e2c12", "#1a1006"],
    glow: "#ffab52",
    artifact: "#c2342e",
  },
  grunge: {
    wall: ["#10130f", "#05070a"],
    wood: "#232a24",
    books: ["#2f3b33", "#3a4a3c", "#26312b", "#44533f", "#2c3630"],
    desk: ["#272d28", "#10130f"],
    glow: "#94a3b8",
    artifact: "#556b5d",
  },
  hiphop: {
    wall: ["#150d1c", "#070409"],
    wood: "#241431",
    books: ["#3a1e4c", "#46265a", "#2c1838", "#54306a", "#3e2646"],
    desk: ["#2a1a38", "#120a1a"],
    glow: "#a78bfa",
    artifact: "#d4af37",
  },
};

/** Convert "#rrggbb" to [r,g,b] 0-255; alpha 255. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
