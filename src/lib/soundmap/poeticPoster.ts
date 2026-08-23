/**
 * High-resolution PNG export for the Dynamic Music Map — the gothic map.
 *
 * Canvas-only renderer (no extra dependency, no DOM rasterization) at
 * 2400x3600. The layout mirrors the reference "MUSIC MAP — SOUNDTRACK OF A
 * LIFE" architecture: a central Tree of Life whose four main branches carry
 * the chapter portals (gothic arches framing album artwork), a multi-colored
 * emotional journey line with named nodes, a multi-column life playlist and
 * philosophical closing quotes. Every color comes from the PoeticAnalysis
 * visual spec; all randomized geometry is seed-deterministic.
 */
import {
  JOURNEY_NODE_LABELS,
  TREE_BRANCH_LABELS,
  type PoeticAnalysis,
  type VisualSpec,
} from "@/lib/llm/poetic-analyzer";
import type { Song } from "@/lib/song/types";
import { feedEntryIntensity, type LifeFeedEntry } from "@/lib/life-feed";
import { EXTRAS_BY_THEME } from "@/lib/soundmap/dynamicThemes";

const W = 2400;
const H = 3600;
const MARGIN = 170;
const CONTENT_W = W - MARGIN * 2;

type PosterExtras = {
  frame: string;
  waveGradient: [string, string];
  texture: string;
  auraGlow: string;
};

function posterExtras(visual: VisualSpec): PosterExtras {
  const fallback = EXTRAS_BY_THEME[visual.themeId];
  return {
    frame: visual.frame ?? fallback?.frame ?? "hairline",
    waveGradient:
      visual.waveGradient ?? ([visual.palette.accent, visual.palette.primary] as [string, string]),
    texture: visual.texture ?? fallback?.texture ?? "nebula",
    auraGlow: visual.auraGlow ?? fallback?.auraGlow ?? visual.palette.accent,
  };
}

/** Localized canvas labels (defaults = English, dictionaries override). */
export type PosterLabels = {
  mapTitle: string;
  mapSubtitle: string;
  emotionalJourney: string;
  lifePlaylist: string;
  treeBranches: string[];
  journeyNodes: string[];
  moreOnMap: string;
};

export const DEFAULT_POSTER_LABELS: PosterLabels = {
  mapTitle: "MUSIC MAP",
  mapSubtitle: "SOUNDTRACK OF A LIFE",
  emotionalJourney: "EMOTIONAL JOURNEY",
  lifePlaylist: "MY LIFE PLAYLIST",
  treeBranches: [...TREE_BRANCH_LABELS],
  journeyNodes: [...JOURNEY_NODE_LABELS],
  moreOnMap: "more on your living map",
};

/* -------------------------------------------------------------------------- */
/* Pure helpers (exported for tests)                                          */
/* -------------------------------------------------------------------------- */

/** Deterministic PRNG (mulberry32) — tree, textures, jitter stay reproducible. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type TreeSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  depth: number;
};

/** Main-branch targets: up-left, up-right, left, right (MIND/POWER/DARKNESS/ACCEPTANCE). */
const MAIN_BRANCH_TARGETS = [
  { dx: -0.26, dy: -0.62 },
  { dx: 0.26, dy: -0.62 },
  { dx: -0.4, dy: -0.32 },
  { dx: 0.4, dy: -0.32 },
] as const;

/**
 * Procedural Tree of Life: recursive branch segments with deterministic
 * jitter. Returns trunk + branch segments; `mainEnds[i]` is the endpoint of
 * the i-th main branch (label anchor).
 */
