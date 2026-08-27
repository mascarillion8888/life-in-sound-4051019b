/**
 * Gallery model — pure sort/filter logic for the Card Gallery.
 *
 * Kept component-free so the ordering rules are unit-testable without
 * rendering. All functions are non-mutating.
 */
import type { CardRow } from "@/lib/supabase/cards-remote";

export type GallerySort = "newest" | "oldest" | "era" | "age";
export type GalleryFilter = "all" | string; // a scene id, or "all"

export const SORTS: GallerySort[] = ["newest", "oldest", "era", "age"];

export function sortCards(cards: CardRow[], sort: GallerySort): CardRow[] {
  const copy = [...cards];
  switch (sort) {
    case "oldest":
      return copy.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "era":
      // Era year ascending; cards without an era sink to the end (stable).
      return copy.sort((a, b) => (a.eraYear ?? Infinity) - (b.eraYear ?? Infinity));
    case "age":
      return copy.sort((a, b) => (a.encounterAge ?? Infinity) - (b.encounterAge ?? Infinity));
    case "newest":
    default:
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export function filterCards(cards: CardRow[], filter: GalleryFilter): CardRow[] {
  if (filter === "all") return cards;
  return cards.filter((card) => card.scene === filter);
}

/** Scene ids present in the gallery, in first-appearance order. */
export function availableScenes(cards: CardRow[]): string[] {
  const seen = new Set<string>();
  for (const card of cards) seen.add(card.scene);
  return [...seen];
}

export function applyGalleryView(
  cards: CardRow[],
  sort: GallerySort,
  filter: GalleryFilter,
): CardRow[] {
  return sortCards(filterCards(cards, filter), sort);
}

/**
 * Add a cache-busting query param to a signed gallery image URL so a freshly
 * re-generated (HuggingFace) gothic painting is re-fetched instead of a stale
 * browser-cached frame. Signed Supabase URLs end in `…?token=…`, so we bump
 * the token unconditionally to keep the URL parseable and stable per call.
 */
export function bustImageUrl(imageUrl: string, version: number): string {
  try {
    const url = new URL(imageUrl);
    url.searchParams.set("v", String(version));
    return url.toString();
  } catch {
    // Non-URL (e.g. a placeholder path) — append a query param defensively.
    const separator = imageUrl.includes("?") ? "&" : "?";
    return `${imageUrl}${separator}v=${version}`;
  }
}

/** Version for a card's cached painting — re-signs a fresh URL per load. */
export function imageVersion(): number {
  return Date.now();
}
