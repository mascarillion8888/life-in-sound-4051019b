/**
 * Era Theme v0 — pure decade→palette mapping.
 *
 * Grounded in real data ONLY: song.releaseYear (Song type, may be null).
 * No genre, no emotion, no mock data, no network, no Song-type changes.
 *
 * Contract:
 *  - "timeless" theme has EMPTY overlayClasses: applying it must produce
 *    ZERO visual change (regression guard for missing year data).
 *  - All classes are complete literal Tailwind strings (never built by
 *    concatenation) so the JIT compiler can see them.
 *  - Consumers mount the overlay as an aria-hidden absolute layer; existing
 *    component classes are never overridden.
 */
export type EraThemeId =
  "1950s" | "1960s" | "1970s" | "1980s" | "1990s" | "2000s" | "2010s" | "2020s" | "timeless";

export interface EraTheme {
  id: EraThemeId;
  label: string;
  years: string;
  /** Full literal classes for an aria-hidden overlay div. */
  overlayClasses: string;
  /** Hex accent — reserved for future badge/progress use. Not applied in v0. */
  accent: string;
}

const TIMELESS: EraTheme = {
  id: "timeless",
  label: "Timeless",
  years: "",
  overlayClasses: "",
  accent: "#8b5cf6",
};

export const ERAS: EraTheme[] = [
  {
    id: "1950s",
    label: "Vinyl & Chrome",
    years: "1950-1959",
    accent: "#c9a227",
    overlayClasses:
      "pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-amber-900/30 via-transparent to-yellow-700/20",
  },
  {
    id: "1960s",
    label: "Psychedelia",
    years: "1960-1969",
    accent: "#e26d5c",
    overlayClasses:
      "pointer-events-none absolute inset-0 -z-10 bg-gradient-to-tr from-orange-800/25 via-transparent to-purple-700/20",
  },
  {
    id: "1970s",
    label: "Analog Soul",
    years: "1970-1979",
    accent: "#e07b39",
    overlayClasses:
      "pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-orange-900/30 via-transparent to-amber-600/20",
  },
  {
    id: "1980s",
    label: "Neon Youth",
    years: "1980-1989",
    accent: "#ff3ec8",
    overlayClasses:
      "pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-fuchsia-600/25 via-purple-800/15 to-cyan-500/20",
  },
  {
    id: "1990s",
    label: "Grunge Static",
    years: "1990-1999",
    accent: "#4ade80",
    overlayClasses:
      "pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-emerald-900/30 via-transparent to-lime-700/15",
  },
  {
    id: "2000s",
    label: "Y2K Chrome",
    years: "2000-2009",
    accent: "#60a5fa",
    overlayClasses:
      "pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-blue-900/30 via-transparent to-sky-600/20",
  },
  {
    id: "2010s",
    label: "Minimal Pulse",
    years: "2010-2019",
    accent: "#22d3ee",
    overlayClasses:
      "pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-cyan-900/25 via-transparent to-teal-600/15",
  },
  {
    id: "2020s",
    label: "Soft Future",
    years: "2020-now",
    accent: "#a78bfa",
    overlayClasses:
      "pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-violet-900/25 via-transparent to-fuchsia-700/15",
  },
];

export function eraThemeForYear(year: number | null | undefined): EraTheme {
  if (typeof year !== "number" || !Number.isFinite(year)) return TIMELESS;
  if (year < 1950) return TIMELESS;
  const decade = Math.min(Math.floor(year / 10) * 10, 2020);
  return ERAS.find((e) => e.id === `${decade}s`) ?? TIMELESS;
}
