/**
 * Life Poster — deterministic DRAW PLAN (task P0-3, docs/architecture/CINEMATIC_LIFE_POSTER.md §8.3).
 *
 * Pure module: no canvas context, no DOM, no network, no LLM, no randomness,
 * no `Date`. It turns a `PosterLayout` (P0-2) + a `LifePosterModel` (P0-1) +
 * an injected backdrop asset resolver into an ordered `DrawCommand[]`. The
 * canvas layer (`posterCanvas.ts`) is the only place that touches a real
 * `CanvasRenderingContext2D`.
 *
 * Design rules honoured here:
 *   - TEXT IS DRAWN ONLY HERE. Backdrops are textless; every string on the
 *     poster (stage label, song, artist, year, lore, title/subtitle/footer)
 *     comes from code, never from an image.
 *   - Every text region is wrapped with the layout's `truncateToBudget` budget.
 *   - Legibility: a `gradientScrim` is emitted immediately under every text
 *     zone (scrim → text ordering).
 *   - MISSING DATA IS NEVER INVENTED: a null release year omits the year text,
 *     a null/blank lore line omits the lore text, a blank artist is omitted.
 *   - The user note is NEVER read: the input is the model or its provider-safe
 *     projection, and `userNote` is never touched. The plan JSON therefore
 *     cannot contain the note.
 *   - Colour tokens come from the EXISTING mood palettes (`resolveCardVars`,
 *     which reads `cardThemeV3`); no palette is invented here.
 *   - The backdrop image is chosen by the EXISTING decade-aware registry
 *     (`resolveBackdrop` + `backdropUrlByRef`), injected via `PosterAssets` so
 *     this module stays free of the `import.meta.glob` registry.
 */
import { resolveCardVars } from "@/lib/art/cardThemeV3";
import { hexToRgb } from "@/components/scene/scenePalettes";
import { RENDER_LABELS } from "@/lib/soundmap/masterPosterContent";
import type { LifePosterModel, PosterEntry, ProviderSafeLifePosterModel } from "./posterModel";
import {
  truncateToBudget,
  type LayoutBox,
  type PosterLayout,
  type PosterRegion,
} from "./posterLayout";

/** Draw-plan version. Bumping it invalidates any cached plan. */
export const POSTER_DRAW_PLAN_VERSION = "draw-v1";

/** Font tokens (family/weight/style). The canvas layer maps these to px sizes. */
export type FontToken = "display" | "title" | "body" | "label" | "lore";

export const POSTER_FONT_TOKENS: Record<
  FontToken,
  { family: string; weight: number; italic: boolean }
> = {
  display: { family: "Cinzel, Georgia, serif", weight: 700, italic: false },
  title: { family: "Cinzel, Georgia, serif", weight: 600, italic: false },
  body: { family: "Inter, 'Helvetica Neue', sans-serif", weight: 500, italic: false },
  label: { family: "Inter, 'Helvetica Neue', sans-serif", weight: 600, italic: false },
  lore: { family: "Inter, 'Helvetica Neue', sans-serif", weight: 400, italic: true },
};

/** Text alignment token. */
export type TextAlign = "left" | "center" | "right";

/** Scrim gradient direction (dark→transparent). */
export type ScrimDirection = "to-top" | "to-bottom";

/** One ordered draw instruction. */
export type DrawCommand =
  | { kind: "rect"; box: LayoutBox; fill: string }
  | {
      kind: "image";
      src: string;
      box: LayoutBox;
      fit: "cover";
      focal: { x: number; y: number };
    }
  | { kind: "gradientScrim"; box: LayoutBox; from: string; to: string; direction: ScrimDirection }
  | {
      kind: "text";
      lines: string[];
      box: LayoutBox;
      font: FontToken;
      align: TextAlign;
      colour: string;
    }
  | { kind: "line"; box: LayoutBox; colour: string; width: number };

export type PosterDrawPlan = {
  version: string;
  layoutId: string;
  canvas: { width: number; height: number };
  commands: DrawCommand[];
};

/** A resolved backdrop asset: the key the canvas layer loads + an optional focal point. */
export type BackdropAsset = { src: string; focal?: { x: number; y: number } };

