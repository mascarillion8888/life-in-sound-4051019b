import { describe, expect, it } from "vitest";
import { generateEmotionalTimeline } from "../emotionalTimelineEngine";
import { generateMusicDNA } from "../musicDnaEngine";
import type { LifeContext } from "../../types/musicDna";
import type { Song } from "../../lib/song/types";

const song = (title: string, artist: string, releaseYear: number, providerId: string): Song => ({
  provider: "itunes",
  providerId,
  title,
  artist,
  album: null,
  artworkUrl: null,
  isrc: null,
  releaseYear,
  verified: true,
});

describe("emotionalTimelineEngine", () => {
  const mockContexts: LifeContext[] = [
    {
      questionId: 1,
      stageName: "Childhood",
      song: song("First Spark Song", "Artist A", 1995, "t1"),
    },
    {
      questionId: 4,
      stageName: "Hard Time",
      song: song("Dark Song", "Artist B", 2005, "t2"),
    },
    {
      questionId: 5,
      stageName: "Unstoppable",
      song: song("Triumph Song", "Artist C", 2010, "t3"),
    },
  ];

  it("generateEmotionalTimeline doğru düğümler (nodes) ve trajectory deseni oluşturmalı", () => {
    const dna = generateMusicDNA(mockContexts.map((c) => c.song));
    const timeline = generateEmotionalTimeline(dna, mockContexts);

    expect(timeline.nodes.length).toBe(3);

    // Childhood için nostaljik pozitif valency
    expect(timeline.nodes[0].valency).toBeGreaterThan(0);
    expect(timeline.nodes[0].vibeLabel).toBe("Nostalgic Spark");

    // Hard Time için negatif valency ve yüksek intensity
    expect(timeline.nodes[1].valency).toBeLessThan(0);
    expect(timeline.nodes[1].intensity).toBe(10);

    // Trajectory ve Peak stage kontrolü
    expect(timeline.peakStage).toContain("Hard Time");
    expect(timeline.isGrounded).toBe(true);
  });

  it("boş bağlam dizisinde hata fırlatmalı", () => {
    const dna = generateMusicDNA([song("Test", "Test", 2020, "t0")]);
    expect(() => generateEmotionalTimeline(dna, [])).toThrow(
      "Emotional Timeline requires valid LifeContext array.",
    );
  });
});
