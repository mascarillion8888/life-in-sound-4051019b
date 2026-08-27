import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CardRow } from "@/lib/supabase/cards-remote";

import {
  discoveryScore,
  eraCaption,
  POSTER_H,
  POSTER_W,
  renderSharePoster,
  wrapText,
} from "./sharePoster";

/** Return a minimal 2D context stub so renderSharePoster proceeds past the
 *  `if (!ctx) return canvas` guard in jsdom (which has no real canvas 2D). */
function stub2dContext(over = {}) {
  const gradient = { addColorStop: vi.fn() };
  const context = {
    createRadialGradient: vi.fn(() => gradient),
    createLinearGradient: vi.fn(() => gradient),
    measureText: vi.fn((s: string) => ({ width: s.length * 40 })),
    addColorStop: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    strokeRect: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    quadraticCurveTo: vi.fn(),
    ellipse: vi.fn(),
    set fillStyle(_v: string | CanvasGradient) {},
    set strokeStyle(_v: string | CanvasGradient) {},
    set lineWidth(_v: number) {},
    set textAlign(_v: string) {},
    set font(_v: string) {},
    ...over,
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as never);
  return context;
}

function card(overrides: Partial<CardRow> = {}): CardRow {
  return {
    id: "id",
    trackKey: "itunes:123",
    title: "Fragile",
    artist: "Sting",
    genre: null,
    releaseYear: 1987,
    birthYear: 1978,
    encounterAge: 9,
    eraYear: 1987,
    userMemory: null,
    scene: "gothic",
    lore: null,
    imagePath: null,
    createdAt: "2026-08-26T00:00:00Z",
    ...overrides,
  };
}

describe("poster format", () => {
  it("targets the Instagram Story format 1080x1920", () => {
    expect(POSTER_W).toBe(1080);
    expect(POSTER_H).toBe(1920);
  });
});

describe("renderSharePoster", () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    stub2dContext();
    // jsdom has no document.fonts; make the readiness check resolve so the
    // render proceeds instead of hanging.
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.restoreAllMocks();
  });

  it("resolves the canvas and falls back to the placeholder when the image load fails", async () => {
    const canvas = document.createElement("canvas");
    const artCard = card({ imageUrl: "https://cdn.example/u/a.png" });
    // Image loader resolves null → renderer draws the placeholder painting and
    // still resolves the canvas.
    const failingLoad = vi.fn().mockResolvedValue(null);
    const result = await renderSharePoster(artCard, canvas, failingLoad);
    expect(result).toBe(canvas);
    expect(failingLoad).toHaveBeenCalledWith("https://cdn.example/u/a.png");
  });

  it("never rejects when the configured image loader throws", async () => {
    const canvas = document.createElement("canvas");
    const artCard = card({ imageUrl: "https://cdn.example/u/a.png" });
    const throwingLoad = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(renderSharePoster(artCard, canvas, throwingLoad)).resolves.toBe(canvas);
  });
});

describe("discoveryScore", () => {
  it("is deterministic and within 40..99", () => {
    const a = discoveryScore("itunes:123");
    expect(a).toBe(discoveryScore("itunes:123"));
    expect(a).toBeGreaterThanOrEqual(40);
    expect(a).toBeLessThan(100);
    expect(discoveryScore("itunes:456")).not.toBe(discoveryScore("itunes:999"));
  });
});

describe("eraCaption", () => {
  it("combines era year and encounter age, uppercased", () => {
    expect(eraCaption(card())).toBe("1987 · AGE 9");
  });

  it("falls back to the release year when era year is unknown", () => {
    expect(eraCaption(card({ eraYear: null, encounterAge: null }))).toBe("1987");
  });

  it("returns empty when no time signal exists", () => {
    expect(eraCaption(card({ eraYear: null, releaseYear: null, encounterAge: null }))).toBe("");
  });
});

describe("wrapText", () => {
  // Fixed-width measure: 1 unit per character.
  const measure = (s: string) => s.length;

  it("wraps greedily within the width", () => {
    const lines = wrapText(measure, "aaa bbb ccc ddd", 7, 4);
    expect(lines).toEqual(["aaa bbb", "ccc ddd"]);
  });

  it("never exceeds maxLines and ellipsizes the overflow", () => {
    const lines = wrapText(measure, "one two three four five six seven eight", 11, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    expect(measure(lines[1])).toBeLessThanOrEqual(11);
  });

  it("keeps short text on one line", () => {
    expect(wrapText(measure, "short", 100, 3)).toEqual(["short"]);
  });

  it("handles empty input", () => {
    expect(wrapText(measure, "", 100, 3)).toEqual([]);
  });
});
