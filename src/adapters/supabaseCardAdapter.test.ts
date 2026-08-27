import { describe, expect, it } from "vitest";
import { mapGroundedToCardRow, mapCardRowToGrounded } from "./supabaseCardAdapter";
import type { StoryChapter } from "@/types/lifeStory";
import type { EmotionalNode } from "@/types/emotionalTimeline";

describe("supabaseCardAdapter", () => {
  const chapter = (over: Partial<StoryChapter> = {}): StoryChapter => ({
    stageName: "Childhood",
    songTitle: "Holy Diver",
    artistName: "Dio",
    releaseYear: 1983,
    narrative: `During the childhood phase, "Holy Diver" by Dio became the soundtrack of choice.`,
    ...over,
  });

  const node = (over: Partial<EmotionalNode> = {}): EmotionalNode => ({
    stageName: "Childhood",
    songTitle: "Holy Diver",
    artistName: "Dio",
    releaseYear: 1983,
    valency: 0.8,
    intensity: 7,
    vibeLabel: "Nostalgic Spark",
    temporalArcPosition: 0,
    ...over,
  });

  describe("mapGroundedToCardRow", () => {
    it("builds a CardRow with trackKey, stage scene, imageUrl and lore", () => {
      const row = mapGroundedToCardRow(chapter(), node(), "https://cdn.example/a.jpg");
      expect(row.trackKey).toBe("dio — holy diver");
      expect(row.title).toBe("Holy Diver");
      expect(row.artist).toBe("Dio");
      expect(row.scene).toBe("Childhood|Nostalgic Spark|7");
      expect(row.lore).toContain("Holy Diver");
      expect(row.imageUrl).toBe("https://cdn.example/a.jpg");
    });

    it("falls back to stageName scene + gallery card input", () => {
      const row = mapGroundedToCardRow(chapter(), undefined, "");
      expect(row.scene).toBe("Childhood");
      expect(row.imageUrl).toBe("/assets/default-woodcut-placeholder.jpg");
    });
  });

  describe("mapCardRowToGrounded", () => {
    it("round-trips scene packed stage back into StoryChapter", () => {
      const row = mapGroundedToCardRow(chapter(), node(), "https://cdn.example/a.jpg");
      const restored = mapCardRowToGrounded(row);
      expect(restored.stageName).toBe("Childhood");
      expect(restored.songTitle).toBe("Holy Diver");
      expect(restored.artistName).toBe("Dio");
      expect(restored.releaseYear).toBe(1983);
      expect(restored.narrative).toContain("Holy Diver");
    });

    it("uses plain scene as stage when no pipe separator exists", () => {
      const row = mapGroundedToCardRow(chapter());
      const restored = mapCardRowToGrounded(row);
      expect(restored.stageName).toBe("Childhood");
      expect(restored.narrative).toContain("Holy Diver");
    });
  });
});
