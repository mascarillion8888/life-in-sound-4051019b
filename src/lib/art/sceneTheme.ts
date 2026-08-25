/**
 * Client-side scene resolution — the SAME vocabulary the server uses for
 * the AI painting brief (`cardArtwork.server.ts`). Kept as a tiny pure
 * mirror so DOM layers (room theme, card accents) resolve synchronously
 * without importing the server module into the client bundle.
 *
 * Dynamic atmosphere matrix: genre families resolve to a room family
 * (soul / grunge / hiphop / synth / jazz / reggae / gothic) and the
 * decade ladder breaks ties when no genre signal exists — a '70s
 * childhood becomes a soul-vinyl time capsule, a '90s adolescence a
 * grunge room, a contemporary era a plum-gold studio glow.
 */
import type { Song } from "@/lib/song/types";
import type { SceneThemeId } from "@/components/scene/SceneRoom";

/**
 * Genre keyword families, checked in order — the first matching family
 * wins. Soul precedes jazz because "soul" is its own room identity now;
 * funk moved out of the synth family (70s warm, not neon).
 */
const SCENE_KEYWORDS: { id: SceneThemeId; keywords: string[] }[] = [
  {
    id: "gothic",
    keywords: [
      "goth",
      "doom",
      "folk",
      "metal",
      "thrash",
      "slayer",
      "sabbath",
      "priest",
      "maiden",
      "punk",
      "acoustic",
      "country",
      "americana",
      "bluegrass",
      "classical",
      "orchestra",
      "piano",
      "symphony",
      "sonata",
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
];

/** Word-ish boundary match — mirrors the server's keywordIn. */
function keywordIn(haystack: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
}

/**
 * Decade ladder — the tiebreaker when no genre signal exists. Every
 * bucket now carries its own visual identity (previously only the 80s
 * did); null year keeps the gothic fine-art base rather than fabricating
 * a culture the song never declared.
 */
export function eraThemeFor(releaseYear: number | null): SceneThemeId {
  if (releaseYear === null) return "gothic";
  if (releaseYear <= 1969) return "jazz";
  if (releaseYear <= 1979) return "soul";
  if (releaseYear <= 1989) return "synth";
  if (releaseYear <= 1999) return "grunge";
  return "hiphop";
}

function releaseYearOf(song: Song | null | undefined): number | null {
  const year = song?.releaseYear;
  return typeof year === "number" && Number.isFinite(year) ? year : null;
}

/**
 * Resolve the room theme for a song: genre keywords first (strongest
 * atmospheric signal), then the decade ladder; gothic is the null-default.
 * Mirrors `cardArtworkScene` on the server (minus the preference channel).
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
