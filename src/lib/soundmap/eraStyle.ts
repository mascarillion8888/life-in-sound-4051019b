/**
 * Era-Adaptive Style Engine — deterministic per-card art direction.
 *
 * Resolves how one life-era card presents its song artwork: the contextual
 * mount (vinyl sleeve / cassette on a desk / vintage poster / framed wall
 * portrait), the scene palette (backdrop, accent, ambient light) and the
 * color grading applied to the artwork itself.
 *
 * Signals, in priority order:
 *   1. Release year (Song.releaseYear, supplied by the provider) → decade
 *      determines the mount and the base palette — a 70s song lives on a
 *      vinyl sleeve, an 80s song on a cassette J-card, a 90s song on an
 *      aged poster, a 2000s+ song in a gallery frame.
 *   2. Genre keywords (title/artist/album text) → accent color override
 *      (metal reads crimson, jazz brass, synth cyan, pop pink, folk moss).
 *   3. No release year → the card's journey position stands in for the
 *      user's age during that era (childhood → parents' vinyl, teens →
 *      cassette, twenties → poster, later years → framed portrait).
 *
 * Artist origin/culture is NOT inferred: no provider supplies it and the
 * product never fabricates facts about real artists. Era and genre are the
 * only cultural signals used.
 *
 * Pure and I/O-free — safe for tests, DOM and canvas callers.
 */

import { harmonizeFilter } from "./artworkHarmonize";
import type { Song } from "@/lib/song/types";

/** How the artwork is embedded into the card scene. */
export type EraMountStyle = "vinyl-sleeve" | "cassette-desk" | "vintage-poster" | "framed-portrait";

export type EraPalette = {
  /** Scene accent — frame edges, glows, spool/label details. */
  accent: string;
  /** Backdrop gradient [top, bottom] — the "room" the object lives in. */
  backdrop: [string, string];
  /** Ambient light wash (screen-blend overlay) for scene lighting. */
  light: string;
};

export type EraStyle = {
  mount: EraMountStyle;
  /** 4-digit decade bucket (1970, 1980, …) or null when unknown. */
  decade: number | null;
  /** Short era chip, e.g. "'80s" — null when the release year is unknown. */
  eraLabel: string | null;
  palette: EraPalette;
  /** CSS color grading for the artwork (era-tuned harmonize recipe). */
  grading: string;
};

/* -------------------------------------------------------------------------- */
/* Decade table                                                                */
/* -------------------------------------------------------------------------- */

type DecadeSpec = {
  mount: EraMountStyle;
  palette: EraPalette;
  grading: string;
};

const DECADE_SPECS: { maxYear: number; spec: DecadeSpec }[] = [
  {
    // 1979 and earlier — warm 70s listening room, vinyl culture.
    maxYear: 1979,
    spec: {
      mount: "vinyl-sleeve",
      palette: {
        accent: "#d4a35a",
        backdrop: ["#241a10", "#0e0a06"],
        light: "#ffca7a",
      },
      grading: "sepia(0.6) contrast(1.14) brightness(0.88) saturate(0.72) hue-rotate(-6deg)",
    },
  },
  {
    // 1980s — neon synthwave desk, cassette J-card.
    maxYear: 1989,
    spec: {
      mount: "cassette-desk",
      palette: {
        accent: "#ff2fb3",
        backdrop: ["#1a0f24", "#0a0612"],
        light: "#22d3ee",
      },
      grading: "sepia(0.28) contrast(1.2) brightness(0.92) saturate(1.05) hue-rotate(-8deg)",
    },
  },
  {
    // 1990s — aged gig poster on a bedroom wall, grunge paper.
    maxYear: 1999,
    spec: {
      mount: "vintage-poster",
      palette: {
        accent: "#8a9a5b",
        backdrop: ["#1c1a16", "#0d0c0a"],
        light: "#e8dcc0",
      },
      grading: "sepia(0.45) contrast(1.16) brightness(0.9) saturate(0.66) hue-rotate(-4deg)",
    },
  },
  {
    // 2000s and later — modern gallery frame, cool light.
    maxYear: 9999,
    spec: {
      mount: "framed-portrait",
      palette: {
        accent: "#a7b0c0",
        backdrop: ["#14161c", "#0a0b0f"],
        light: "#dfe8ff",
      },
      grading: "sepia(0.22) contrast(1.1) brightness(0.95) saturate(0.88) hue-rotate(-3deg)",
    },
  },
];

