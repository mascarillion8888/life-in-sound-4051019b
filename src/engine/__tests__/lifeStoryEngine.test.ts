import { describe, it, expect } from "vitest";
import { generateGroundedLifeStory } from "../lifeStoryEngine";
import type { LifeContext } from "../../types/musicDna";

describe("lifeStoryEngine", () => {
  it("should generate life story chapters from contexts", () => {
    const mockContexts = [
      {
        id: "ctx-1",
        song: { title: "Song B", artist: "Artist B" },
        contextText: "Youth story",
        stageName: "Youth",
        questionId: 2,
      },
    ] as unknown as LifeContext[];

    const story = generateGroundedLifeStory(null, mockContexts);

    expect(story.chapters).toHaveLength(1);
    expect(story.chapters[0].songTitle).toBe("Song B");
    expect(story.chapters[0].narrative).toBe("Youth story");
    expect(story.isGrounded).toBe(true);
  });

  it("degrades safely when contexts are missing", () => {
    const story = generateGroundedLifeStory(null, undefined as unknown as LifeContext[]);
    expect(story.chapters).toEqual([]);
    expect(story.isGrounded).toBe(false);
  });
});