export function buildTree(
  seed: number,
  cx: number,
  baseY: number,
  height: number,
): { segments: TreeSegment[]; mainEnds: { x: number; y: number }[] } {
  const rng = seededRandom(seed);
  const segments: TreeSegment[] = [];
  const mainEnds: { x: number; y: number }[] = [];

  // Trunk.
  const trunkTop = baseY - height * 0.34;
  segments.push({ x1: cx, y1: baseY, x2: cx, y2: trunkTop, width: 30, depth: 0 });

  const grow = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number,
    depth: number,
  ): void => {
    segments.push({ x1, y1, x2, y2, width, depth });
    if (depth >= 3 || width < 2.5) return;
    const dx = x2 - x1;
    const dy = y2 - y1;
    for (let f = 0; f < 2; f++) {
      const spread = (f === 0 ? -1 : 1) * (0.32 + rng() * 0.3);
      const nx = x2 + dx * 0.55 * Math.cos(spread) - dy * 0.55 * Math.sin(spread);
      const ny = y2 + dx * 0.55 * Math.sin(spread) + dy * 0.55 * Math.cos(spread);
      grow(x2, y2, nx, ny, width * 0.62, depth + 1);
    }
  };
  for (const target of MAIN_BRANCH_TARGETS) {
    const endX = cx + target.dx * height;
    const endY = trunkTop + (target.dy + 0.34) * height;
    mainEnds.push({ x: endX, y: endY });
    grow(cx, trunkTop, endX, endY, 16, 1);
  }
  return { segments, mainEnds };
}

/** Map intensities (0..1) onto waveform points within a bounding box. */
export function buildWaveformPoints(
  intensities: number[],
  box: { x: number; y: number; width: number; height: number },
  maxIntensity: number,
): { x: number; y: number }[] {
  if (intensities.length === 0) return [];
  const max = Math.max(maxIntensity, 0.01);
  return intensities.map((intensity, i) => ({
    x: box.x + (i / Math.max(intensities.length - 1, 1)) * box.width,
    y: box.y + box.height - (intensity / max) * box.height,
  }));
}

/** Per-node colors interpolating the waveform gradient stops (multi-colored line). */
export function nodeColors(count: number, from: string, to: string): string[] {
  const parse = (hex: string): [number, number, number] => {
    const m = hex.replace("#", "");
    const full =
      m.length === 3
        ? m
            .split("")
            .map((c) => c + c)
            .join("")
        : m;
    const int = Number.parseInt(full, 16);
    if (Number.isNaN(int)) return [214, 168, 74];
    return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
  };
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  return Array.from({ length: count }, (_, i) => {
    const t = count <= 1 ? 0 : i / (count - 1);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  });
}

/** How many Life Feed rows fit a remaining pixel budget (rest = "+N more"). */
export function fitFeedRows(
  count: number,
  availablePx: number,
  rowPx: number,
): { shown: number; hidden: number } {
  const shown = Math.min(count, Math.max(0, Math.floor(availablePx / rowPx)));
  return { shown, hidden: count - shown };
}

