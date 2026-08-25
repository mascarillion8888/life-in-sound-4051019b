/**
 * SceneRoom — the application's fixed global environment: a carved-wood
 * library interior (bookshelf backdrop, desk in the foreground, antique
 * lamp, small boxes) whose lighting and palette adapt to the music while
 * the furniture itself never moves (Sting Rule II).
 *
 * The room is pure CSS/DOM — deterministic, paintable in any theme, and
 * identical across the journey reveal and the results wall so the whole app
 * feels like one continuous room. The cards stand ON the desk; this module
 * only renders the environment behind them.
 */
import type { ReactNode } from "react";

export type SceneThemeId = "gothic" | "reggae" | "synth" | "jazz";

export type SceneTheme = {
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

export const SCENE_THEMES: Record<SceneThemeId, SceneTheme> = {
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
};

/** One row of book spines — deterministic, richly shaded volumes. */
function BookRow({ theme, seed }: { theme: SceneTheme; seed: number }) {
  const books = Array.from({ length: 14 }, (_, i) => {
    const color = theme.books[(i * 3 + seed) % theme.books.length];
    const h = 62 + ((i * 7 + seed * 13) % 26);
    const lean = (i * 5 + seed) % 11 === 0;
    const gilded = (i * 3 + seed) % 4 === 0;
    return { color, h, lean, gilded, i };
  });
  return (
    <span aria-hidden className="flex h-full items-end gap-[3%] px-[6%]">
      {books.map((b) => (
        <span
          key={b.i}
          className="block w-[4.5%] rounded-[1px]"
          style={{
            height: `${b.h}%`,
            background: `linear-gradient(to bottom, ${b.color}, #0c0906 90%)`,
            transform: b.lean ? "rotate(-4deg)" : undefined,
            transformOrigin: "bottom center",
            boxShadow: "inset 1px 0 0 rgba(255,235,190,0.12), inset -1px 0 0 rgba(0,0,0,0.4)",
          }}
        >
          {b.gilded ? (
            <span
              aria-hidden
              className="mx-[15%] mt-[18%] block h-[2px] rounded-full"
              style={{ background: "linear-gradient(to right, #c9a24a, #7a5e28)" }}
            />
          ) : null}
        </span>
      ))}
    </span>
  );
}

function Shelf({ theme, seed }: { theme: SceneTheme; seed: number }) {
  return (
    <span
      aria-hidden
      className="relative block h-full rounded-[2px]"
      style={{ background: theme.wood, boxShadow: "inset 0 0 26px rgba(0,0,0,0.55)" }}
    >
      {/* Carved pattern band across the shelf face — wood relief, not a line. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-[6%] h-[8%] opacity-40"
        style={{
          background: `repeating-linear-gradient(90deg, transparent 0 2.2rem, ${theme.glow}44 2.2rem 2.6rem)`,
        }}
      />
      <BookRow theme={theme} seed={seed} />
      {/* Shelf plank shadow. */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[10%]"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)" }}
      />
    </span>
  );
}

/** Antique lamp on the desk — the room's single warm light source. */
function DeskLamp({ theme }: { theme: SceneTheme }) {
  return (
    <span aria-hidden className="absolute bottom-[26%] left-[7%] block h-[30%] w-[10%]">
      {/* Light cone. */}
      <span
        aria-hidden
        className="absolute -inset-x-[140%] -top-[120%] bottom-0"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${theme.glow}33 0%, transparent 65%)`,
          mixBlendMode: "screen",
        }}
      />
      {/* Shade. */}
      <span
        aria-hidden
        className="absolute inset-x-[12%] top-0 h-[38%] rounded-b-[40%] rounded-t-sm"
        style={{
          background: `linear-gradient(to bottom, ${theme.glow}cc, ${theme.glow}44)`,
          boxShadow: `0 0 22px ${theme.glow}66`,
        }}
      />
      {/* Stem + base. */}
      <span
        aria-hidden
        className="absolute bottom-[8%] left-1/2 h-[52%] w-[7%] -translate-x-1/2 bg-black/70"
      />
      <span
        aria-hidden
        className="absolute bottom-0 left-1/2 h-[10%] w-[56%] -translate-x-1/2 rounded-full bg-black/75"
      />
    </span>
  );
}

/** Small boxes / artifacts sitting on the desk. */
function DeskBoxes({ theme }: { theme: SceneTheme }) {
  return (
    <span aria-hidden className="absolute bottom-[26%] right-[8%] flex items-end gap-[6%]">
      {[0, 1].map((i) => (
        <span
          key={i}
          className="block rounded-[2px]"
          style={{
            width: i === 0 ? "3.2rem" : "2.4rem",
            height: i === 0 ? "2.1rem" : "1.6rem",
            background: `linear-gradient(to bottom, ${theme.artifact}55, ${theme.wood})`,
            border: `1px solid ${theme.artifact}88`,
            boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
          }}
        />
      ))}
    </span>
  );
}

/**
 * The fixed library room. The desk occupies the bottom quarter; children
 * render ON the desk (the card zone).
 */
export function SceneRoom({ themeId, children }: { themeId: SceneThemeId; children?: ReactNode }) {
  const theme = SCENE_THEMES[themeId];
  return (
    <div
      data-testid={`scene-room-${themeId}`}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ background: `linear-gradient(to bottom, ${theme.wall[0]}, ${theme.wall[1]})` }}
    >
      {/* Bookshelf backdrop — two rows behind everything. */}
      <div aria-hidden className="absolute inset-x-0 top-[4%] h-[46%] px-[4%]">
        <div className="grid h-full grid-rows-2 gap-[3%]">
          <Shelf theme={theme} seed={1} />
          <Shelf theme={theme} seed={4} />
        </div>
        {/* Carved-wood frame around the shelf block. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-x-[1.5%] -inset-y-[4%] rounded-sm border-2"
          style={{ borderColor: theme.wood, boxShadow: "inset 0 0 30px rgba(0,0,0,0.6)" }}
        />
      </div>
      {/* Desk surface. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[26%]"
        style={{
          background: `linear-gradient(to bottom, ${theme.desk[0]}, ${theme.desk[1]})`,
          boxShadow: "inset 0 12px 24px rgba(0,0,0,0.45)",
        }}
      >
        {/* Desk front edge highlight. */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{
            background: `linear-gradient(to right, transparent, ${theme.glow}44, transparent)`,
          }}
        />
      </div>
      <DeskLamp theme={theme} />
      <DeskBoxes theme={theme} />
      {/* Ambient room light — the theme's personality. */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 18% 42%, ${theme.glow}26 0%, transparent 55%)`,
          mixBlendMode: "screen",
        }}
      />
      {/* The card zone — children stand on the desk. */}
      <div className="pointer-events-auto absolute inset-0">{children}</div>
    </div>
  );
}
