import { describe, expect, it } from "vitest";

import {
  buildTree,
  buildWaveformPoints,
  DEFAULT_POSTER_LABELS,
  fitFeedRows,
  nodeColors,
  seededRandom,
} from "./poeticPoster";

describe("seededRandom", () => {
  it("is deterministic for the same seed", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produces values in [0, 1) and differs across seeds", () => {
    const rng = seededRandom(7);
    for (let i = 0; i < 50; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });
});

describe("buildWaveformPoints", () => {
  const box = { x: 100, y: 200, width: 800, height: 160 };

  it("returns one point per intensity", () => {
    const points = buildWaveformPoints([0.2, 0.8, 0.5], box, 0.8);
    expect(points).toHaveLength(3);
  });

  it("spaces points evenly across the box width", () => {
    const points = buildWaveformPoints([0.5, 0.5, 0.5, 0.5], box, 0.5);
    expect(points[0].x).toBe(100);
    expect(points[3].x).toBe(900);
    expect(points[1].x - points[0].x).toBeCloseTo(800 / 3);
  });

  it("maps the maximum intensity to the top of the box", () => {
    const points = buildWaveformPoints([0.3, 1], box, 1);
    expect(points[1].y).toBe(box.y);
    expect(points[0].y).toBeGreaterThan(box.y);
    expect(points[0].y).toBeLessThan(box.y + box.height);
  });

  it("handles a single point without division by zero", () => {
    const points = buildWaveformPoints([0.5], box, 0.5);
    expect(points).toHaveLength(1);
    expect(points[0].x).toBe(box.x);
  });

  it("returns an empty array for no intensities", () => {
    expect(buildWaveformPoints([], box, 1)).toEqual([]);
  });
});

describe("fitFeedRows", () => {
  it("shows every row when the budget is sufficient", () => {
    expect(fitFeedRows(5, 1000, 68)).toEqual({ shown: 5, hidden: 0 });
  });

  it("caps rows and reports the hidden remainder", () => {
    const { shown, hidden } = fitFeedRows(20, 68 * 3 + 10, 68);
    expect(shown).toBe(3);
    expect(hidden).toBe(17);
  });

  it("shows nothing when no budget is available", () => {
    expect(fitFeedRows(4, 0, 68)).toEqual({ shown: 0, hidden: 4 });
    expect(fitFeedRows(4, -200, 68)).toEqual({ shown: 0, hidden: 4 });
  });
});

describe("buildTree", () => {
  it("is deterministic for the same seed", () => {
    expect(buildTree(7, 1200, 900, 640)).toEqual(buildTree(7, 1200, 900, 640));
  });

  it("produces a trunk plus four main branches", () => {
    const { segments, mainEnds } = buildTree(7, 1200, 900, 640);
    expect(mainEnds).toHaveLength(4);
    expect(segments.length).toBeGreaterThan(10);
    // Trunk: first segment starts at the base, rises vertically.
    expect(segments[0].x1).toBe(1200);
    expect(segments[0].y1).toBe(900);
    expect(segments[0].x2).toBe(1200);
    expect(segments[0].y2).toBeLessThan(900);
    // Two branches lean left, two lean right.
    expect(mainEnds.filter((e) => e.x < 1200)).toHaveLength(2);
    expect(mainEnds.filter((e) => e.x > 1200)).toHaveLength(2);
  });

  it("branches thin out with depth", () => {
    const { segments } = buildTree(7, 1200, 900, 640);
    const widths = segments.map((s) => s.width);
    expect(Math.max(...widths)).toBe(30); // trunk
    expect(Math.min(...widths)).toBeLessThan(10);
  });
});

describe("nodeColors", () => {
  it("interpolates from the first to the last stop", () => {
    const colors = nodeColors(4, "#000000", "#ffffff");
    expect(colors).toHaveLength(4);
    expect(colors[0]).toBe("#000000");
    expect(colors[3]).toBe("#ffffff");
    expect(colors[1]).toBe("#555555");
    expect(colors[2]).toBe("#aaaaaa");
  });

  it("handles a single node and invalid hex safely", () => {
    expect(nodeColors(1, "#a7b0c0", "#b3122e")).toEqual(["#a7b0c0"]);
    expect(nodeColors(2, "nope", "#ffffff")[0]).toBe("#d6a84a");
  });
});

describe("DEFAULT_POSTER_LABELS", () => {
  it("ships the English reference map labels", () => {
    expect(DEFAULT_POSTER_LABELS.mapTitle).toBe("MUSIC MAP");
    expect(DEFAULT_POSTER_LABELS.mapSubtitle).toBe("SOUNDTRACK OF A LIFE");
    expect(DEFAULT_POSTER_LABELS.emotionalJourney).toBe("EMOTIONAL JOURNEY");
    expect(DEFAULT_POSTER_LABELS.lifePlaylist).toBe("MY LIFE PLAYLIST");
    expect(DEFAULT_POSTER_LABELS.treeBranches).toEqual(["MIND", "POWER", "DARKNESS", "ACCEPTANCE"]);
    expect(DEFAULT_POSTER_LABELS.journeyNodes).toHaveLength(8);
  });
});
