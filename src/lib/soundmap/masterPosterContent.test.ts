import { describe, expect, it } from "vitest";

import { analyzeUserJourney } from "@/lib/ai/pipeline";
import { deterministicPoeticAnalysis } from "@/lib/llm/poetic-analyzer";
import type { Song } from "@/lib/song/types";

import { buildMasterPosterContent, RENDER_LABELS } from "./masterPosterContent";

const TITLES = [
  "A - One",
  "B - Two",
  "C - Three",
  "D - Four",
  "E - Five",
  "F - Six",
  "G - Seven",
  "H - Eight",
];

function makeAnalysis() {
  const answers: Record<number, string> = {};
  TITLES.forEach((t, i) => {
    answers[i + 1] = t;
  });
  const profile = analyzeUserJourney(answers);
  if (!profile) throw new Error("fixture profile must exist");
  return deterministicPoeticAnalysis(profile, TITLES);
}

const SONGS: Song[] = TITLES.map((t, i) => ({
  provider: "manual",
  providerId: `s-${i}`,
  title: t,
  artist: t.split(" - ")[0] ?? "",
  album: null,
  artworkUrl: null,
  isrc: null,
}));

describe("buildMasterPosterContent", () => {
  it("numbering 1-11 — feed entries extend the numbered list past eight", () => {
    const content = buildMasterPosterContent(makeAnalysis(), SONGS);
    expect(content.numberedTitles).toHaveLength(8);
    expect(content.numberedTitles[0]).toBe("A - One");

    const feed = [
      { song: SONGS[0], timestamp: 1 },
      { song: SONGS[1], timestamp: 2 },
      { song: SONGS[2], timestamp: 3 },
    ] as never;
    const withFeed = buildMasterPosterContent(makeAnalysis(), SONGS, feed);
    expect(withFeed.numberedTitles).toHaveLength(11);
  });

  it("side panels — early era from chapters i+ii, peak identity from chapter v", () => {
    const content = buildMasterPosterContent(makeAnalysis(), SONGS);
    expect(content.earlyEraTracks).toContain("A - One");
    expect(content.peakIdentityTracks.length).toBeGreaterThan(0);
  });

  it("portals — the four earliest chapters with their ages", () => {
    const content = buildMasterPosterContent(makeAnalysis(), SONGS);
    expect(content.portals).toHaveLength(4);
    expect(content.portals[0].age).toBeTruthy();
    expect(content.portals[0].title).toBeTruthy();
  });

  it("master song — the peak of the emotional curve", () => {
    const analysis = makeAnalysis();
    const content = buildMasterPosterContent(analysis, SONGS);
    const peak = analysis.emotionalCurve.reduce(
      (b, p, i) => (p.intensity > analysis.emotionalCurve[b].intensity ? i : b),
      0,
    );
    expect(content.masterTitle).toBe(SONGS[peak].title);
  });

  it("waveform points fit the 0..100 viewBox", () => {
    const content = buildMasterPosterContent(makeAnalysis(), SONGS);
    expect(content.wavePoints).toHaveLength(8);
    for (const p of content.wavePoints) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
    }
  });

  it("RENDER_LABELS — TR editorial strings", () => {
    expect(RENDER_LABELS.tr.title).toBe("BİR HAYATIN SOUNDTRACK'İ — MÜZİK HARİTASI");
    expect(RENDER_LABELS.tr.portals).toBe("Geçiş Portalları");
    expect(RENDER_LABELS.tr.journeyArc).toContain("Keşif");
    expect(RENDER_LABELS.tr.download).toContain("2048×3072");
  });
});