/* -------------------------------------------------------------------------- */
/* Painting helpers                                                           */
/* -------------------------------------------------------------------------- */

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const full =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m;
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int)) return `rgba(214,168,74,${alpha})`;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Shorten a single line with an ellipsis until it fits maxWidth. */
function fitLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t}…`;
}

/** Uppercase tracked (letter-spaced) centered text. */
function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing = "8px",
): void {
  ctx.letterSpacing = spacing;
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.letterSpacing = "0px";
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

const FONT_BY_TYPOGRAPHY: Record<string, string> = {
  "blackletter-display": "'Cinzel', Georgia, serif",
  "neon-chrome": "'Plus Jakarta Sans', 'Segoe UI', sans-serif",
  "elegant-serif": "'Playfair Display', Georgia, serif",
  "handwritten-warm": "'Playfair Display', Georgia, serif",
  "bold-grotesque": "'Inter', 'Helvetica Neue', sans-serif",
  "cinematic-serif": "'Cinzel', Georgia, serif",
};

function displayFont(visual: VisualSpec): string {
  return FONT_BY_TYPOGRAPHY[visual.typography] ?? "'Cinzel', Georgia, serif";
}

/* -------------------------------------------------------------------------- */
/* Background atmospheres                                                     */
/* -------------------------------------------------------------------------- */

function drawTexture(
  ctx: CanvasRenderingContext2D,
  extras: PosterExtras,
  palette: VisualSpec["palette"],
): void {
  const rng = seededRandom(0x51f2a7);
  ctx.save();
  switch (extras.texture) {
    case "smoke": {
      for (let i = 0; i < 26; i++) {
        const x = rng() * W;
        const y = rng() * H * 0.65;
        const r = 120 + rng() * 420;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, hexToRgba(palette.primary, 0.025 + rng() * 0.035));
        g.addColorStop(1, hexToRgba(palette.primary, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      break;
    }
    case "grid": {
      const horizon = H * 0.45;
      ctx.strokeStyle = hexToRgba(palette.accent, 0.07);
      ctx.lineWidth = 2;
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const bottomX = t * W;
        ctx.beginPath();
        ctx.moveTo(W / 2 + (bottomX - W / 2) * 0.02, horizon);
        ctx.lineTo(bottomX, H);
        ctx.stroke();
      }
      let y = horizon + 30;
      let step = 14;
      while (y < H) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        y += step;
        step *= 1.12;
      }
      break;
    }
    case "silk": {
      for (let i = 0; i < 4; i++) {
        const band = ctx.createLinearGradient(0, 0, W, H);
        band.addColorStop(0, hexToRgba(palette.primary, 0));
        band.addColorStop(0.5, hexToRgba(palette.primary, 0.05));
        band.addColorStop(1, hexToRgba(palette.primary, 0));
        ctx.fillStyle = band;
        ctx.save();
        ctx.translate(rng() * W, 0);
        ctx.rotate((Math.PI / 5) * (rng() - 0.5));
        ctx.fillRect(-W / 2, -H / 2, W * 2, H * 2);
        ctx.restore();
      }
      break;
    }
    case "paper": {
      ctx.fillStyle = hexToRgba(palette.text, 0.03);
      for (let i = 0; i < 900; i++) {
        ctx.fillRect(rng() * W, rng() * H, 2, 2);
      }
      break;
    }
    case "gloss": {
      for (let i = 0; i < 3; i++) {
        const start = rng() * 0.8;
        const band = ctx.createLinearGradient(start * W, 0, (start + 0.3) * W, H);
        band.addColorStop(0, "rgba(255,255,255,0)");
        band.addColorStop(0.5, "rgba(255,255,255,0.05)");
        band.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = band;
        ctx.fillRect(0, 0, W, H);
      }
      break;
    }
    default: {
      // nebula
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = hexToRgba(palette.text, 0.05 + rng() * 0.3);
        ctx.beginPath();
        ctx.arc(rng() * W, rng() * H, rng() * 1.8 + 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 5; i++) {
        const x = rng() * W;
        const y = rng() * H;
        const r = 100 + rng() * 260;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, hexToRgba(palette.accent, 0.05));
        g.addColorStop(1, hexToRgba(palette.accent, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      break;
    }
  }
  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* Frame styles                                                               */
/* -------------------------------------------------------------------------- */

function drawFrame(
  ctx: CanvasRenderingContext2D,
  extras: PosterExtras,
  palette: VisualSpec["palette"],
): void {
  const x = 96;
  const y = 96;
  const w = W - 192;
  const h = H - 192;
  ctx.save();
  switch (extras.frame) {
    case "arch": {
      const rise = 190;
      for (const [offset, alpha, lineWidth] of [
        [0, 0.55, 7],
        [34, 0.3, 3],
      ] as const) {
        ctx.strokeStyle = hexToRgba(palette.primary, alpha);
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(x + offset, y + h - offset);
        ctx.lineTo(x + offset, y + rise);
        ctx.quadraticCurveTo(x + w * 0.07 + offset, y - 40 - offset, W / 2, y - 40 - offset);
        ctx.quadraticCurveTo(W - x - w * 0.07 - offset, y - 40 - offset, W - x - offset, y + rise);
        ctx.lineTo(W - x - offset, y + h - offset);
        ctx.closePath();
        ctx.stroke();
      }
      break;
    }
    case "double-rule": {
      ctx.strokeStyle = hexToRgba(palette.primary, 0.5);
      ctx.lineWidth = 8;
      ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = hexToRgba(palette.accent, 0.4);
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 32, y + 32, w - 64, h - 64);
      break;
    }
    case "rough-edge": {
      const rng = seededRandom(0xc0ffee);
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = hexToRgba(palette.primary, pass === 0 ? 0.4 : 0.25);
        ctx.lineWidth = pass === 0 ? 5 : 2;
        ctx.beginPath();
        ctx.moveTo(x + (rng() - 0.5) * 10, y + (rng() - 0.5) * 10);
        ctx.lineTo(x + w + (rng() - 0.5) * 10, y + (rng() - 0.5) * 10);
        ctx.lineTo(x + w + (rng() - 0.5) * 10, y + h + (rng() - 0.5) * 10);
        ctx.lineTo(x + (rng() - 0.5) * 10, y + h + (rng() - 0.5) * 10);
        ctx.closePath();
        ctx.stroke();
      }
      break;
    }
    case "neon-glow": {
      for (const [lineWidth, alpha] of [
        [16, 0.12],
        [8, 0.25],
        [3, 0.7],
      ] as const) {
        ctx.strokeStyle = hexToRgba(palette.accent, alpha);
        ctx.lineWidth = lineWidth;
        ctx.strokeRect(x, y, w, h);
      }
      break;
    }
    case "hairline": {
      ctx.strokeStyle = hexToRgba(palette.primary, 0.35);
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = hexToRgba(palette.accent, 0.75);
      ctx.lineWidth = 5;
      const t = 46;
      for (const [cx, cy, sx, sy] of [
        [x, y, 1, 1],
        [x + w, y, -1, 1],
        [x, y + h, 1, -1],
        [x + w, y + h, -1, -1],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(cx + sx * t, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + sy * t);
        ctx.stroke();
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* Gothic arch portal (chapter artwork frame)                                 */
/* -------------------------------------------------------------------------- */

function archPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  // Pointed gothic arch: vertical jambs rising into two wings meeting at apex.
  const spring = y + h * 0.42; // where the arch curve begins
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, spring);
  ctx.quadraticCurveTo(x + w * 0.08, y, x + w / 2, y);
  ctx.quadraticCurveTo(x + w * 0.92, y, x + w, spring);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function drawPortal(
  ctx: CanvasRenderingContext2D,
  palette: VisualSpec["palette"],
  x: number,
  y: number,
  w: number,
  h: number,
  image: HTMLImageElement | null,
  accent: string,
): void {
  // Artwork (or dark fill) clipped to the arch silhouette.
  ctx.save();
  archPath(ctx, x, y, w, h);
  ctx.clip();
  if (image) {
    // Cover-fit the artwork into the arch box.
    const scale = Math.max(w / image.width, h / image.height);
    const iw = image.width * scale;
    const ih = image.height * scale;
    ctx.drawImage(image, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    // Gothic vignette over the artwork.
    const vignette = ctx.createLinearGradient(x, y, x, y + h);
    vignette.addColorStop(0, hexToRgba(palette.background, 0.05));
    vignette.addColorStop(1, hexToRgba(palette.background, 0.45));
    ctx.fillStyle = vignette;
    ctx.fillRect(x, y, w, h);
  } else {
    const fill = ctx.createLinearGradient(x, y, x, y + h);
    fill.addColorStop(0, hexToRgba(palette.primary, 0.12));
    fill.addColorStop(1, hexToRgba(palette.background, 0.55));
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    // Vinyl placeholder disc.
    ctx.strokeStyle = hexToRgba(palette.primary, 0.6);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.55, w * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.55, w * 0.07, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // Arch outline: double stone ribs.
  for (const [inset, alpha, lineWidth] of [
    [0, 0.75, 5],
    [12, 0.35, 2.5],
  ] as const) {
    ctx.strokeStyle = hexToRgba(accent, alpha);
    ctx.lineWidth = lineWidth;
    archPath(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2);
    ctx.stroke();
  }
  // Keystone diamond at the apex.
  ctx.save();
  ctx.translate(x + w / 2, y - 2);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = accent;
  ctx.fillRect(-8, -8, 16, 16);
  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* Artwork preloading (CORS-safe; never blocks the export on failure)         */
/* -------------------------------------------------------------------------- */

function loadArtwork(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 6000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

/* -------------------------------------------------------------------------- */
/* The gothic map itself                                                      */
/* -------------------------------------------------------------------------- */

function renderMap(
  canvas: HTMLCanvasElement,
  analysis: PoeticAnalysis,
  songs: Song[],
  feedEntries: LifeFeedEntry[],
  labels: PosterLabels,
  artwork: (HTMLImageElement | null)[],
): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { palette } = analysis.visual;
  const extras = posterExtras(analysis.visual);
  const display = displayFont(analysis.visual);
  const auraColor = extras.auraGlow;
  const songAt = (i: number): Song | undefined => songs[i - 1];
  const songTitle = (i: number) => songAt(i)?.title ?? `Untitled track ${i}`;
  const branchLabel = (i: number) => labels.treeBranches[i] ?? TREE_BRANCH_LABELS[i] ?? "";
  const nodeLabel = (i: number) => labels.journeyNodes[i] ?? JOURNEY_NODE_LABELS[i] ?? "";

  // 1. Underpainting: base wash + aura glows + theme texture + frame.
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, W, H);
  const glowTop = ctx.createRadialGradient(W / 2, 500, 0, W / 2, 500, 1900);
  glowTop.addColorStop(0, hexToRgba(palette.primary, 0.2));
  glowTop.addColorStop(0.5, hexToRgba(auraColor, 0.09));
  glowTop.addColorStop(1, hexToRgba(palette.background, 0));
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, W, H);
  const glowBottom = ctx.createRadialGradient(W / 2, H - 640, 0, W / 2, H - 640, 1500);
  glowBottom.addColorStop(0, hexToRgba(auraColor, 0.12));
  glowBottom.addColorStop(1, hexToRgba(palette.background, 0));
  ctx.fillStyle = glowBottom;
  ctx.fillRect(0, 0, W, H);
  drawTexture(ctx, extras, palette);
  drawFrame(ctx, extras, palette);

  // 2. Header: map title + subtitle + manifesto.
  ctx.textAlign = "center";
  let y = MARGIN + 90;
  ctx.font = `700 92px ${display}`;
  ctx.fillStyle = palette.primary;
  tracked(ctx, labels.mapTitle, W / 2, y, "14px");
  y += 62;
  ctx.font = "500 30px Inter, sans-serif";
  ctx.fillStyle = hexToRgba(palette.accent, 0.9);
  tracked(ctx, labels.mapSubtitle, W / 2, y, "10px");
  y += 96;
  ctx.font = `italic 700 54px ${display}`;
  ctx.fillStyle = palette.text;
  for (const line of wrapText(ctx, `“${analysis.manifesto}”`, CONTENT_W - 200).slice(0, 4)) {
    ctx.fillText(line, W / 2, y);
    y += 70;
  }

  // 3. Tree of Life with four named main branches.
  const treeTop = y + 30;
  const treeHeight = 640;
  const treeBase = treeTop + treeHeight;
  const { segments, mainEnds } = buildTree(0xbeef42, W / 2, treeBase, treeHeight);
  for (const seg of segments) {
    ctx.strokeStyle = hexToRgba(
      palette.primary,
      seg.depth === 0 ? 0.85 : Math.max(0.2, 0.7 - seg.depth * 0.16),
    );
    ctx.lineWidth = seg.width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
  }
  // Branch labels at the four main branch endpoints.
  ctx.font = `700 30px ${display}`;
  mainEnds.forEach((end, i) => {
    const left = end.x < W / 2;
    ctx.textAlign = left ? "right" : "left";
    ctx.fillStyle = hexToRgba(palette.accent, 0.95);
    ctx.fillText(branchLabel(i).toUpperCase(), end.x + (left ? -18 : 18), end.y + 8);
  });
  ctx.textAlign = "center";
  // Root glow at the trunk base.
  const rootGlow = ctx.createRadialGradient(W / 2, treeBase, 0, W / 2, treeBase, 260);
  rootGlow.addColorStop(0, hexToRgba(auraColor, 0.22));
  rootGlow.addColorStop(1, hexToRgba(auraColor, 0));
  ctx.fillStyle = rootGlow;
  ctx.fillRect(W / 2 - 260, treeBase - 260, 520, 520);

  // 4. Chapter portals: gothic arches (artwork inside) around the tree roots.
  const chapters = analysis.chapters.slice(0, 6);
  if (chapters.length > 0) {
    const portalZoneY = treeBase + 110;
    const cols = Math.min(3, chapters.length);
    const gap = 44;
    const pw = (CONTENT_W - gap * (cols - 1)) / cols;
    const ph = pw * 1.34;
    const rows = Math.ceil(chapters.length / cols);
    chapters.forEach((chapter, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const px = MARGIN + col * (pw + gap);
      const py = portalZoneY + row * (ph + 150);
      const firstIndex = chapter.songIndexes[0];
      drawPortal(ctx, palette, px, py, pw, ph, artwork[firstIndex - 1] ?? null, palette.primary);
      // Era tag + chapter title + songs under the arch.
      ctx.textAlign = "center";
      ctx.font = `700 30px ${display}`;
      ctx.fillStyle = palette.primary;
      ctx.fillText(fitLine(ctx, chapter.title.toUpperCase(), pw), px + pw / 2, py + ph + 46);
      ctx.font = "500 24px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.accent, 0.9);
      ctx.fillText(`${chapter.ageRange} · ${chapter.mood}`, px + pw / 2, py + ph + 82);
      ctx.font = "500 24px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.text, 0.7);
      const titles = chapter.songIndexes.map((idx) => songTitle(idx)).join("  ·  ");
      ctx.fillText(fitLine(ctx, titles, pw), px + pw / 2, py + ph + 118);
    });
    y = portalZoneY + rows * (ph + 150) + 20;
  } else {
    y = treeBase + 130;
  }

  // 5. Emotional journey — multi-colored signal line with named nodes.
  const curve = [
    ...analysis.emotionalCurve.map((point) => point.intensity),
    ...feedEntries.map((entry) => feedEntryIntensity(entry)),
  ];
  if (curve.length > 0) {
    ctx.font = "600 26px Inter, sans-serif";
    ctx.fillStyle = hexToRgba(palette.text, 0.55);
    tracked(ctx, labels.emotionalJourney, W / 2, y + 10);
    const panelY = y + 50;
    const panelH = 340;
    ctx.strokeStyle = hexToRgba(palette.primary, 0.25);
    ctx.fillStyle = hexToRgba(palette.background, 0.55);
    ctx.lineWidth = 2;
    roundRectPath(ctx, MARGIN, panelY, CONTENT_W, panelH, 28);
    ctx.fill();
    ctx.stroke();
    const box = { x: MARGIN + 80, y: panelY + 56, width: CONTENT_W - 160, height: 170 };
    const maxI = Math.max(...curve, 0.01);
    const points = buildWaveformPoints(curve, box, maxI);
    const colors = nodeColors(curve.length, extras.waveGradient[0], extras.waveGradient[1]);
    // Smoothed path (midpoint quadratic curves).
    const path = new Path2D();
    if (points.length === 1) {
      path.moveTo(points[0].x, points[0].y);
      path.lineTo(points[0].x + 1, points[0].y);
    } else {
      path.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cpx = (prev.x + curr.x) / 2;
        path.quadraticCurveTo(cpx, prev.y, curr.x, curr.y);
      }
    }
    ctx.strokeStyle = hexToRgba(auraColor, 0.16);
    ctx.lineWidth = 14;
    ctx.stroke(path);
    // Multi-colored: stroke each segment with its node color.
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      ctx.strokeStyle = hexToRgba(colors[i], 0.95);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.quadraticCurveTo(cpx, prev.y, curr.x, curr.y);
      ctx.stroke();
    }
    const baseCount = analysis.emotionalCurve.length;
    points.forEach((point, i) => {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(palette.background, 0.9);
      ctx.lineWidth = 2;
      ctx.stroke();
      // Node label: journey nodes for the base 8, "+N" for feed entries.
      ctx.font = "500 22px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.text, 0.6);
      const label = i < baseCount ? nodeLabel(i) : `+${i - baseCount + 1}`;
      ctx.fillText(label, point.x, panelY + panelH - 34);
    });
    y = panelY + panelH + 70;
  }

  // 6. My Life Playlist — multi-column table with insights.
  if (analysis.songInsights.length > 0) {
    ctx.font = "600 26px Inter, sans-serif";
    ctx.fillStyle = hexToRgba(palette.text, 0.55);
    tracked(ctx, labels.lifePlaylist, W / 2, y + 10);
    y += 60;
    const colGap = 60;
    const colW = (CONTENT_W - colGap) / 2;
    const rowH = 96;
    analysis.songInsights.forEach((insight, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const rx = MARGIN + col * (colW + colGap);
      const ry = y + row * (rowH + 18);
      const entry = songAt(insight.index);
      ctx.strokeStyle = hexToRgba(palette.primary, 0.2);
      ctx.fillStyle = hexToRgba(palette.text, 0.03);
      ctx.lineWidth = 2;
      roundRectPath(ctx, rx, ry, colW, rowH, 18);
      ctx.fill();
      ctx.stroke();
      // Mini arch marker + number.
      ctx.strokeStyle = hexToRgba(palette.accent, 0.8);
      ctx.lineWidth = 2.5;
      archPath(ctx, rx + 22, ry + 22, 40, 52);
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.font = "500 24px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.accent, 0.85);
      ctx.fillText(String(insight.index).padStart(2, "0"), rx + 80, ry + 36);
      ctx.font = "700 29px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.text, 0.95);
      ctx.fillText(fitLine(ctx, insight.title, colW - 130), rx + 128, ry + 36);
      ctx.font = "400 24px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.text, 0.62);
      const sub = entry?.artist ? `${entry.artist} — ${insight.insight}` : insight.insight;
      ctx.fillText(fitLine(ctx, sub, colW - 130), rx + 128, ry + 72);
      ctx.textAlign = "center";
    });
    y += Math.ceil(analysis.songInsights.length / 2) * (rowH + 18) + 40;
  }

  // 7. Life Feed rows — the map beyond the original eight.
  if (feedEntries.length > 0) {
    const reserved = 420; // duality + footer.
    const budget = H - reserved - y;
    const { shown, hidden } = fitFeedRows(feedEntries.length, budget, 64);
    ctx.textAlign = "left";
    for (const [i, entry] of feedEntries.slice(0, shown).entries()) {
      const lineH = 52;
      ctx.strokeStyle = hexToRgba(palette.primary, 0.16);
      ctx.fillStyle = hexToRgba(palette.text, 0.03);
      roundRectPath(ctx, MARGIN, y, CONTENT_W, lineH, 14);
      ctx.fill();
      ctx.stroke();
      ctx.font = "500 24px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.accent, 0.85);
      ctx.fillText(`+${i + 1}`, MARGIN + 36, y + 35);
      ctx.font = "600 27px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.text, 0.92);
      ctx.fillText(fitLine(ctx, entry.song.title, CONTENT_W - 620), MARGIN + 104, y + 35);
      ctx.font = "400 24px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.text, 0.55);
      const sub = entry.song.artist || entry.note || "Life Feed entry";
      ctx.fillText(fitLine(ctx, sub, 440), MARGIN + CONTENT_W - 470, y + 35);
      y += lineH + 10;
    }
    if (hidden > 0) {
      ctx.font = "400 24px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.text, 0.5);
      ctx.fillText(`+${hidden} ${labels.moreOnMap}`, MARGIN + 36, y + 34);
      y += 52;
    }
    ctx.textAlign = "center";
    y += 16;
  }

  // 8. Core duality — closing panel.
  const dualityBg = ctx.createLinearGradient(MARGIN, y, W - MARGIN, y + 300);
  dualityBg.addColorStop(0, hexToRgba(palette.primary, 0.08));
  dualityBg.addColorStop(1, hexToRgba(palette.accent, 0.08));
  ctx.strokeStyle = hexToRgba(palette.accent, 0.35);
  ctx.fillStyle = dualityBg;
  ctx.lineWidth = 2;
  roundRectPath(ctx, MARGIN, y, CONTENT_W, 300, 32);
  ctx.fill();
  ctx.stroke();
  ctx.font = `800 60px ${display}`;
  const left = analysis.coreDuality.left;
  const right = analysis.coreDuality.right;
  const sep = " / ";
  const totalW =
    ctx.measureText(left).width + ctx.measureText(sep).width + ctx.measureText(right).width;
  let axisX = W / 2 - totalW / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = palette.primary;
  ctx.fillText(left, axisX, y + 110);
  axisX += ctx.measureText(left).width;
  ctx.fillStyle = hexToRgba(palette.text, 0.45);
  ctx.fillText(sep, axisX, y + 110);
  axisX += ctx.measureText(sep).width;
  ctx.fillStyle = palette.accent;
  ctx.fillText(right, axisX, y + 110);
  ctx.textAlign = "center";
  ctx.font = "400 28px Inter, sans-serif";
  ctx.fillStyle = hexToRgba(palette.text, 0.75);
  const resLines = wrapText(ctx, analysis.coreDuality.resolution, CONTENT_W - 240).slice(0, 3);
  let resY = y + 176;
  for (const line of resLines) {
    ctx.fillText(line, W / 2, resY);
    resY += 40;
  }

  // 9. Footer: aura keywords + brand line.
  ctx.font = "500 26px Inter, sans-serif";
  ctx.fillStyle = hexToRgba(palette.text, 0.5);
  ctx.fillText(analysis.visual.aura.map((a) => a.toUpperCase()).join("  •  "), W / 2, H - 176);
  ctx.font = "400 22px Inter, sans-serif";
  ctx.fillStyle = hexToRgba(palette.text, 0.4);
  ctx.fillText(`${analysis.visual.themeId} · ${analysis.visual.typography}`, W / 2, H - 140);
  ctx.font = "600 28px Inter, sans-serif";
  ctx.fillStyle = hexToRgba(palette.accent, 0.8);
  tracked(ctx, "Life in a Sound", W / 2, H - 100);
}

/**
 * Renders the analysis as a 2400x3600 gothic music map and triggers a PNG
 * download. Album artwork is preloaded (CORS-safe, 6s cap); missing artwork
 * falls back to a vinyl placeholder inside the arch — never fake data.
 */
export function exportPoeticPoster(
  analysis: PoeticAnalysis,
  songs: Song[],
  feedEntries: LifeFeedEntry[] = [],
  labels: PosterLabels = DEFAULT_POSTER_LABELS,
): void {
  const canvas = document.createElement("canvas");
  const urls = songs.map((song) => song.artworkUrl).filter((u): u is string => Boolean(u));
  if (urls.length === 0) {
    renderMap(canvas, analysis, songs, feedEntries, labels, []);
    download(canvas);
    return;
  }
  void Promise.all(songs.map((song) => (song.artworkUrl ? loadArtwork(song.artworkUrl) : null)))
    .then((artwork) => {
      renderMap(canvas, analysis, songs, feedEntries, labels, artwork);
      download(canvas);
    })
    .catch(() => {
      renderMap(canvas, analysis, songs, feedEntries, labels, []);
      download(canvas);
    });
}

function download(canvas: HTMLCanvasElement): void {
  const link = document.createElement("a");
  link.download = "soundmap-music-map.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}
