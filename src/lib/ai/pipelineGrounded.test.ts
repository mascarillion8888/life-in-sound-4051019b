import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateGroundedAnalysis, analyzeUserJourney, __resetGroundedMemo } from "./pipeline";
import { inferMood } from "./moodInference";
import type { Song } from "@/lib/song/types";

// Gerçek LLM/HTTP çağrısı yapılmaz — inferMood deterministic mock'lanır
// (bazı şarkılara mood verir, bazılarına null). Bu, Promise.allSettled'ın
// "başarısız olan null ile devam eder" davranışını da kapsar.
vi.mock("./moodInference", () => ({
  inferMood: vi.fn(async ({ title }: { title: string }) =>
    title === "Holy Diver" ? "Dark" : null,
  ),
  MOOD_SET: [
    "Energetic",
    "Euphoric",
    "Playful",
    "Romantic",
    "Melancholic",
    "Dreamy",
    "Nostalgic",
    "Dark",
    "World",
  ],
}));

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
  // Isolation: the module-level groundedMemo persists across tests. Reset it
  // before every test so memoized results from one test can't leak into the
  // next — keeps tests execution-order-independent.
  beforeEach(() => {
    __resetGroundedMemo();
  });

  const journeySongs: Song[] = [
    song("Holy Diver", "Dio", 1983, "s1"),
    song("Paranoid", "Black Sabbath", 1970, "s2"),
    song("Fragile", "Sting", 1987, "s3"),
  ];

  it("wires Song[] → Music DNA → Grounded Life Story → Emotional Timeline", async () => {
    const { dna, story, timeline } = await generateGroundedAnalysis(journeySongs);

    // Mood enrichment: her şarkı için inferMood çağrıldı (paralel, 3 şarkı).
    expect(inferMood).toHaveBeenCalledTimes(3);

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

  it("respects explicit 8-stage LifeContext[] when the journey passes its own", async () => {
    const { timeline } = await generateGroundedAnalysis(journeySongs, [
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

  it("throws on an empty journey selection", async () => {
    await expect(generateGroundedAnalysis([])).rejects.toThrow(
      "Grounded analysis requires at least 1 valid Song input.",
    );
  });

  // REGRESSION: the results page rebuilds the Song[] array (and its fallback
  // object literals) on EVERY render, so its identity is never stable. The
  // grounded effect depends on that array by identity; an unstable identity used
  // to re-fire `inferMood` (8 parallel LLM calls) on every render — the
  // "mood-inference call storm". This test proves the fix: the SAME song set —
  // passed as two BRAND-NEW array instances with identical content — must run the
  // parallel mood batch exactly once, and a genuinely different song set must
  // still run fresh inference. (Content-keyed, so numbers below are additive.)
  it("regression: same song set never re-fires the parallel mood batch, a new set still runs", async () => {
    const makeSet = (): Song[] => [
      song("Holy Diver", "Dio", 1983, "s1"),
      song("Paranoid", "Black Sabbath", 1970, "s2"),
    ];
    const callsBefore = vi.mocked(inferMood).mock.calls.length;

    // Two separate arrays, identical content — the exact render-driven shape.
    const first = await generateGroundedAnalysis(makeSet());
    const second = await generateGroundedAnalysis(makeSet());

    // Only the first invocation enumerated the 2 songs; the repeat call reused
    // the memoized result instead of firing another inferMood batch.
    expect(vi.mocked(inferMood).mock.calls.length - callsBefore).toBe(2);
    expect(second).toBe(first);

    // A genuinely new song set still runs inference.
    const third = await generateGroundedAnalysis([song("Fragile", "Sting", 1987, "s3")]);
    expect(vi.mocked(inferMood).mock.calls.length - callsBefore).toBe(3);
    expect(third.dna.songCount).toBe(1);
  });

  // Regression (pair): a different LifeContext[] is a different input — memo
  // must NOT serve a stale result across contexts of the same song set.
  it("regression: differing LifeContext[] still runs fresh inference (no stale reuse)", async () => {
    const callsBefore = vi.mocked(inferMood).mock.calls.length;
    const set = [song("Fragile", "Sting", 1987, "s3")];

    await generateGroundedAnalysis(set, [
      { questionId: 1, stageName: "Childhood", song: set[0] },
    ]);
    await generateGroundedAnalysis(set, [
      { questionId: 1, stageName: "Hard Time", song: set[0] },
    ]);

    // Two distinct context fingerprints ⇒ two inference passes.
    expect(vi.mocked(inferMood).mock.calls.length - callsBefore).toBe(2);
  });

  // Regression (pair): contextText is a real input consumed by the grounded
  // engines, so it is part of the memo key. The SAME song set and SAME
  // LifeContext fields (questionId, stageName, song) differing ONLY by
  // contextText must run fresh inference — memo must NOT reuse across them.
  // This test FAILS against the old fingerprint that omitted contextText:
  // there both calls collide onto one key → memo reuse → only 1 inferMood
  // call → the `toBe(2)` assertion below fails (it would see 1).
  it("regression: differing LifeContext contextText still runs fresh inference (contextText is part of the key)", async () => {
    const callsBefore = vi.mocked(inferMood).mock.calls.length;
    const set = [song("Fragile", "Sting", 1987, "s3")];

    const first = await generateGroundedAnalysis(set, [
      { questionId: 1, stageName: "Childhood", song: set[0], contextText: "first winter on the coast" },
    ]);
    const second = await generateGroundedAnalysis(set, [
      { questionId: 1, stageName: "Childhood", song: set[0], contextText: "skipping stones on the lake" },
    ]);

    // Identical song set + identical LifeContext fields (only contextText
    // differs) ⇒ two distinct fingerprints ⇒ two inference passes.
    expect(vi.mocked(inferMood).mock.calls.length - callsBefore).toBe(2);
    // ...and the memoized results are NOT the same object — fresh inference ran.
    expect(second).not.toBe(first);
  });

  it("keeps the personality pipeline untouched (regression)", () => {
    const profile = analyzeUserJourney({});
    expect(profile).toBeNull();
  });
});