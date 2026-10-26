import { describe, expect, it } from "vitest";

import { POSTER_HEIGHT, computePosterLayout, normalizeHeroText } from "./posterRenderer";

/**
 * Dilim 1 (İş 3) — poster layout + hero line infrastructure.
 *
 * The layout seam (`computePosterLayout`) must be behaviour-identical to the
 * legacy hard-coded renderer when there is no hero (heroLines === 0): divider
 * at headlineBottom+80, song list at headlineBottom+170. When a hero is added
 * (Dilim 2+), the divider/song list shift down by one hero block and nothing
 * overflows the canvas.
 */
describe("computePosterLayout", () => {
  it("returns the EXACT legacy coordinates when there is no hero (heroLines 0)", () => {
    const layout = computePosterLayout(1, 0);
    expect(layout.headlineBottom).toBe(320 + 1 * 96);
    expect(layout.heroFirstY).toBeNull();
    expect(layout.subtitleY).toBe(layout.headlineBottom + 20);
    // Legacy constants, unchanged: divider +80, song list +170.
    expect(layout.dividerY).toBe(layout.headlineBottom + 80);
    expect(layout.songStartY).toBe(layout.headlineBottom + 170);
  });

  it("keeps legacy coordinates for a 3-line headline too (heroLines 0)", () => {
    const layout = computePosterLayout(3, 0);
    expect(layout.headlineBottom).toBe(320 + 3 * 96);
    expect(layout.dividerY).toBe(layout.headlineBottom + 80);
    expect(layout.songStartY).toBe(layout.headlineBottom + 170);
  });

  it("computes shifted coordinates and a hero baseline when a hero is present", () => {
    const layout = computePosterLayout(2, 1);
    expect(layout.headlineBottom).toBe(320 + 2 * 96);
    expect(layout.heroFirstY).not.toBeNull();
    // Hero present => divider + song list shift down by one hero block.
    expect(layout.dividerY).toBeGreaterThan(layout.headlineBottom + 80);
    expect(layout.songStartY).toBeGreaterThan(layout.headlineBottom + 170);
    // Subtle hero under the mood subheadline.
    expect(layout.heroFirstY!).toBeGreaterThan(layout.subtitleY);
  });

  it("8 songs + 2-line headline + 2-line hero never overflow the canvas", () => {
    const layout = computePosterLayout(2, 2);
    const lastRowBaseline = layout.songStartY + 8 * layout.songStep + 44;
    // Must stay above the keywords footer (songBottomLimit).
    expect(lastRowBaseline).toBeLessThanOrEqual(layout.songBottomLimit);
    expect(layout.songBottomLimit).toBeLessThan(POSTER_HEIGHT);
  });

  it("a 1-line hero with a 3-line headline still fits 8 songs", () => {
    const layout = computePosterLayout(3, 1);
    const lastRowBaseline = layout.songStartY + 8 * layout.songStep + 44;
    expect(lastRowBaseline).toBeLessThanOrEqual(layout.songBottomLimit);
  });
});

describe("normalizeHeroText", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeHeroText("  a quiet storm  ")).toBe("a quiet storm");
  });

  it("caps a hero longer than 90 characters at 90", () => {
    const long = "x".repeat(120);
    expect(normalizeHeroText(long)).toHaveLength(90);
  });

  it("keeps a hero under 90 characters intact", () => {
    const short = "a quiet storm over an ocean of memory";
    expect(normalizeHeroText(short)).toBe(short);
    expect(normalizeHeroText(short)).toHaveLength(short.length);
  });
});
