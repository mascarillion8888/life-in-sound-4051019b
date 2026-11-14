/**
 * Life Poster — deterministic LAYOUT CORE (task P0-2, docs/architecture/CINEMATIC_LIFE_POSTER.md §8.3).
 *
 * Pure functions only: no React, no canvas, no network, no LLM, no randomness,
 * no `Date`. The same `LifePosterModel` always produces byte-identical JSON
 * (stable key order) and the same `layoutId`. Geometry depends ONLY on the entry
 * count — never on text length, so a longer lore line can never move a box.
 *
 * COORDINATE CONVENTION (aligned with the existing renderers, not modified here):
 *   - `poeticPoster.ts` (2400×3600) and `MasterPosterCanvas` (1024×1536 logical,
 *     exported 2048×3072) both use a top-left origin, +x right, +y down.
 *   - We emit INTEGER canvas pixels on the 2048×3072 master (the approved size).
 *   - A uniform safe-area margin frames every region; nothing crosses it.
 *
 * The renderer (P0-3) owns fonts, colours and images — the layout only hands it
 * boxes plus, for text regions, a deterministic `textBudget` to truncate with.
 *
 * VARIANTS (chosen ONLY by entry count; region counts are asserted in the tests):
 *
 *   | entries | variant         | entry roles per entry                                   |
 *   | ------- | --------------- | ------------------------------------------------------- |
 *   | 0       | empty-state     | (none — title + footer only)                            |
 *   | 1–3     | large-stacked   | backdrop, stage, song, artist, year, [lore if any]      |
 *   | 4–8     | two-column      | backdrop, stage, song, artist, year, [lore if any]      |
 *   | 9+      | compact-grid    | backdrop, stage, song, artist, year, [lore if any]      |
 *
 *   Always present: exactly one `title`, one `subtitle`, one `footer`.
 *   `entry-backdrop` carries the mood/genre/decade of its entry (resolved by the
 *   renderer from the model); `entry-stage`/`entry-song`/`entry-artist`/`entry-year`
 *   are text; `entry-lore` appears ONLY when the entry HAS a lore line.
 *
 * LORE POLICY (documented, one rule): a missing/blank lore line OMITS the
 * `entry-lore` region entirely (consistent: it is never emitted). When a lore
 * region IS emitted its `textBudget.maxLines` reflects the variant's room.
 */
import { stableHash } from "../ai/personalityScoring";
import type { LifePosterModel, PosterEntry, ProviderSafeLifePosterModel } from "./posterModel";

/** Layout version. Bumping it invalidates every layout cache entry. */
export const POSTER_LAYOUT_VERSION = "layout-v1";

/** Box in canvas pixels — integers, top-left origin (+x right, +y down). */
export type LayoutBox = { x: number; y: number; w: number; h: number };

/** A rectangle of the canvas the composition must stay inside. */
export type LayoutSafeArea = { x: number; y: number; w: number; h: number };

/** Region roles. The renderer decides fonts/colours/images for each. */
export type PosterRegionRole =
  | "title"
  | "subtitle"
  | "entry-backdrop"
  | "entry-stage"
  | "entry-song"
  | "entry-artist"
  | "entry-year"
  | "entry-lore"
  | "footer";

/** Deterministic truncation budget handed to the renderer for text regions. */
export type TextBudget = { maxLines: number; maxCharsPerLine: number };

export type PosterRegion = {
  role: PosterRegionRole;
  box: LayoutBox;
  /** Index into `LifePosterModel.entries`, or null for title/subtitle/footer. */
  entryIndex: number | null;
  /** Present on text regions; absent on `entry-backdrop`. */
  textBudget?: TextBudget;
};

export type PosterLayoutVariant = "empty-state" | "large-stacked" | "two-column" | "compact-grid";

export type PosterLayout = {
  version: string;
  layoutId: string;
  variant: PosterLayoutVariant;
  canvas: { width: number; height: number };
  safeArea: LayoutSafeArea;
  regions: PosterRegion[];
};

