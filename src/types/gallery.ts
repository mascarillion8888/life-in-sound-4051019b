import type { StoryChapter } from "./lifeStory";
import type { EmotionalNode } from "./emotionalTimeline";

export interface GalleryCardData {
  id: string;
  stageName: string;
  songTitle: string;
  artistName: string;
  releaseYear: string | number;
  imageUrl: string;
  dynamicLoreText: string;
  intensityScore: number;
  vibeLabel: string;
  isGrounded: boolean;
  createdAt: string;
}

/**
 * Grounded StoryChapter + EmotionalNode -> GalleryCardData dönüştürücü.
 * Saf map func — UI katmanı bunu alıp CardRow'a uyarlar.
 */
export function mapChapterToGalleryCard(
  chapter: StoryChapter,
  node?: EmotionalNode,
  imageUrl?: string,
): GalleryCardData {
  return {
    id: `card-${chapter.stageName.toLowerCase().replace(/\s+/g, "-")}`,
    stageName: chapter.stageName,
    songTitle: chapter.songTitle,
    artistName: chapter.artistName,
    releaseYear: chapter.releaseYear,
    imageUrl: imageUrl || "/assets/default-woodcut-placeholder.jpg",
    dynamicLoreText: chapter.narrative,
    intensityScore: node ? node.intensity : 8,
    vibeLabel: node ? node.vibeLabel : "Grounded Reflection",
    isGrounded: true,
    createdAt: new Date().toISOString(),
  };
}
