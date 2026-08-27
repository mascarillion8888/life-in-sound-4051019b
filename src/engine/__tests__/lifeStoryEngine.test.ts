import { describe, expect, it } from "vitest";
import { generateGroundedLifeStory } from "../lifeStoryEngine";
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

describe("lifeStoryEngine", () => {
  const mockContexts: LifeContext[] = [
    {
      questionId: 1,
      stageName: "Childhood",
      song: song("Holy Diver", "Dio", 1983, "t1"),
    },
    {
      questionId: 4,
      stageName: "Hard Time",
      song: song("Paranoid", "Black Sabbath", 1970, "t2"),
    },
  ];

  it("generateGroundedLifeStory doğrulanmış bağlamlarla hikaye bölümleri üretmeli", () => {
    const dna = generateMusicDNA(mockContexts.map((c) => c.song));
    const story = generateGroundedLifeStory(dna, mockContexts);

    expect(story.chapters.length).toBe(2);
    expect(story.chapters[0].stageName).toBe("Childhood");
    expect(story.chapters[0].songTitle).toBe("Holy Diver");
    expect(story.isGrounded).toBe(true);
    expect(story.title).toContain(dna.temporalPattern.primaryEra);
  });

  it("boş bağlam verildiğinde hata fırlatmalı", () => {
    const dna = generateMusicDNA([song("Test", "Test", 2020, "t0")]);
    expect(() => generateGroundedLifeStory(dna, [])).toThrow(
      "Life Story generation requires valid LifeContext array.",
    );
  });
});
