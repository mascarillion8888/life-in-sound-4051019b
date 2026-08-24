import { describe, expect, it } from "vitest";

import { bronzeTint, grainSpecks, harmonizeFilter, vignetteStops } from "./artworkHarmonize";

describe("harmonizeFilter", () => {
  it("combines sepia and contrast (the unified shader recipe)", () => {
    const f = harmonizeFilter();
    expect(f).toContain("sepia(");
    expect(f).toContain("contrast(");
    expect(f).toContain("brightness(");
  });
});

describe("bronzeTint", () => {
  it("produces a warm bronze rgba with a sane default alpha", () => {
    expect(bronzeTint()).toBe("rgba(150, 105, 52, 0.16)");
  });

  it("clamps alpha into [0,1]", () => {
    expect(bronzeTint(5)).toBe("rgba(150, 105, 52, 1)");
    expect(bronzeTint(-1)).toBe("rgba(150, 105, 52, 0)");
  });
});

describe("vignetteStops", () => {
  it("darkens edges and keeps the center clear", () => {
    const stops = vignetteStops();
    const edge = stops[0];
    const center = stops[stops.length - 1];
    expect(edge[0]).toBe(0);
    expect(center[0]).toBe(1);
    expect(edge[1]).toBeGreaterThan(center[1]);
  });
});

describe("grainSpecks", () => {
  it("is deterministic for the same seed", () => {
    const a = grainSpecks(200, 300, 42);
    const b = grainSpecks(200, 300, 42);
    expect(a).toEqual(b);
  });

  it("changes with the seed", () => {
    const a = grainSpecks(200, 300, 1);
    const b = grainSpecks(200, 300, 2);
    expect(a).not.toEqual(b);
  });

  it("keeps specks inside the box with subtle alpha", () => {
    const specks = grainSpecks(400, 400, 7);
    expect(specks.length).toBeGreaterThanOrEqual(30);
    for (const s of specks) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(400);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(400);
      expect(s.a).toBeGreaterThan(0);
      expect(s.a).toBeLessThanOrEqual(0.12);
    }
  });

  it("caps the speck count for very large boxes", () => {
    expect(grainSpecks(4000, 4000, 1).length).toBeLessThanOrEqual(220);
  });
});
