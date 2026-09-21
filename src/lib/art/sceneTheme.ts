/**
 * Client-side scene resolution — the SAME vocabulary the server uses for
 * the AI painting brief (`cardArtwork.server.ts`). Kept as a tiny pure
 * mirror so DOM layers (room theme, card accents) resolve synchronously
 * without importing the server module into the client bundle.
 *
 * Dynamic atmosphere matrix: genre families resolve to a room family
 * (gothic / reggae / synth / jazz / soul / grunge / hiphop / acoustic)
 * and the era fallback is a single neutral default — a year alone no
 * longer guesses a genre (1960s had country/rock/soul, not just jazz).
 */
import type { Song } from "@/lib/song/types";
import type { SceneThemeId } from "@/components/scene/SceneRoom";

/**
 * Genre keyword families, checked in order — the first matching family
 * wins. In 2026-09 the former single "gothic" family (19 keywords spanning
 * 3 unrelated genres) was split: gothic now holds only dark/aggressive
 * (9), while the warm/roots + classical/chamber keywords moved into a new
 * "acoustic" family (10). Soul precedes jazz because "soul" is its own
 * room identity now; funk moved out of the synth family (70s warm, not
 * neon).
 */
export const SCENE_KEYWORDS: { id: SceneThemeId; keywords: string[] }[] = [
  {
    id: "gothic",
    keywords: [
      "goth",
      "doom",
      "metal",
      "thrash",
      "slayer",
      "sabbath",
      "priest",
      "maiden",
      "punk",
    ],
  },
  {
    id: "hiphop",
    keywords: [
      "rap",
      "hiphop",
      "hip hop",
      "boombap",
      "gangsta",
      "trap",
      "eminem",
      "tupac",
      "biggie",
      "kendrick",
      "drake",
      "nas",
      "jay z",
      "wu tang",
      "outkast",
    ],
  },
  {
    id: "grunge",
    keywords: [
      "grunge",
      "nirvana",
      "soundgarden",
      "shoegaze",
      "britpop",
      "mudhoney",
      "pumpkins",
      "radiohead",
      "oasis",
      "alternative",
    ],
  },
  {
    id: "soul",
    keywords: [
      "soul",
      "funk",
      "motown",
      "stax",
      "rnb",
      "rhythm and blues",
      "aretha",
      "supremes",
      "temptations",
      "otis",
      "wonder",
    ],
  },
  { id: "jazz", keywords: ["jazz", "blues", "swing", "bebop", "lounge", "crooner"] },
  {
    id: "reggae",
    keywords: ["reggae", "dub", "ska", "dancehall", "marley", "rastafari", "tosh"],
  },
  {
    id: "synth",
    keywords: [
      "synth",
      "electro",
      "techno",
      "house",
      "pop",
      "dance",
      "disco",
      "kraftwerk",
      "depeche",
      "wave",
      "neon",
      "edm",
      "eurodance",
    ],
  },
  {
    id: "acoustic",
    keywords: [
      "acoustic",
      "country",
      "americana",
      "bluegrass",
      "folk",
      "classical",
      "orchestra",
      "piano",
      "symphony",
      "sonata",
    ],
  },
];

/** Word-ish boundary match — mirrors the server's keywordIn. */
export function keywordIn(haystack: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
}

/**
 * Era fallback for a song with no genre keyword signal. Neutralized
 * 2026-09 (same change as `decadeTheme` in the resolver): a release year
 * no longer guesses a genre family, because genre is not a function of
 * decade. One neutral default id (gothic) is returned regardless of year;
 * the old "year → jazz/soul/synth/grunge/hiphop" ladder was removed.
 */
export function eraThemeFor(_releaseYear: number | null): SceneThemeId {
  return "gothic";
}

function releaseYearOf(song: Song | null | undefined): number | null {
  const year = song?.releaseYear;
  return typeof year === "number" && Number.isFinite(year) ? year : null;
}

/**
 * Resolve the room theme for a song: genre keywords first (strongest
 * atmospheric signal), then the neutral era fallback (gothic). No year
 * guess, no fabricated culture. Mirrors `cardArtworkScene` on the server
 * (minus the preference channel).
 */
export function sceneThemeFor(song: Song | null | undefined): SceneThemeId {
  const haystack = song ? `${song.title} ${song.artist} ${song.album ?? ""}`.toLowerCase() : "";
  if (haystack) {
    for (const { id, keywords } of SCENE_KEYWORDS) {
      if (keywords.some((k) => keywordIn(haystack, k))) return id;
    }
  }
  return eraThemeFor(releaseYearOf(song));
}
