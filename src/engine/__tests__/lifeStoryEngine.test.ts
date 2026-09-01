// @ts-nocheck
import { generateLifeStory } from "../lifeStoryEngine";
import { LifeContext } from "../../types/musicDna";

describe("lifeStoryEngine", () => {
  it("should generate life story chapters from contexts", () => {
    const mockContexts: LifeContext[] = [
      {
        id: "ctx-1",
        song: { title: "Song B", artist: "Artist B" },
        contextText: "Youth story",
        stageName: "Youth",
        questionId: 2
      }
    ];

    const story = generateLifeStory(mockContexts);

    expect(story.chapters).toHaveLength(1);
    expect(story.chapters[0].songTitle).toBe("Song B");
    expect(story.chapters[0].narrative).toBe("Youth story");
  });
});
