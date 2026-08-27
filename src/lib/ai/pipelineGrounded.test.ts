import { describe, expect, it } from "vitest";
import { generateGroundedAnalysis, analyzeUserJourney } from "./pipeline";
import type { Song } from "@/lib/song/types";

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

describe("generateGroundedAnalysis (P1 pipeline integration)", () => {
  const journeySongs: Song[] = [
    song("Holy Diver", "Dio", 1983, "s1"),
    song("Paranoid", "Black Sabbath", 1970, "s2"),
    song("Fragile", "Sting", 1987, "s3"),
  ];

  it("wires Song[] → Music DNA → Grounded Life Story → Emotional Timeline", () => {
    const { dna, story, timeline } = generateGroundedAnalysis(journeySongs);

    // P0 Music DNA — era 1970–1987 span, 3 tracks.
    expect(dna.songCount).toBe(3);
    expect(dna.isGrounded).toBe(true);
    expect(dna.temporalPattern.earliestReleaseYear).toBe(1970);
    expect(dna.temporalPattern.latestReleaseYear).toBe(1987);
    expect(dna.temporalPattern.spanYears).toBe(17);

    // P2 Grounded Life Story — 8-stage labels feed the chapter narrative.
    expect(story.chapters).toHaveLength(3);
    expect(story.chapters[0]).toMatchObject({ stageName: "Childhood" });
    expect(story.chapters[0].narrative).toContain("Holy Diver");
    expect(story.isGrounded).toBe(true);

    // P3 Emotional Timeline — node values come from the deterministic
    // stage-emotion matrix (Childhood valency > 0; peak pinned to the strongest).
    expect(timeline.nodes).toHaveLength(3);
    expect(timeline.nodes[0].valency).toBeGreaterThan(0);
    expect(timeline.nodes[0].temporalArcPosition).toBe(0);
    expect(timeline.nodes[2].temporalArcPosition).toBe(100);
    expect(timeline.dominantEmotion).toBe(dna.musicalIdentity.dominantVibe);
  });

  it("respects explicit 8-stage LifeContext[] when the journey passes its own", () => {
    const { timeline } = generateGroundedAnalysis(journeySongs, [
      { questionId: 1, stageName: "Childhood", song: journeySongs[0] },
      { questionId: 4, stageName: "Hard Time", song: journeySongs[1] },
      { questionId: 8, stageName: "Acceptance", song: journeySongs[2] },
    ]);

    const nodes = timeline.nodes;
    expect(nodes[1].stageName).toBe("Hard Time");
    expect(nodes[1].valency).toBeLessThan(0);
    expect(nodes[1].intensity).toBe(10);
    // "Acceptance" hits the deterministic fallback branch — not one of the
    // stage keywords in the engine matrix.
    expect(nodes[2].vibeLabel).toBe("Reflective Transition");
  });

  it("throws on an empty journey selection", () => {
    expect(() => generateGroundedAnalysis([])).toThrow(
      "Grounded analysis requires at least 1 valid Song input.",
    );
  });

  it("keeps the personality pipeline untouched (regression)", () => {
    const profile = analyzeUserJourney({});
    expect(profile).toBeNull();
  });
});
