import { describe, expect, it } from "vitest";

import { providerSafePosterModel, type LifePosterModel, type PosterEntry } from "./posterModel";
import {
  POSTER_LAYOUT_VERSION,
  composePosterLayout,
  posterLayoutId,
  truncateToBudget,
  type LayoutBox,
  type PosterRegion,
} from "./posterLayout";

const W = 2048;
const H = 3072;

function entry(i: number, loreLine: string | null = null): PosterEntry {
  return {
    cardIndex: i,
    stageTitle: `STAGE ${i}`,
    track: { provider: "itunes", providerId: String(i), title: `Song ${i}`, artist: `Artist ${i}` },
    releaseYear: 1980 + i,
    period: null,
    mood: null,
    genre: null,
    decade: null,
    loreLine,
    userNote: null,
    noteForProvider: false,
  };
}

function model(
  count: number,
  opts: { lore?: (i: number) => string | null; id?: string } = {},
): LifePosterModel {
  const entries = Array.from({ length: count }, (_, i) =>
    entry(i, opts.lore ? opts.lore(i) : null),
  );
  return {
    id: opts.id ?? `poster-test-${count}`,
    version: "poster-v1",
    outputSize: { width: W, height: H },
    entries,
    generatedFromLanguage: "en",
    birthYear: null,
  };
}

function overlaps(a: LayoutBox, b: LayoutBox): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function inside(box: LayoutBox, area: LayoutBox): boolean {
  return (
    box.x >= area.x &&
    box.y >= area.y &&
    box.x + box.w <= area.x + area.w &&
    box.y + box.h <= area.y + area.h
  );
}

function boxValues(box: LayoutBox): number[] {
  return [box.x, box.y, box.w, box.h];
}

function geometryKey(regions: PosterRegion[]): string {
  return JSON.stringify(regions.map((r) => [r.role, r.entryIndex, r.box]));
}

