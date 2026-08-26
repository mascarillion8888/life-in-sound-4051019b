import { describe, expect, it } from "vitest";

import type { PoeticAnalysis } from "@/lib/llm/poetic-analyzer";
import type { LifeFeedEntry } from "@/lib/life-feed";
import type { Song } from "@/lib/song/types";

import {
  buildTree,
  buildWaveformPoints,
  DEFAULT_POSTER_LABELS,
  fitFeedRows,
  nodeColors,
  renderMap,
  seededRandom,
  themedPalette,
} from "./poeticPoster";
import { TR_LIFE_CARD_STRINGS } from "./lifeCards";
import { resolvePosterTheme } from "./posterTheme";

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

/* -------------------------------------------------------------------------- */
/* renderMap — flow-layout height fitting (recording stub context)            */
/* -------------------------------------------------------------------------- */

function stubCanvas(): HTMLCanvasElement {
  const gradient = { addColorStop: () => {} };
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(t, prop) {
      if (prop === "measureText") {
        return (text: unknown) => ({ width: String(text).length * 12 });
      }
      if (prop === "createRadialGradient" || prop === "createLinearGradient") {
        return () => gradient;
      }
      if (typeof prop === "string" && prop in t) return t[prop];
      return () => {};
    },
    set(t, prop, value) {
      if (typeof prop === "string") t[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return {
    width: 0,
    height: 0,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
}

// jsdom has no Path2D; the waveform path only needs the method surface.
if (typeof globalThis.Path2D === "undefined") {
  (globalThis as Record<string, unknown>).Path2D = class {
    moveTo() {}
    lineTo() {}
    quadraticCurveTo() {}
  };
}

function fakeSong(i: number): Song {
  return {
    provider: "manual",
    providerId: `song-${i}`,
    title: `Track ${i}`,
    artist: `Artist ${i}`,
    album: null,
    artworkUrl: null,
    isrc: null,
  };
}

function fakeAnalysis(): PoeticAnalysis {
  return {
    manifesto: "A life measured in choruses and static.",
    chapters: Array.from({ length: 6 }, (_, i) => ({
      id: `chapter-${i}`,
      title: `Phase ${i + 1}`,
      ageRange: "Ages 9–12",
      songIndexes: i === 2 || i === 4 ? [i + 1, i + 2] : [i + 1],
      narrative: "A chapter of the map.",
      mood: "wide-eyed",
    })),
    songInsights: Array.from({ length: 8 }, (_, i) => ({
      index: i + 1,
      title: `Track ${i + 1}`,
      insight: "It stayed with you.",
    })),
    emotionalCurve: Array.from({ length: 8 }, (_, i) => ({
      label: `T${i + 1}`,
      intensity: 0.3 + (i % 4) * 0.2,
    })),
    coreDuality: { axis: "Steel / Rain", left: "Steel", right: "Rain", resolution: "Both." },
    visual: {
      themeId: "metal-gothic",
      palette: { primary: "#a7b0c0", accent: "#b3122e", background: "#0b0b10", text: "#e8e6df" },
      typography: "blackletter-display",
      aura: ["iron", "cathedral", "thunder"],
      artworkPrompt: "",
    },
    source: "deterministic",
  };
}

function fakeFeed(count: number): LifeFeedEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `feed-${i}`,
    song: fakeSong(100 + i),
    note: null,
    insight: null,
    addedAt: `2026-08-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
  }));
}

describe("renderMap", () => {
  const songs = Array.from({ length: 8 }, (_, i) => fakeSong(i));

  it("fits the whole flow layout (incl. the 8 life cards) into the canvas", () => {
    const canvas = stubCanvas();
    renderMap(canvas, fakeAnalysis(), songs, [], DEFAULT_POSTER_LABELS, []);
    expect(Number.isFinite(canvas.height)).toBe(true);
    // 8 cards in a 4×2 grid (~1.7k px) plus the map sections: the measured
    // height must exceed the old fixed 3600 canvas, never clip it.
    expect(canvas.height).toBeGreaterThan(3600);
  });

  it("grows the canvas when the Life Feed grows", () => {
    const small = stubCanvas();
    renderMap(small, fakeAnalysis(), songs, [], DEFAULT_POSTER_LABELS, []);
    const big = stubCanvas();
    renderMap(big, fakeAnalysis(), songs, fakeFeed(12), DEFAULT_POSTER_LABELS, []);
    expect(big.height).toBeGreaterThan(small.height);
  });

  it("is deterministic (same input, same measured height)", () => {
    const a = stubCanvas();
    const b = stubCanvas();
    renderMap(a, fakeAnalysis(), songs, fakeFeed(3), DEFAULT_POSTER_LABELS, []);
    renderMap(b, fakeAnalysis(), songs, fakeFeed(3), DEFAULT_POSTER_LABELS, []);
    expect(a.height).toBe(b.height);
  });

  it("accepts localized life-card copy without changing the layout contract", () => {
    const canvas = stubCanvas();
    renderMap(
      canvas,
      fakeAnalysis(),
      songs,
      [],
      {
        ...DEFAULT_POSTER_LABELS,
        lifeCards: "HAYAT KARTLARI",
        lifeCardStrings: TR_LIFE_CARD_STRINGS,
      },
      [],
    );
    expect(canvas.height).toBeGreaterThan(3600);
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

describe("themedPalette", () => {
  const base = {
    primary: "#d4af37",
    accent: "#f5f0d0",
    text: "#f5f0d0",
    background: "#0b0b10",
  };

  it("re-casts the three surface roles with the poster theme", () => {
    const themed = themedPalette(base, {
      metal: "bronze",
      metalColor: "#a97142",
      metalHighlight: "#d09a68",
      primaryBg: "#0b0b10",
      atmosphere: "gothic-thunder",
      backgroundScene: "stormy",
    });
    expect(themed.background).toBe("#0b0b10");
    expect(themed.primary).toBe("#a97142");
    expect(themed.accent).toBe("#d09a68");
  });

  it("only re-casts the three theme roles (text passes through untouched)", () => {
    const themed = themedPalette(base, resolvePosterTheme({ genres: ["synthwave"] }));
    expect(themed.text).toBe(base.text);
    expect(themed.primary).toBe("#ff2fb3");
    expect(themed.accent).toBe("#7df9ff");
    expect(themed.background).toBe("#12081f");
  });
});
