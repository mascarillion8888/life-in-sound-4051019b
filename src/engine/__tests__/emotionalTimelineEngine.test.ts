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

  it("derives each node's emotion from the song's own mood when present", () => {
    const contexts = [
      {
        id: "ctx-1",
        song: { title: "Paranoid", artist: "Black Sabbath", year: 1970, mood: "Dark" },
        stageName: "Childhood",
        questionId: 1,
      },
    ] as unknown as LifeContext[];

    const result = generateEmotionalTimeline(null, contexts);

    // Dark mood drives the node — not the fixed Childhood stage template.
    expect(result.nodes[0].vibeLabel).toBe("Shadowed Weight");
    expect(result.nodes[0].valency).toBeLessThan(0);
    expect(result.nodes[0].primaryEmotion).toBe("Dark");
    expect(result.nodes[0].energy).toBe(0.7);
  });

  it("falls back to the stage-emotion template when the song has no mood", () => {
    const contexts = [
      {
        id: "ctx-2",
        song: { title: "Dancing Queen", artist: "ABBA", year: 1976, mood: null },
        stageName: "Childhood",
        questionId: 1,
      },
    ] as unknown as LifeContext[];

    const result = generateEmotionalTimeline(null, contexts);

    // No mood → the existing Childhood stage template still applies.
    expect(result.nodes[0].vibeLabel).toBe("Nostalgic Spark");
    expect(result.nodes[0].valency).toBeGreaterThan(0);
  });
});