describe("composePosterLayout — variant selection (table)", () => {
  it.each<[number, string, number]>([
    [0, "empty-state", 3],
    [1, "large-stacked", 9],
    [2, "large-stacked", 15],
    [3, "large-stacked", 21],
    [4, "two-column", 27],
    [5, "two-column", 33],
    [8, "two-column", 51],
    [9, "compact-grid", 57],
    [12, "compact-grid", 75],
  ])("%i entries → %s with %i regions", (count, variant, regionCount) => {
    const layout = composePosterLayout(model(count));
    expect(layout.variant).toBe(variant);
    expect(layout.regions).toHaveLength(regionCount);
    expect(layout.version).toBe(POSTER_LAYOUT_VERSION);
    expect(layout.canvas).toEqual({ width: W, height: H });
  });

  it("empty-state has title, subtitle and footer only (no entry regions)", () => {
    const roles = composePosterLayout(model(0)).regions.map((r) => r.role);
    expect(roles).toEqual(["title", "subtitle", "footer"]);
  });

  it("emits the six entry roles in order, all tied to the right entry index", () => {
    const layout = composePosterLayout(model(2));
    const entryRoles = layout.regions.filter((r) => r.role.startsWith("entry-"));
    expect(entryRoles.map((r) => r.role)).toEqual([
      "entry-backdrop",
      "entry-stage",
      "entry-song",
      "entry-artist",
      "entry-year",
      "entry-lore",
      "entry-backdrop",
      "entry-stage",
      "entry-song",
      "entry-artist",
      "entry-year",
      "entry-lore",
    ]);
    expect(entryRoles.map((r) => r.entryIndex)).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
  });

  it("assigns entryIndex null to title/subtitle/footer and a valid index to entries", () => {
    const layout = composePosterLayout(model(5));
    for (const region of layout.regions) {
      if (region.entryIndex === null) {
        expect(["title", "subtitle", "footer"]).toContain(region.role);
      } else {
        expect(region.entryIndex).toBeGreaterThanOrEqual(0);
        expect(region.entryIndex).toBeLessThan(5);
      }
    }
    const seen = new Set(layout.regions.map((r) => r.entryIndex).filter((i) => i !== null));
    expect([...seen].sort((a, b) => (a as number) - (b as number))).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("composePosterLayout — geometry (table over every count)", () => {
  it.each([0, 1, 2, 3, 4, 5, 8, 9, 12])("count %i: no region overlaps another", (count) => {
    const { regions } = composePosterLayout(model(count));
    for (let i = 0; i < regions.length; i++) {
      for (let j = i + 1; j < regions.length; j++) {
        expect(overlaps(regions[i].box, regions[j].box)).toBe(false);
      }
    }
  });

  it.each([0, 1, 2, 3, 4, 5, 8, 9, 12])(
    "count %i: every region is inside the safe area",
    (count) => {
      const layout = composePosterLayout(model(count));
      for (const region of layout.regions) {
        expect(inside(region.box, layout.safeArea)).toBe(true);
      }
    },
  );

  it.each([0, 1, 2, 3, 4, 5, 8, 9, 12])(
    "count %i: coordinates are integers with positive size",
    (count) => {
      const { regions } = composePosterLayout(model(count));
      for (const region of regions) {
        for (const value of boxValues(region.box)) expect(Number.isInteger(value)).toBe(true);
        expect(region.box.w).toBeGreaterThan(0);
        expect(region.box.h).toBeGreaterThan(0);
      }
    },
  );
});

describe("composePosterLayout — determinism", () => {
  it("same model → byte-identical JSON and the same layoutId", () => {
    const a = composePosterLayout(model(4));
    const b = composePosterLayout(model(4));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.layoutId).toBe(b.layoutId);
  });

  it("exposes a stable key order", () => {
    const layout = composePosterLayout(model(1));
    expect(Object.keys(layout)).toEqual([
      "version",
      "layoutId",
      "variant",
      "canvas",
      "safeArea",
      "regions",
    ]);
    expect(Object.keys(layout.regions[0])).toEqual(["role", "box", "entryIndex", "textBudget"]);
    expect(Object.keys(layout.regions[0].box)).toEqual(["x", "y", "w", "h"]);
  });

  it("geometry does not depend on lore length (budget only truncates)", () => {
    const short = composePosterLayout(model(4, { lore: () => "x" }));
    const long = composePosterLayout(model(4, { lore: () => "y".repeat(600) }));
    expect(geometryKey(short.regions)).toBe(geometryKey(long.regions));
    const loreBudgets = (l: typeof short) =>
      l.regions.filter((r) => r.role === "entry-lore").map((r) => r.textBudget);
    expect(loreBudgets(short)).toEqual(loreBudgets(long));
  });

  it("a missing lore line keeps the region with maxLines 0 but the same geometry", () => {
    const withLore = composePosterLayout(model(3, { lore: () => "a line" }));
    const withoutLore = composePosterLayout(model(3));
    expect(geometryKey(withLore.regions)).toBe(geometryKey(withoutLore.regions));
    const lore = withoutLore.regions.filter((r) => r.role === "entry-lore");
    expect(lore).toHaveLength(3);
    for (const region of lore) expect(region.textBudget?.maxLines).toBe(0);
  });
});

describe("posterLayoutId", () => {
  it("changes when the model id changes", () => {
    expect(posterLayoutId("poster-a")).not.toBe(posterLayoutId("poster-b"));
  });

  it("changes when the version changes", () => {
    expect(posterLayoutId("poster-a", "layout-v1")).not.toBe(
      posterLayoutId("poster-a", "layout-v2"),
    );
  });

  it("is wired into the layout and defaults to POSTER_LAYOUT_VERSION", () => {
    const layout = composePosterLayout(model(2));
    expect(layout.layoutId).toBe(posterLayoutId("poster-test-2", POSTER_LAYOUT_VERSION));
  });
});

describe("composePosterLayout — provider-safe input", () => {
  it("accepts ProviderSafeLifePosterModel and yields identical geometry", () => {
    const full = model(6, { lore: () => "lore" });
    const safe = providerSafePosterModel(full);
    const fromFull = composePosterLayout(full);
    const fromSafe = composePosterLayout(safe);
    expect(JSON.stringify(fromSafe)).toBe(JSON.stringify(fromFull));
  });

  it("never reads userNote (a note on the model does not change the layout)", () => {
    const withNote = model(3);
    withNote.entries = withNote.entries.map((e) => ({ ...e, userNote: "SECRET" }));
    const without = model(3);
    expect(JSON.stringify(composePosterLayout(withNote))).toBe(
      JSON.stringify(composePosterLayout(without)),
    );
  });
});

describe("truncateToBudget", () => {
  it.each<[string, string, { maxLines: number; maxCharsPerLine: number }, string[], boolean]>([
    [
      "word boundary drops the tail",
      "hello world foo bar",
      { maxLines: 1, maxCharsPerLine: 11 },
      ["hello world…"],
      true,
    ],
    [
      "exact fit is not truncated",
      "hello world",
      { maxLines: 1, maxCharsPerLine: 11 },
      ["hello world"],
      false,
    ],
    [
      "two lines without overflow",
      "aaa bbb ccc",
      { maxLines: 2, maxCharsPerLine: 7 },
      ["aaa bbb", "ccc"],
      false,
    ],
    [
      "over-long word is hard-split then ellipsised",
      "abcdefghij",
      { maxLines: 1, maxCharsPerLine: 4 },
      ["abcd…"],
      true,
    ],
    [
      "Turkish letters are kept intact",
      "şğüıİöç",
      { maxLines: 1, maxCharsPerLine: 3 },
      ["şğü…"],
      true,
    ],
    ["emoji is not split", "👨‍👩‍👧‍👦 ab", { maxLines: 1, maxCharsPerLine: 2 }, ["👨‍👩‍👧‍👦…"], true],
    ["empty stays empty", "", { maxLines: 2, maxCharsPerLine: 10 }, [], false],
    ["whitespace stays empty", "   \n\t ", { maxLines: 2, maxCharsPerLine: 10 }, [], false],
    ["zero lines yields nothing", "hi", { maxLines: 0, maxCharsPerLine: 10 }, [], true],
  ])("%s", (_label, text, budget, lines, truncated) => {
    expect(truncateToBudget(text, budget)).toEqual({ lines, truncated });
  });

  it("never throws on a very long single word", () => {
    const word = "z".repeat(100000);
    expect(() => truncateToBudget(word, { maxLines: 3, maxCharsPerLine: 20 })).not.toThrow();
    const result = truncateToBudget(word, { maxLines: 3, maxCharsPerLine: 20 });
    expect(result.truncated).toBe(true);
    expect(result.lines).toHaveLength(3);
  });

  it("keeps every emitted line within the char budget (except the ellipsis line)", () => {
    const text = "one two three four five six seven eight nine ten";
    const { lines } = truncateToBudget(text, { maxLines: 4, maxCharsPerLine: 12 });
    for (const line of lines.slice(0, -1)) expect(line.length).toBeLessThanOrEqual(12);
  });
});

describe("golden — 3-entry layout", () => {
  it("matches the frozen geometry + budgets", () => {
    const layout = composePosterLayout(model(3, { lore: () => "A lore line" }));
    expect(
      layout.regions.map(
        (r) =>
          `${r.role}|${r.box.x},${r.box.y},${r.box.w},${r.box.h}|${
            r.textBudget ? `${r.textBudget.maxLines}x${r.textBudget.maxCharsPerLine}` : "-"
          }`,
      ),
    ).toMatchInlineSnapshot(`
      [
        "title|120,120,1808,223|2x21",
        "subtitle|120,375,1808,105|2x53",
        "footer|120,2802,1808,150|1x100",
        "entry-backdrop|136,528,1776,386|-",
        "entry-stage|120,914,1808,57|1x68",
        "entry-song|120,981,1808,57|2x57",
        "entry-artist|120,1048,1808,57|1x75",
        "entry-year|120,1115,1808,57|1x79",
        "entry-lore|120,1182,1808,57|2x88",
        "entry-backdrop|136,1291,1776,386|-",
        "entry-stage|120,1677,1808,57|1x68",
        "entry-song|120,1744,1808,57|2x57",
        "entry-artist|120,1811,1808,57|1x75",
        "entry-year|120,1878,1808,57|1x79",
        "entry-lore|120,1945,1808,57|2x88",
        "entry-backdrop|136,2054,1776,386|-",
        "entry-stage|120,2440,1808,57|1x68",
        "entry-song|120,2507,1808,57|2x57",
        "entry-artist|120,2574,1808,57|1x75",
        "entry-year|120,2641,1808,57|1x79",
        "entry-lore|120,2708,1808,57|2x88",
      ]
    `);
  });
});
