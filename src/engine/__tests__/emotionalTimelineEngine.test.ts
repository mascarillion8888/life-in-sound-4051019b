import { describe, it, expect } from "vitest";
import { generateEmotionalTimeline } from "../emotionalTimelineEngine";
import type { LifeContext } from "../../types/musicDna";

describe("emotionalTimelineEngine", () => {
  it("should generate timeline entries correctly from life contexts", () => {
    const mockContexts = [
      {
        id: "ctx-1",
        song: { title: "Song A", artist: "Artist A", year: 2010 },
        contextText: "Childhood memories",
        stageName: "Childhood",
        questionId: 1,
      },
    ] as unknown as LifeContext[];

    const result = generateEmotionalTimeline(null, mockContexts);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].songTitle).toBe("Song A");
    expect(result.nodes[0].contextText).toBe("Childhood memories");
    expect(result.isGrounded).toBe(true);
  });

  it("degrades safely when contexts are missing", () => {
    const result = generateEmotionalTimeline(null, undefined as unknown as LifeContext[]);
    expect(result.nodes).toEqual([]);
    expect(result.isGrounded).toBe(false);
  });
});
