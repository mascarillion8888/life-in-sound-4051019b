import { describe, expect, it } from "vitest";
import {
  mapGroundedToCardRow,
  mapCardRowToGrounded,
  type SupabaseCardRow,
} from "../supabaseCardAdapter";
import type { StoryChapter } from "../../types/lifeStory";
import type { EmotionalNode } from "../../types/emotionalTimeline";

describe("supabaseCardAdapter", () => {
  const mockChapter: StoryChapter = {
    stageName: "Childhood",
    songTitle: "Holy Diver",
    artistName: "Dio",
    releaseYear: 1983,
    narrative: "A defining track for childhood discovery.",
  };

  const mockNode: EmotionalNode = {
    stageName: "Childhood",
    songTitle: "Holy Diver",
    artistName: "Dio",
    releaseYear: 1983,
    valency: 0.8,
    intensity: 9,
    vibeLabel: "Nostalgic Spark",
    temporalArcPosition: 0,
  };

  it("mapGroundedToCardRow: chapter + node → DB snake_case row with packed scene token", () => {
    const row = mapGroundedToCardRow(
      mockChapter,
      mockNode,
      "https://example.com/art.jpg",
      "user-123",
    );

    expect(row.stage_name).toBe("Childhood");
    expect(row.song_title).toBe("Holy Diver");
    expect(row.artist_name).toBe("Dio");
    expect(row.intensity_score).toBe(9);
    expect(row.vibe_label).toBe("Nostalgic Spark");
    expect(row.is_grounded).toBe(true);
    expect(row.user_id).toBe("user-123");
    expect(row.image_url).toBe("https://example.com/art.jpg");
    expect(row.dynamic_lore_text).toContain("<!--SCENE:");
    expect(row.dynamic_lore_text).toContain("Childhood|Nostalgic Spark|9");
  });

  it("mapCardRowToGrounded: DB row → UI GalleryCardData without loss", () => {
    const mockRow: SupabaseCardRow = {
      id: "db-card-1",
      stage_name: "Hard Time",
      song_title: "Paranoid",
      artist_name: "Black Sabbath",
      release_year: 1970,
      image_url: null,
      dynamic_lore_text: "Cathartic darkness.",
      intensity_score: 10,
      vibe_label: "Cathartic Depth",
      is_grounded: true,
      created_at: "2026-08-27T10:00:00Z",
    };

    const galleryCard = mapCardRowToGrounded(mockRow);

    expect(galleryCard.id).toBe("db-card-1");
    expect(galleryCard.stageName).toBe("Hard Time");
    expect(galleryCard.intensityScore).toBe(10);
    expect(galleryCard.imageUrl).toBe("/assets/default-woodcut-placeholder.jpg");
    expect(galleryCard.isGrounded).toBe(true);
  });

  it("round-trips the packed scene token through lore text", () => {
    const row = mapGroundedToCardRow(mockChapter, mockNode, "https://example.com/art.jpg");
    const restored = mapCardRowToGrounded(row);
    expect(restored.stageName).toBe("Childhood");
    expect(restored.vibeLabel).toBe("Nostalgic Spark");
    expect(restored.intensityScore).toBe(9);
    expect(restored.dynamicLoreText).not.toContain("<!--SCENE:");
  });

  it("defaults vibe/intensity when no node is supplied; empty image → null", () => {
    const row = mapGroundedToCardRow(mockChapter, undefined, "");
    expect(row.vibe_label).toBe("Grounded Reflection");
    expect(row.intensity_score).toBe(8);
    expect(row.image_url).toBeNull();
  });
});