/** Margin framing the safe area on the master canvas. */
const MARGIN = 120;
/** Height of the top title block (title + subtitle). */
const HEADER_H = 360;
/** Height of the bottom footer strip. */
const FOOTER_H = 150;
/** Vertical gap between stacked regions. */
const GAP = 32;
/** Inset of a backdrop box relative to its chapter cell. */
const BACKDROP_INSET = 16;
/** Fraction of a chapter cell height given to the backdrop (text fills the rest). */
const BACKDROP_RATIO = 0.55;
/** Gap between the stacked text slots inside a chapter cell. */
const TEXT_GAP = 10;
/** Typical glyph width as a fraction of font size (for char budgeting only). */
const AVG_GLYPH_RATIO = 0.6;
/** Estimated font sizes (px) used ONLY to derive text budgets, never emitted. */
const FONT_ESTIMATE = {
  title: 140,
  subtitle: 56,
  stage: 44,
  song: 52,
  artist: 40,
  year: 38,
  lore: 34,
  footer: 30,
};

/** Layout input: the full model or the provider-safe projection (no userNote). */
export type PosterLayoutInput = LifePosterModel | ProviderSafeLifePosterModel;

/** Truncation result: the lines to draw plus whether anything was dropped. */
export type TruncatedText = { lines: string[]; truncated: boolean };

/** Grapheme-safe split (never splits an emoji or a combining mark). */
function splitGraphemes(value: string): string[] {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(value), (s) => s.segment);
  }
  return Array.from(value);
}

/** Split into words while keeping their trailing whitespace (lossless for trim tests). */
function splitWords(value: string): string[] {
  return value.split(/(\s+)/).filter((part) => part.length > 0);
}

/** Split a single over-long word into grapheme chunks of at most `limit`. */
function chunkWord(word: string, limit: number): string[] {
  const graphemes = splitGraphemes(word);
  const chunks: string[] = [];
  for (let i = 0; i < graphemes.length; i += limit) {
    chunks.push(graphemes.slice(i, i + limit).join(""));
  }
  return chunks;
}

/**
 * Greedy word-boundary wrap to `budget.maxCharsPerLine`, capped at
 * `budget.maxLines`. Unicode-safe (grapheme aware); a word longer than the line
 * is hard-split; the ellipsis is appended only to the last line when content was
 * dropped. Never throws — empty/whitespace input yields `{ lines: [], truncated: false }`.
 */
export function truncateToBudget(text: string, budget: TextBudget): TruncatedText {
  const maxLines = Math.max(0, Math.floor(budget.maxLines));
  const maxChars = Math.max(1, Math.floor(budget.maxCharsPerLine));
  const normalized = typeof text === "string" ? text.trim() : "";
  if (normalized.length === 0 || maxLines === 0) {
    return { lines: [], truncated: normalized.length > 0 };
  }

  const words = splitWords(normalized);
  const lines: string[] = [];
  let current = "";
  let dropped = false;

  for (const token of words) {
    const word = token.trim();
    if (word.length === 0) continue;
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current.length > 0) {
      lines.push(current);
      current = "";
      if (lines.length >= maxLines) {
        dropped = true;
        break;
      }
    }
    if (word.length <= maxChars) {
      current = word;
    } else {
      const chunks = chunkWord(word, maxChars);
      for (let i = 0; i < chunks.length; i++) {
        if (lines.length >= maxLines) {
          dropped = true;
          break;
        }
        if (i === chunks.length - 1) {
          current = chunks[i];
        } else {
          lines.push(chunks[i]);
        }
      }
      if (dropped) break;
    }
  }
  if (!dropped && current.length > 0) {
    if (lines.length < maxLines) lines.push(current);
    else dropped = true;
  }
  if (dropped && lines.length > 0) {
    const last = lines[lines.length - 1];
    if (!last.endsWith("…")) lines[lines.length - 1] = `${last}…`;
  }
  return { lines, truncated: dropped };
}

function variantForCount(count: number): PosterLayoutVariant {
  if (count === 0) return "empty-state";
  if (count <= 3) return "large-stacked";
  if (count <= 8) return "two-column";
  return "compact-grid";
}

