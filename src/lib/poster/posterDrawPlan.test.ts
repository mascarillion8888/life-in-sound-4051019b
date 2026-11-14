import { describe, expect, it } from "vitest";

import { providerSafePosterModel, type LifePosterModel, type PosterEntry } from "./posterModel";
import { composePosterLayout, type LayoutBox } from "./posterLayout";
import {
  POSTER_DRAW_PLAN_VERSION,
  buildPosterDrawPlan,
  type DrawCommand,
  type PosterAssets,
} from "./posterDrawPlan";

const W = 2048;
const H = 3072;

function entry(i: number, over: Partial<PosterEntry> = {}): PosterEntry {
  return {
    cardIndex: i,
    stageTitle: `STAGE ${i}`,
    track: { provider: "manual", providerId: `t-${i}`, title: `Song ${i}`, artist: `Artist ${i}` },
    releaseYear: 1980 + i,
    period: null,
    mood: "Dreamy",
    genre: "dream pop",
    decade: "1980s",
    loreLine: `Lore line ${i}`,
    userNote: null,
    noteForProvider: false,
    ...over,
  };
}

function model(entries: PosterEntry[], language = "en"): LifePosterModel {
  return {
    id: `poster-draw-${entries.length}`,
    version: "poster-v1",
    outputSize: { width: W, height: H },
    entries,
    generatedFromLanguage: language,
    birthYear: null,
  };
}

const assets: PosterAssets = {
  backdropFor: (e) => ({ src: `asset://${e.genre ?? "none"}-${e.mood ?? "none"}` }),
};
const noAssets: PosterAssets = { backdropFor: () => null };

function plan(count: number, a: PosterAssets = assets, language = "en") {
  const entries = Array.from({ length: count }, (_, i) => entry(i));
  const m = model(entries, language);
  return {
    layout: composePosterLayout(m),
    plan: buildPosterDrawPlan(composePosterLayout(m), m, a),
  };
}

function byKind(commands: DrawCommand[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of commands) out[c.kind] = (out[c.kind] ?? 0) + 1;
  return out;
}

function boxes(c: DrawCommand): LayoutBox | null {
  return "box" in c ? c.box : null;
}

function insideCanvas(box: LayoutBox): boolean {
  return box.x >= 0 && box.y >= 0 && box.x + box.w <= W && box.y + box.h <= H;
}

function contains(outer: LayoutBox, inner: LayoutBox): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

function allTextLines(commands: DrawCommand[]): string[] {
  return commands.flatMap((c) => (c.kind === "text" ? c.lines : []));
}

describe("buildPosterDrawPlan — command counts per entry count", () => {
  it.each<[number, Record<string, number>]>([
    [0, { rect: 1, gradientScrim: 3, text: 3, line: 1 }],
    [1, { rect: 2, image: 1, gradientScrim: 8, text: 8, line: 2 }],
    [3, { rect: 4, image: 3, gradientScrim: 18, text: 18, line: 4 }],
    [8, { rect: 9, image: 8, gradientScrim: 43, text: 43, line: 9 }],
    [12, { rect: 13, image: 12, gradientScrim: 63, text: 63, line: 13 }],
  ])("count %i → %o", (count, expected) => {
    const { plan: p } = plan(count);
    expect(byKind(p.commands)).toEqual(expected);
    expect(p.version).toBe(POSTER_DRAW_PLAN_VERSION);
    expect(p.canvas).toEqual({ width: W, height: H });
  });

  it("zero entries still paints a full-canvas base fill (never blank)", () => {
    const { plan: p } = plan(0);
    const first = p.commands[0];
    expect(first.kind).toBe("rect");
    expect((first as { box: LayoutBox }).box).toEqual({ x: 0, y: 0, w: W, h: H });
  });
});

describe("buildPosterDrawPlan — structural invariants (every count)", () => {
  it.each([0, 1, 3, 8, 12])(
    "count %i: every text command has a scrim directly above it",
    (count) => {
      const { plan: p } = plan(count);
      p.commands.forEach((cmd, i) => {
        if (cmd.kind !== "text") return;
        const prev = p.commands[i - 1];
        expect(prev?.kind).toBe("gradientScrim");
        if (prev?.kind === "gradientScrim") {
          expect(contains(prev.box, cmd.box)).toBe(true);
        }
      });
    },
  );

  it.each([0, 1, 3, 8, 12])("count %i: no command leaves the canvas", (count) => {
    const { plan: p } = plan(count);
    for (const cmd of p.commands) {
      const box = boxes(cmd);
      if (box) expect(insideCanvas(box)).toBe(true);
    }
  });

  it("orders backdrop before scrim before text", () => {
    const { plan: p } = plan(3);
    const firstImage = p.commands.findIndex((c) => c.kind === "image");
    const firstScrim = p.commands.findIndex((c) => c.kind === "gradientScrim");
    const firstText = p.commands.findIndex((c) => c.kind === "text");
    expect(firstImage).toBeGreaterThanOrEqual(0);
    expect(firstImage).toBeLessThan(firstScrim);
    expect(firstScrim).toBeLessThan(firstText);
  });
});

