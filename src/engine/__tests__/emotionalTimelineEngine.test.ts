// @ts-nocheck
import { generateEmotionalTimeline } from "../emotionalTimelineEngine";
import { LifeContext } from "../../types/musicDna";

describe("emotionalTimelineEngine", () => {
  it("should generate timeline entries correctly from life contexts", () => {
    const mockContexts: LifeContext[] = [
      {
        id: "ctx-1",
        song: { title: "Song A", artist: "Artist A", year: 2010 },
        contextText: "Childhood memories",
        stageName: "Childhood",
        questionId: 1
      }
    ];

    const result = generateEmotionalTimeline(mockContexts);

    expect(result).toHaveLength(1);
    expect(result[0].song).toBe("Song A");
    expect(result[0].contextText).toBe("Childhood memories");
  });
});