/**
 * Mount fallback by journey position when the release year is unknown —
 * the user's likely age during that life era picks the medium: childhood
 * hears the parents' vinyl, teens dub cassettes, twenties pin posters,
 * later years frame portraits.
 */
const MOUNT_BY_CARD_INDEX: EraMountStyle[] = [
  "vinyl-sleeve",
  "vinyl-sleeve",
  "cassette-desk",
  "cassette-desk",
  "vintage-poster",
  "vintage-poster",
  "framed-portrait",
  "framed-portrait",
];

/** Neutral fallback palette/grading (dark bronze, the base harmonize recipe). */
const FALLBACK_SPEC: DecadeSpec = {
  mount: "framed-portrait",
  palette: {
    accent: "#d4b06a",
    backdrop: ["#1c1812", "#0b0a08"],
    light: "#e8d5a8",
  },
  grading: harmonizeFilter(),
};

/* -------------------------------------------------------------------------- */
/* Genre accent overrides                                                      */
/* -------------------------------------------------------------------------- */

const GENRE_ACCENTS: { keywords: string[]; accent: string }[] = [
  {
    keywords: ["metal", "goth", "doom", "thrash", "slayer", "sabbath", "priest", "maiden", "punk"],
    accent: "#b3122e",
  },
  {
    keywords: ["jazz", "blues", "soul", "swing", "bebop"],
    accent: "#d4b06a",
  },
  {
    keywords: ["synth", "electro", "techno", "house", "kraftwerk", "depeche"],
    accent: "#22d3ee",
  },
  {
    keywords: ["pop", "dance", "disco", "funk"],
    accent: "#ff5fa2",
  },
  {
    keywords: ["folk", "acoustic", "country", "americana", "bluegrass"],
    accent: "#7fa36b",
  },
  {
    keywords: ["classical", "orchestra", "piano", "symphony", "sonata"],
    accent: "#e8dcc0",
  },
];

/** First matching genre accent wins; null when no genre signal exists. */
export function genreAccent(text: string): string | null {
  const haystack = text.toLowerCase();
  for (const { keywords, accent } of GENRE_ACCENTS) {
    if (keywords.some((k) => haystack.includes(k))) return accent;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Resolver                                                                    */
/* -------------------------------------------------------------------------- */

function decadeSpec(year: number): { decade: number; spec: DecadeSpec } {
  const decade = Math.floor(year / 10) * 10;
  const found =
    DECADE_SPECS.find((d) => year <= d.maxYear) ?? DECADE_SPECS[DECADE_SPECS.length - 1];
  return { decade, spec: found.spec };
}

/**
 * Resolve the era-adaptive style for one card. Deterministic: the same
 * (song, cardIndex) pair always yields the same scene.
 */
export function eraStyleFor(song: Song | null | undefined, cardIndex: number): EraStyle {
  const year =
    song && typeof song.releaseYear === "number" && Number.isFinite(song.releaseYear)
      ? song.releaseYear
      : null;

  const base = year !== null ? decadeSpec(year) : null;
  const spec = base?.spec ?? FALLBACK_SPEC;
  const mount = base ? spec.mount : (MOUNT_BY_CARD_INDEX[cardIndex] ?? FALLBACK_SPEC.mount);

  const genreText = song ? `${song.title} ${song.artist} ${song.album ?? ""}` : "";
  const accent = genreAccent(genreText) ?? spec.palette.accent;

  return {
    mount,
    decade: base?.decade ?? null,
    eraLabel: base ? `'${String(base.decade % 100).padStart(2, "0")}s` : null,
    palette: { ...spec.palette, accent },
    grading: spec.grading,
  };
}