describe("buildPosterDrawPlan — determinism & provider safety", () => {
  it("same input → byte-identical JSON", () => {
    const a = plan(8).plan;
    const b = plan(8).plan;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("accepts the provider-safe model and yields identical JSON", () => {
    const entries = Array.from({ length: 4 }, (_, i) => entry(i));
    const full = model(entries);
    const fromFull = buildPosterDrawPlan(composePosterLayout(full), full, assets);
    const safe = providerSafePosterModel(full);
    const fromSafe = buildPosterDrawPlan(composePosterLayout(safe), safe, assets);
    expect(JSON.stringify(fromSafe)).toBe(JSON.stringify(fromFull));
  });

  it("never contains the user note (even a distinctive one)", () => {
    const secret = "SECRET-NOTE-XYZZY-9137";
    const entries = Array.from({ length: 3 }, (_, i) => entry(i, { userNote: secret }));
    const m = model(entries);
    const p = buildPosterDrawPlan(composePosterLayout(m), m, assets);
    expect(JSON.stringify(p)).not.toContain(secret);
    expect(JSON.stringify(p)).not.toContain("userNote");
  });
});

describe("buildPosterDrawPlan — missing data is never invented", () => {
  it("omits the year text when releaseYear is null", () => {
    const withYear = buildPosterDrawPlan(
      composePosterLayout(model([entry(0, { releaseYear: 1974 })])),
      model([entry(0, { releaseYear: 1974 })]),
      assets,
    );
    const withoutYear = buildPosterDrawPlan(
      composePosterLayout(model([entry(0, { releaseYear: null })])),
      model([entry(0, { releaseYear: null })]),
      assets,
    );
    expect(allTextLines(withYear.commands)).toContain("1974");
    expect(allTextLines(withoutYear.commands)).not.toContain("1974");
    // the year region is simply absent — one fewer scrim + text pair
    expect(byKind(withoutYear.commands).text).toBe(byKind(withYear.commands).text - 1);
  });

  it("omits the lore text when loreLine is null or blank", () => {
    const nullLore = buildPosterDrawPlan(
      composePosterLayout(model([entry(0, { loreLine: null })])),
      model([entry(0, { loreLine: null })]),
      assets,
    );
    const blankLore = buildPosterDrawPlan(
      composePosterLayout(model([entry(0, { loreLine: "   " })])),
      model([entry(0, { loreLine: "   " })]),
      assets,
    );
    expect(allTextLines(nullLore.commands).some((l) => l.startsWith("Lore"))).toBe(false);
    expect(allTextLines(blankLore.commands).some((l) => l.startsWith("Lore"))).toBe(false);
  });

  it("omits the artist text when the artist is blank", () => {
    const e = entry(0, { track: { provider: "manual", providerId: "x", title: "T", artist: "" } });
    const p = buildPosterDrawPlan(composePosterLayout(model([e])), model([e]), assets);
    expect(allTextLines(p.commands)).not.toContain("");
  });

  it("keeps a solid base fill even when no backdrop resolves", () => {
    const p = buildPosterDrawPlan(
      composePosterLayout(model([entry(0)])),
      model([entry(0)]),
      noAssets,
    );
    expect(byKind(p.commands).image).toBeUndefined();
    expect(byKind(p.commands).rect).toBe(2);
  });
});

describe("buildPosterDrawPlan — frame text from existing labels", () => {
  it("uses RENDER_LABELS for the frame (en and tr)", () => {
    const en = buildPosterDrawPlan(
      composePosterLayout(model([entry(0)], "en")),
      model([entry(0)], "en"),
      assets,
    );
    const tr = buildPosterDrawPlan(
      composePosterLayout(model([entry(0)], "tr")),
      model([entry(0)], "tr"),
      assets,
    );
    expect(allTextLines(en.commands)).toContain("Life in a Sound");
    expect(allTextLines(tr.commands)).toContain("Life in a Sound");
    expect(allTextLines(en.commands)).toContain("A LIFE'S SOUNDTRACK — MUSIC MAP");
    expect(allTextLines(tr.commands)).toContain("BİR HAYATIN SOUNDTRACK'İ — MÜZİK HARİTASI");
  });
});
