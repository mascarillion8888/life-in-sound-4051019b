/**
 * Bidirectional adapter — GroundedLifeStory/EmotionalTimeline ↔ CardRow.
 * All mapping is pure; the UI layers use the PhotoPrimaryShape of CardRow's
 * `scene` to pass stage/vibe/intensity/imageUrl across the shared wire without
 * losing the grounded metadata.
 */
import type { StoryChapter } from "@/types/lifeStory";
import type { EmotionalNode } from "@/types/emotionalTimeline";
import type { GalleryCardData } from "@/types/gallery";
import { mapChapterToGalleryCard } from "@/types/gallery";
import type { CardRow } from "@/lib/supabase/cards-remote";

type GroundedSource =
  StoryChapter | (StoryChapter & { timelineNode?: EmotionalNode }) | GalleryCardData;

/**
 * Grounded life-story chapter (+ optional emotional node) → Supabase CardRow.
 * The stage/vibe/intensity triple is packed into `scene` as
 * `<stage>|<vibe>|<intensity>`; the image URL falls back to the
 * developer-provided value or `imagePath`.
 */
export function mapGroundedToCardRow(
  chapter: GroundedSource,
  node?: EmotionalNode,
  imageUrl?: string,
): CardRow {
  const grounded =
    "dynamicLoreText" in chapter
      ? (chapter as GalleryCardData)
      : mapChapterToGalleryCard(chapter, node, imageUrl);
  const n = node ?? ("timelineNode" in chapter ? chapter.timelineNode : undefined);
  const trackKey =
    `${grounded.artistName} — ${grounded.songTitle}`.toLowerCase().replace(/\s+/g, " ").trim() ||
    "unknown";
  return {
    id: grounded.id,
    trackKey,
    title: grounded.songTitle,
    artist: grounded.artistName,
    genre: null,
    releaseYear: typeof grounded.releaseYear === "number" ? grounded.releaseYear : null,
    birthYear: null,
    encounterAge: null,
    eraYear: typeof grounded.releaseYear === "number" ? grounded.releaseYear : null,
    userMemory: null,
    scene: n ? `${grounded.stageName}|${n.vibeLabel}|${n.intensity}` : grounded.stageName,
    lore: grounded.dynamicLoreText,
    imagePath: null,
    createdAt: grounded.createdAt,
    imageUrl: imageUrl || grounded.imageUrl || null,
  };
}

/**
 * Supabase CardRow → GroundedLifeStory StoryChapter (restore lore + stage).
 * `stageName` recovers from the packed `scene` field when present.
 */
export function mapCardRowToGrounded(row: CardRow): StoryChapter {
  const parts = row.scene.split("|");
  const stageName = parts.length > 1 ? parts[0] : row.scene;
  const narrative =
    row.lore ??
    `During the ${stageName || "unknown"} phase, "${row.title}" by ${row.artist} became the soundtrack of choice.`;
  return {
    stageName: stageName || "Unknown",
    songTitle: row.title,
    artistName: row.artist,
    releaseYear: row.releaseYear ?? "Unknown Year",
    narrative,
  };
}