type Cell = { x: number; y: number; w: number; h: number };

/** Split `count` items into `columns` rows; earlier columns take the extra row. */
function rowsPerColumn(count: number, columns: number): number[] {
  const base = Math.floor(count / columns);
  const extra = count % columns;
  return Array.from({ length: columns }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Evenly divide a band into `columns` full-height columns with `GAP` between. */
function columnsInBand(band: Cell, columns: number): Cell[] {
  const colW = Math.floor((band.w - GAP * (columns - 1)) / columns);
  return Array.from({ length: columns }, (_, i) => ({
    x: band.x + i * (colW + GAP),
    y: band.y,
    w: colW,
    h: band.h,
  }));
}

/** Stack `count` equal-height cells inside a column band with `GAP` between. */
function stackCells(column: Cell, count: number): Cell[] {
  const cellH = Math.floor((column.h - GAP * (count - 1)) / count);
  return Array.from({ length: count }, (_, i) => ({
    x: column.x,
    y: column.y + i * (cellH + GAP),
    w: column.w,
    h: cellH,
  }));
}

/** Compact grid: `ceil(count / 3)` rows × 3 columns over the band. */
function gridCells(band: Cell, count: number): Cell[] {
  const columns = 3;
  const rowCount = Math.ceil(count / columns);
  const rowH = Math.floor((band.h - GAP * (rowCount - 1)) / rowCount);
  const cells: Cell[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const cellX = band.x + Math.floor((col * (band.w + GAP)) / columns);
    const cellW = Math.floor((band.w - GAP * (columns - 1)) / columns);
    cells.push({ x: cellX, y: band.y + row * (rowH + GAP), w: cellW, h: rowH });
  }
  return cells;
}

function hasLore(entry: { loreLine: string | null }): boolean {
  return typeof entry.loreLine === "string" && entry.loreLine.trim().length > 0;
}

/** Char budget from a box width and an estimated font size (floored, min 1). */
function charsFor(width: number, fontPx: number): number {
  return Math.max(1, Math.floor(width / (fontPx * AVG_GLYPH_RATIO)));
}

/** Title/subtitle/footer: fixed boxes derived only from the canvas + safe area. */
function frameRegions(safe: LayoutSafeArea, footerY: number): PosterRegion[] {
  const titleH = Math.floor(HEADER_H * 0.62);
  const subtitleH = HEADER_H - titleH - GAP;
  return [
    {
      role: "title",
      box: { x: safe.x, y: safe.y, w: safe.w, h: titleH },
      entryIndex: null,
      textBudget: { maxLines: 2, maxCharsPerLine: charsFor(safe.w, FONT_ESTIMATE.title) },
    },
    {
      role: "subtitle",
      box: { x: safe.x, y: safe.y + titleH + GAP, w: safe.w, h: subtitleH },
      entryIndex: null,
      textBudget: { maxLines: 2, maxCharsPerLine: charsFor(safe.w, FONT_ESTIMATE.subtitle) },
    },
    {
      role: "footer",
      box: { x: safe.x, y: footerY, w: safe.w, h: FOOTER_H },
      entryIndex: null,
      textBudget: { maxLines: 1, maxCharsPerLine: charsFor(safe.w, FONT_ESTIMATE.footer) },
    },
  ];
}

/** Emit the per-entry regions for a chapter cell. Geometry is count-only; the
 * lore slot is ALWAYS present, but its budget collapses to 0 lines when the
 * entry has no lore line (the documented "keep the region, budget 0" rule). */
function entryRegions(
  cell: Cell,
  entryIndex: number,
  entry: { loreLine: string | null },
  loreLines: number,
): PosterRegion[] {
  const backdropH = Math.max(1, Math.floor(cell.h * BACKDROP_RATIO));
  const bd: Cell = {
    x: cell.x + BACKDROP_INSET,
    y: cell.y + BACKDROP_INSET,
    w: cell.w - BACKDROP_INSET * 2,
    h: backdropH - BACKDROP_INSET,
  };
  const textTop = cell.y + backdropH;
  const band: Cell = { x: cell.x, y: textTop, w: cell.w, h: cell.h - backdropH };
  const units = 5;
  const slotH = Math.max(1, Math.floor((band.h - TEXT_GAP * (units - 1)) / units));
  const slot = (i: number): Cell => ({
    x: band.x,
    y: band.y + i * (slotH + TEXT_GAP),
    w: band.w,
    h: slotH,
  });

  return [
    { role: "entry-backdrop", box: bd, entryIndex },
    {
      role: "entry-stage",
      box: slot(0),
      entryIndex,
      textBudget: { maxLines: 1, maxCharsPerLine: charsFor(band.w, FONT_ESTIMATE.stage) },
    },
    {
      role: "entry-song",
      box: slot(1),
      entryIndex,
      textBudget: { maxLines: 2, maxCharsPerLine: charsFor(band.w, FONT_ESTIMATE.song) },
    },
    {
      role: "entry-artist",
      box: slot(2),
      entryIndex,
      textBudget: { maxLines: 1, maxCharsPerLine: charsFor(band.w, FONT_ESTIMATE.artist) },
    },
    {
      role: "entry-year",
      box: slot(3),
      entryIndex,
      textBudget: { maxLines: 1, maxCharsPerLine: charsFor(band.w, FONT_ESTIMATE.year) },
    },
    {
      role: "entry-lore",
      box: slot(4),
      entryIndex,
      textBudget: {
        maxLines: hasLore(entry) ? loreLines : 0,
        maxCharsPerLine: charsFor(band.w, FONT_ESTIMATE.lore),
      },
    },
  ];
}

/** Deterministic id: stableHash over the model id + the layout version. */
export function posterLayoutId(modelId: string, version: string = POSTER_LAYOUT_VERSION): string {
  return `layout-${stableHash(`${modelId}|${version}`).toString(16)}`;
}

function buildVariantRegions(
  variant: PosterLayoutVariant,
  entries: readonly { loreLine: string | null }[],
  band: Cell,
): PosterRegion[] {
  if (variant === "empty-state") return [];

  if (variant === "large-stacked") {
    const cells = stackCells(band, entries.length);
    return entries.flatMap((entry, i) => entryRegions(cells[i], i, entry, 2));
  }

  if (variant === "two-column") {
    const columns = columnsInBand(band, 2);
    const counts = rowsPerColumn(entries.length, 2);
    const regions: PosterRegion[] = [];
    let index = 0;
    for (let c = 0; c < 2; c++) {
      const cells = stackCells(columns[c], counts[c]);
      for (let r = 0; r < counts[c]; r++) {
        regions.push(...entryRegions(cells[r], index, entries[index], 1));
        index++;
      }
    }
    return regions;
  }

  const cells = gridCells(band, entries.length);
  return entries.flatMap((entry, i) => entryRegions(cells[i], i, entry, 1));
}

/**
 * Compose the deterministic layout for a poster model (or its provider-safe
 * projection). Geometry depends only on the entry count; the layout never reads
 * `userNote`, so both input shapes yield identical geometry for the same model.
 */
export function composePosterLayout(input: PosterLayoutInput): PosterLayout {
  const width = input.outputSize.width;
  const height = input.outputSize.height;
  const safeArea: LayoutSafeArea = {
    x: MARGIN,
    y: MARGIN,
    w: width - MARGIN * 2,
    h: height - MARGIN * 2,
  };
  const entries = input.entries;
  const variant = variantForCount(entries.length);

  const contentY = safeArea.y + HEADER_H + GAP;
  const footerY = safeArea.y + safeArea.h - FOOTER_H;
  const band: Cell = {
    x: safeArea.x,
    y: contentY,
    w: safeArea.w,
    h: footerY - GAP - contentY,
  };

  const regions: PosterRegion[] = [
    ...frameRegions(safeArea, footerY),
    ...buildVariantRegions(variant, entries, band),
  ];

  return {
    version: POSTER_LAYOUT_VERSION,
    layoutId: posterLayoutId(input.id, POSTER_LAYOUT_VERSION),
    variant,
    canvas: { width, height },
    safeArea,
    regions,
  };
}
