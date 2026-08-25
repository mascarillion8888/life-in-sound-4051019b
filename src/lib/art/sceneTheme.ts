/**
 * Client-side scene resolution — the SAME vocabulary the server uses for
 * the AI painting brief (`cardArtwork.server.ts`). Kept as a tiny pure
 * mirror so DOM layers (room theme, card accents) resolve synchronously
 * without importing the server module into the client bundle.
 */
import type { Song } from "@/lib/song/types";
import type { SceneThemeId } from "@/components/scene/SceneRoom";

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
    id: "synth",
    keywords: [
      "synth",
      "electro",
      "techno",
      "house",
      "pop",
      "dance",
      "disco",
      "funk",
      "kraftwerk",
      "depeche",
      "wave",
      "neon",
    ],
  },
  { id: "jazz", keywords: ["jazz", "blues", "soul", "swing", "bebop", "motown"] },
  {
    id: "reggae",
    keywords: ["reggae", "dub", "ska", "dancehall", "marley", "rastafari", "tosh"],
  },
];

/** Word-ish boundary match — mirrors the server's keywordIn. */
function keywordIn(haystack: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
}

/**
 * Resolve the room theme for a song: genre keywords first, then the era
 * (only the 80s have their own visual identity); gothic is the default.
 * Mirrors `cardArtworkScene` (no user-preference channel on the client).
 */
export function sceneThemeFor(song: Song | null | undefined): SceneThemeId {
  const haystack = song ? `${song.title} ${song.artist} ${song.album ?? ""}`.toLowerCase() : "";
  if (haystack) {
    for (const { id, keywords } of SCENE_KEYWORDS) {
      if (keywords.some((k) => keywordIn(haystack, k))) return id;
    }
  }
  const year =
    song && typeof song.releaseYear === "number" && Number.isFinite(song.releaseYear)
      ? song.releaseYear
      : null;
  if (year !== null && year >= 1980 && year <= 1989) return "synth";
  return "gothic";
}
