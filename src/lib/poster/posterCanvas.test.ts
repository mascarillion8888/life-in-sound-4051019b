import { describe, expect, it } from "vitest";

import type { LifePosterModel, PosterEntry } from "./posterModel";
import { composePosterLayout } from "./posterLayout";
import { buildPosterDrawPlan, type DrawCommand, type PosterAssets } from "./posterDrawPlan";
import { renderDrawPlan, type LoadPosterImage } from "./posterCanvas";

const W = 2048;
const H = 3072;

function entry(i: number): PosterEntry {
  return {
    cardIndex: i,
    stageTitle: `STAGE ${i}`,
    track: { provider: "manual", providerId: `t-${i}`, title: `Song ${i}`, artist: `Artist ${i}` },
    releaseYear: 1980 + i,
    period: null,
    mood: "Dreamy",
    genre: "dream pop",
    decade: "1980s",
    loreLine: `Lore ${i}`,
    userNote: null,
    noteForProvider: false,
  };
}

function model(count: number): LifePosterModel {
  return {
    id: `canvas-${count}`,
    version: "poster-v1",
    outputSize: { width: W, height: H },
    entries: Array.from({ length: count }, (_, i) => entry(i)),
    generatedFromLanguage: "en",
    birthYear: null,
  };
}

const assets: PosterAssets = { backdropFor: (e) => ({ src: `asset://${e.cardIndex}` }) };

function planFor(count: number) {
  const m = model(count);
  return buildPosterDrawPlan(composePosterLayout(m), m, assets);
}

/** Minimal recording stand-in for CanvasRenderingContext2D. */
function recordingCtx() {
  const calls: string[] = [];
  const ctx = {
    calls,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    fillRect: (x: number, y: number, w: number, h: number) =>
      calls.push(`fillRect:${x},${y},${w},${h}`),
    stroke: () => calls.push("stroke"),
    beginPath: () => calls.push("beginPath"),
    moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
    drawImage: () => calls.push("drawImage"),
    fillText: (text: string) => calls.push(`fillText:${text}`),
    createLinearGradient: () => {
      calls.push("createLinearGradient");
      return { addColorStop: () => calls.push("addColorStop") };
    },
  };
  return ctx as unknown as CanvasRenderingContext2D & { calls: string[] };
}

describe("renderDrawPlan — fake recording ctx", () => {
  it("executes backdrop before scrim before text", () => {
    const ctx = recordingCtx();
    renderDrawPlan(ctx, planFor(3), { "asset://0": {} as CanvasImageSource });
    const first = (kind: string) => ctx.calls.findIndex((c) => c.startsWith(kind));
    expect(first("fillRect:136,528")).toBeGreaterThanOrEqual(0); // base fill of entry 0 backdrop
    expect(first("drawImage")).toBeGreaterThanOrEqual(0);
    expect(first("createLinearGradient")).toBeGreaterThan(first("drawImage"));
    expect(first("fillText")).toBeGreaterThan(first("createLinearGradient"));
  });

  it("draws every text line from the plan (none dropped)", () => {
    const ctx = recordingCtx();
    const p = planFor(8);
    renderDrawPlan(ctx, p);
    const expectedLines = p.commands.flatMap((c) => (c.kind === "text" ? c.lines : []));
    const drawnLines = ctx.calls
      .filter((c) => c.startsWith("fillText:"))
      .map((c) => c.slice("fillText:".length));
    expect(drawnLines).toEqual(expectedLines);
  });

  it("renders on a 2048×3072 surface (canvas commands cover the full rect)", () => {
    const ctx = recordingCtx();
    renderDrawPlan(ctx, planFor(0));
    expect(ctx.calls).toContain(`fillRect:0,0,${W},${H}`);
  });

  it("skips a missing image but still paints the solid base (no throw)", () => {
    const ctx = recordingCtx();
    const p = planFor(2);
    expect(() => renderDrawPlan(ctx, p, {})).not.toThrow();
    expect(ctx.calls.some((c) => c.startsWith("drawImage"))).toBe(false);
    // base fills still happened (1 canvas + 2 backdrops)
    expect(ctx.calls.filter((c) => c.startsWith("fillRect:")).length).toBeGreaterThanOrEqual(3);
  });

  it("is a no-op for an empty command list", () => {
    const ctx = recordingCtx();
    const empty = {
      version: "draw-v1",
      layoutId: "x",
      canvas: { width: W, height: H },
      commands: [] as DrawCommand[],
    };
    renderDrawPlan(ctx, empty);
    expect(ctx.calls).toHaveLength(0);
  });
});

describe("backdrop failure fallback (injected loader rejects)", () => {
  it("a rejecting loader is treated as 'no image' and the plan still renders", async () => {
    const failing: LoadPosterImage = () => Promise.reject(new Error("network down"));
    // The export path swallows loader rejections; emulate by loading then rendering.
    const p = planFor(3);
    const srcs = [...new Set(p.commands.filter((c) => c.kind === "image").map((c) => c.src))];
    const loaded: Record<string, CanvasImageSource | null> = {};
    await Promise.all(
      srcs.map(async (src) => {
        try {
          loaded[src] = await failing(src);
        } catch {
          loaded[src] = null;
        }
      }),
    );
    expect(Object.values(loaded).every((v) => v === null)).toBe(true);

    const ctx = recordingCtx();
    expect(() => renderDrawPlan(ctx, p, loaded)).not.toThrow();
    expect(ctx.calls.some((c) => c.startsWith("drawImage"))).toBe(false);
    // solid fills remain: 1 canvas base + 3 backdrop bases + 3 scrims
    expect(ctx.calls.filter((c) => c.startsWith("fillRect:")).length).toBeGreaterThanOrEqual(7);
  });
});
