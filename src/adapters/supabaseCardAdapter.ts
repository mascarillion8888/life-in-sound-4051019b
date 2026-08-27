/**
 * Bidirectional adapter — GroundedLifeStory/EmotionalTimeline ↔ CardRow.
 * All mapping is pure; the UI layers use the PhotoPrimaryShape of CardRow's
 * `scene` to pass stage/vibe/intensity/imageUrl across the shared wire without
 * losing the grounded metadata.
 */
import type { StoryChapter } from "@/types/lifeStory";
import type { EmotionalNode } from "@/types/emotionalTimeline";
import type { GalleryCardData } from "@/types/gallery";

/**
 * Snake_case row of the Supabase `cards` table (as returned by the DB wire).
 * The `cards-remote.ts` DAL maps this into the camelCase `CardRow`.
 */
export interface SupabaseCardRow {
  id?: string;
  user_id?: string;
  stage_name: string;
  song_title: string;
  artist_name: string;
  release_year: string | number;
  image_url: string | null;
  dynamic_lore_text: string;
  intensity_score: number;
  vibe_label: string;
  is_grounded: boolean;
  created_at?: string;
}

/** Pack `<stage>|<vibe>|<intensity>` into one scene token. */
function encodeScene(stage: string, vibe: string, intensity: number): string {
  return `${stage}|${vibe}|${intensity}`;
}

/** Unpack a scene token; falls back to stage + defaults on malformed data. */
function decodeScene(
  sceneText: string,
  fallbackStage: string,
): {
  stage: string;
  vibe: string;
  intensity: number;
} {
  const parts = sceneText.split("|");
  if (parts.length === 3) {
    const parsed = Number.parseInt(parts[2], 10);
    return {
      stage: parts[0] || fallbackStage,
      vibe: parts[1] || "Grounded Reflection",
      intensity: Number.isNaN(parsed) ? 8 : parsed,
    };
  }
  return { stage: fallbackStage, vibe: "Grounded Reflection", intensity: 8 };
}

/**
 * To-DB — Grounded StoryChapter (+ optional EmotionalNode) → SupabaseCardRow.
 * The scene token rides inside the narrative as an HTML comment so the lore
 * text stays human-readable while the structured metadata survives the DB.
 */
export function mapGroundedToCardRow(
  chapter: StoryChapter,
  node?: EmotionalNode,
  imageUrl?: string,
  userId?: string,
): SupabaseCardRow {
  const scene = encodeScene(
    chapter.stageName,
    node?.vibeLabel || "Grounded Reflection",
    node?.intensity ?? 8,
  );
  return {
    user_id: userId || undefined,
    stage_name: chapter.stageName,
    song_title: chapter.songTitle,
    artist_name: chapter.artistName,
    release_year: chapter.releaseYear,
    image_url: imageUrl && imageUrl.trim() !== "" ? imageUrl : null,
    dynamic_lore_text: `${chapter.narrative}<!--SCENE:${scene}-->`,
    intensity_score: node?.intensity ?? 8,
    vibe_label: node?.vibeLabel || "Grounded Reflection",
    is_grounded: true,
  };
}

/**
 * From-DB — SupabaseCardRow → GalleryCardData (UI model).
 * Decodes the `<!--SCENE:...-->` token when present; otherwise relies on the
 * row's own stage/vibe/intensity columns. The narrative is cleaned of the
 * token so the gallery never displays it.
 */
export function mapCardRowToGrounded(row: SupabaseCardRow): GalleryCardData {
  const narrativeRaw = row.dynamic_lore_text || "";
  const sceneMatch = narrativeRaw.match(/<!--SCENE:(.*?)-->/);
  const cleanNarrative = narrativeRaw.replace(/<!--SCENE:.*?-->/, "").trim();

  let stage = row.stage_name;
  let vibe = row.vibe_label || "Grounded Reflection";
  let intensity = row.intensity_score || 8;

  if (sceneMatch?.[1]) {
    const decoded = decodeScene(sceneMatch[1], row.stage_name);
    stage = decoded.stage;
    vibe = decoded.vibe;
    intensity = decoded.intensity;
  }

  return {
    id: row.id || `card-${stage.toLowerCase().replace(/\s+/g, "-")}`,
    stageName: stage || "Unknown",
    songTitle: row.song_title,
    artistName: row.artist_name,
    releaseYear: row.release_year,
    imageUrl: row.image_url || "/assets/default-woodcut-placeholder.jpg",
    dynamicLoreText: cleanNarrative,
    intensityScore: intensity,
    vibeLabel: vibe,
    isGrounded: row.is_grounded ?? true,
    createdAt: row.created_at || new Date().toISOString(),
  };
}