/** Injected backdrop resolver — keeps this module free of the asset glob registry. */
export type PosterAssets = {
  /** Backdrop asset for an entry, or null when none resolves (base fill stays). */
  backdropFor: (entry: PosterEntry) => BackdropAsset | null;
};

/** The frame text (title/subtitle/footer), resolved from existing labels only. */
export type PosterFrameText = { title: string; subtitle: string; footer: string };

function localeOf(language: string): "tr" | "en" {
  return language.toLowerCase().startsWith("tr") ? "tr" : "en";
}

/** Frame text from the EXISTING `RENDER_LABELS` (no invented copy). */
export function buildPosterFrameText(model: { generatedFromLanguage: string }): PosterFrameText {
  const labels = RENDER_LABELS[localeOf(model.generatedFromLanguage)];
  return { title: labels.sealSlogan, subtitle: labels.title, footer: labels.sealSub };
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function intersect(a: LayoutBox, b: LayoutBox): LayoutBox {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}

/** Pad a box on every side, clamped to the canvas rect. */
function paddedInside(box: LayoutBox, pad: number, canvas: LayoutBox): LayoutBox {
  return intersect(
    { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 },
    canvas,
  );
}

/** Per-entry colour tokens, taken from the existing mood palette (cardThemeV3). */
function entryTokens(entry: PosterEntry) {
  const { vars, backdrop } = resolveCardVars(entry.genre, entry.mood);
  return {
    text: vars["--text"],
    sub: vars["--sub"],
    accent: vars["--accent"],
    base: backdrop || "#0b0b10",
  };
}

const SCRIM_PAD = 16;

/** A scrim + (non-empty) text command pair for one text region. */
function scrimAndText(
  region: PosterRegion,
  lines: string[],
  tokens: { base: string; text: string; sub: string; accent: string },
  font: FontToken,
  align: TextAlign,
  colour: string,
  canvas: LayoutBox,
): DrawCommand[] {
  if (lines.length === 0) return [];
  const scrimBox = paddedInside(region.box, SCRIM_PAD, canvas);
  return [
    {
      kind: "gradientScrim",
      box: scrimBox,
      from: rgba(tokens.base, 0.86),
      to: rgba(tokens.base, 0),
      direction: "to-top",
    },
    { kind: "text", lines, box: region.box, font, align, colour },
  ];
}

function textLines(region: PosterRegion, value: string | null | undefined): string[] {
  const budget = region.textBudget;
  if (!budget) return [];
  return truncateToBudget(typeof value === "string" ? value : "", budget).lines;
}

function entryCommands(
  regions: PosterRegion[],
  entry: PosterEntry,
  tokens: { base: string; text: string; sub: string; accent: string },
  asset: BackdropAsset | null,
  canvas: LayoutBox,
): DrawCommand[] {
  const backdrop = regions.find((r) => r.role === "entry-backdrop");
  const commands: DrawCommand[] = [];

  // Solid base first — if the image fails to load the poster is still painted.
  if (backdrop) commands.push({ kind: "rect", box: backdrop.box, fill: tokens.base });
  if (backdrop && asset) {
    commands.push({
      kind: "image",
      src: asset.src,
      box: backdrop.box,
      fit: "cover",
      focal: asset.focal ?? { x: 0.5, y: 0.5 },
    });
  }

  const stage = regions.find((r) => r.role === "entry-stage");
  if (stage) {
    commands.push(
      ...scrimAndText(
        stage,
        textLines(stage, entry.stageTitle),
        tokens,
        "label",
        "left",
        tokens.accent,
        canvas,
      ),
    );
  }

  const song = regions.find((r) => r.role === "entry-song");
  if (song) {
    commands.push(
      ...scrimAndText(
        song,
        textLines(song, entry.track.title),
        tokens,
        "title",
        "left",
        tokens.text,
        canvas,
      ),
    );
  }

  const artist = regions.find((r) => r.role === "entry-artist");
  if (artist) {
    const lines = textLines(artist, entry.track.artist);
    commands.push(...scrimAndText(artist, lines, tokens, "body", "left", tokens.sub, canvas));
  }

  const year = regions.find((r) => r.role === "entry-year");
  if (year && entry.releaseYear !== null) {
    const lines = textLines(year, String(entry.releaseYear));
    commands.push(...scrimAndText(year, lines, tokens, "label", "left", tokens.sub, canvas));
  }

  const lore = regions.find((r) => r.role === "entry-lore");
  if (lore) {
    const lines = textLines(lore, entry.loreLine);
    commands.push(...scrimAndText(lore, lines, tokens, "lore", "left", tokens.sub, canvas));
  }

  // A deterministic separator under each entry (uses the entry accent).
  if (backdrop) {
    commands.push({
      kind: "line",
      box: { x: backdrop.box.x, y: backdrop.box.y + backdrop.box.h + 6, w: backdrop.box.w, h: 2 },
      colour: tokens.accent,
      width: 2,
    });
  }
  return commands;
}

function frameCommands(
  regions: PosterRegion[],
  frame: PosterFrameText,
  tokens: { base: string; text: string; sub: string; accent: string },
  canvas: LayoutBox,
): DrawCommand[] {
  const commands: DrawCommand[] = [];
  const title = regions.find((r) => r.role === "title");
  if (title) {
    commands.push(
      ...scrimAndText(
        title,
        textLines(title, frame.title),
        tokens,
        "display",
        "center",
        tokens.text,
        canvas,
      ),
    );
  }
  const subtitle = regions.find((r) => r.role === "subtitle");
  if (subtitle) {
    commands.push(
      ...scrimAndText(
        subtitle,
        textLines(subtitle, frame.subtitle),
        tokens,
        "body",
        "center",
        tokens.sub,
        canvas,
      ),
    );
  }
  const footer = regions.find((r) => r.role === "footer");
  if (footer) {
    commands.push({
      kind: "line",
      box: { x: footer.box.x, y: footer.box.y - 12, w: footer.box.w, h: 2 },
      colour: tokens.accent,
      width: 2,
    });
    commands.push(
      ...scrimAndText(
        footer,
        textLines(footer, frame.footer),
        tokens,
        "label",
        "center",
        tokens.sub,
        canvas,
      ),
    );
  }
  return commands;
}

/** Global frame tokens: from the first entry's palette, else a neutral mood. */
function frameTokens(entries: PosterEntry[]) {
  return entries.length > 0 ? entryTokens(entries[0]) : entryTokens(emptyNeutralEntry());
}

function emptyNeutralEntry(): PosterEntry {
  return {
    cardIndex: 0,
    stageTitle: "",
    track: { provider: "manual", providerId: "", title: "", artist: "" },
    releaseYear: null,
    period: null,
    mood: null,
    genre: null,
    decade: null,
    loreLine: null,
    userNote: null,
    noteForProvider: false,
  };
}

/**
 * Build the deterministic draw plan. Geometry comes from `layout`; text from the
 * model; backdrops from the injected `assets`. Never reads `userNote`.
 */
export function buildPosterDrawPlan(
  layout: PosterLayout,
  model: LifePosterModel | ProviderSafeLifePosterModel,
  assets: PosterAssets,
): PosterDrawPlan {
  const canvas: LayoutBox = { x: 0, y: 0, w: layout.canvas.width, h: layout.canvas.height };
  const entries = model.entries as PosterEntry[];
  const globalTokens = frameTokens(entries);
  const frame = buildPosterFrameText(model);

  const commands: DrawCommand[] = [
    // Full-canvas base fill: the poster is never blank, even with zero entries.
    { kind: "rect", box: canvas, fill: globalTokens.base },
  ];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const regions = layout.regions.filter((r) => r.entryIndex === i);
    commands.push(
      ...entryCommands(regions, entry, entryTokens(entry), assets.backdropFor(entry), canvas),
    );
  }

  commands.push(...frameCommands(layout.regions, frame, globalTokens, canvas));

  return {
    version: POSTER_DRAW_PLAN_VERSION,
    layoutId: layout.layoutId,
    canvas: { width: layout.canvas.width, height: layout.canvas.height },
    commands,
  };
}
