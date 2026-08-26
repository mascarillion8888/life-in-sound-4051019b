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
