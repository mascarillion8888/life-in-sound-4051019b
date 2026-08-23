/**
 * High-resolution PNG export for the Dynamic Music Map poster.
 *
 * Canvas-only renderer (no extra dependency, no DOM rasterization) at
 * 2400x3600. Every color, frame, background texture and typography decision
 * comes from the PoeticAnalysis visual spec (theme palette + dynamic extras),
 * and all randomized geometry is seed-deterministic so repeated exports of
 * the same analysis produce identical files.
 */
import type { PoeticAnalysis, VisualSpec } from "@/lib/llm/poetic-analyzer";
import type { Song } from "@/lib/song/types";
import { feedEntryIntensity, type LifeFeedEntry } from "@/lib/life-feed";
import { EXTRAS_BY_THEME } from "@/lib/soundmap/dynamicThemes";

const W = 2400;
const H = 3600;
/** Content margin — the frame sits at FRAME_INSET, content inside MARGIN. */
const FRAME_INSET = 96;
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

/* -------------------------------------------------------------------------- */
/* Pure helpers (exported for tests)                                          */
/* -------------------------------------------------------------------------- */

/** Deterministic PRNG (mulberry32) — textures/rough frames stay reproducible. */
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
/* Background atmospheres (one per dynamic theme texture)                     */
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
/* Frame styles (arch / double-rule / rough-edge / neon-glow / hairline)       */
/* -------------------------------------------------------------------------- */

function drawFrame(
  ctx: CanvasRenderingContext2D,
  extras: PosterExtras,
  palette: VisualSpec["palette"],
): void {
  const x = FRAME_INSET;
  const y = FRAME_INSET;
  const w = W - FRAME_INSET * 2;
  const h = H - FRAME_INSET * 2;
  ctx.save();
  switch (extras.frame) {
    case "arch": {
      // Pointed gothic arch — two quadratic wings meeting at an apex.
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
      // Hand-torn double pass: the rect is re-stroked with jittered corners.
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
      // Corner ticks in accent.
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
/* The poster itself                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Renders the analysis as a 2400x3600 high-DPI poster and triggers a PNG
 * download. No-op when a 2D context cannot be created.
 */
export function exportPoeticPoster(
  analysis: PoeticAnalysis,
  songs: Song[],
  feedEntries: LifeFeedEntry[] = [],
): void {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { palette, aura } = analysis.visual;
  const extras = posterExtras(analysis.visual);
  const display = displayFont(analysis.visual);
  const auraColor = extras.auraGlow;
  const songAt = (i: number): Song | undefined => songs[i - 1];
  const songTitle = (i: number) => songAt(i)?.title ?? `Untitled track ${i}`;

  // 1. Underpainting: base wash + dual aura glows + theme texture.
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, W, H);
  const glowTop = ctx.createRadialGradient(W / 2, 420, 0, W / 2, 420, 2000);
  glowTop.addColorStop(0, hexToRgba(palette.primary, 0.22));
  glowTop.addColorStop(0.5, hexToRgba(auraColor, 0.1));
  glowTop.addColorStop(1, hexToRgba(palette.background, 0));
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, W, H);
  const glowBottom = ctx.createRadialGradient(W / 2, H - 560, 0, W / 2, H - 560, 1500);
  glowBottom.addColorStop(0, hexToRgba(auraColor, 0.13));
  glowBottom.addColorStop(1, hexToRgba(palette.background, 0));
  ctx.fillStyle = glowBottom;
  ctx.fillRect(0, 0, W, H);
  drawTexture(ctx, extras, palette);
  drawFrame(ctx, extras, palette);

  let y = MARGIN + 60;

  // 2. Header: brand eyebrow.
  ctx.textAlign = "center";
  ctx.font = "600 34px Inter, sans-serif";
  ctx.fillStyle = hexToRgba(palette.accent, 0.9);
  tracked(ctx, "Life in a Sound", W / 2, y);

  // 3. Manifesto: the hero quote.
  y += 110;
  ctx.font = `italic 700 62px ${display}`;
  ctx.fillStyle = palette.text;
  const manifestoLines = wrapText(ctx, `“${analysis.manifesto}”`, CONTENT_W - 160).slice(0, 5);
  for (const line of manifestoLines) {
    ctx.fillText(line, W / 2, y);
    y += 80;
  }

  // 4. Aura chips.
  y += 44;
  ctx.font = "500 24px Inter, sans-serif";
  const chips = aura.slice(0, 4).map((keyword) => {
    const label = keyword.toUpperCase();
    const width = ctx.measureText(label).width + 64;
    return { label, width };
  });
  let chipX = W / 2 - (chips.reduce((sum, c) => sum + c.width, 0) + (chips.length - 1) * 28) / 2;
  for (const chip of chips) {
    ctx.strokeStyle = hexToRgba(palette.accent, 0.35);
    ctx.fillStyle = hexToRgba(palette.accent, 0.1);
    ctx.lineWidth = 2;
    roundRectPath(ctx, chipX, y - 34, chip.width, 56, 28);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = hexToRgba(palette.primary, 0.95);
    ctx.fillText(chip.label, chipX + chip.width / 2, y + 5);
    chipX += chip.width + 28;
  }

  // 5. Life-phase roadmap strip (up to 4 chapters across).
  y += 100;
  const roadmapChapters = analysis.chapters.slice(0, 4);
  if (roadmapChapters.length > 0) {
    ctx.font = "600 24px Inter, sans-serif";
    ctx.fillStyle = hexToRgba(palette.text, 0.45);
    tracked(ctx, "Life-Phase Roadmap", W / 2, y);
    const cols = roadmapChapters.length;
    const gap = 36;
    const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
    const cardH = 190;
    roadmapChapters.forEach((chapter, i) => {
      const cx = MARGIN + i * (cardW + gap);
      ctx.strokeStyle = hexToRgba(palette.primary, 0.25);
      ctx.fillStyle = hexToRgba(palette.text, 0.04);
      ctx.lineWidth = 2;
      roundRectPath(ctx, cx, y + 24, cardW, cardH, 24);
      ctx.fill();
      ctx.stroke();
      ctx.font = `700 30px ${display}`;
      ctx.fillStyle = palette.primary;
      ctx.fillText(fitLine(ctx, chapter.title.toUpperCase(), cardW - 48), cx + cardW / 2, y + 80);
      ctx.font = "500 26px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.accent, 0.9);
      ctx.fillText(chapter.ageRange, cx + cardW / 2, y + 126);
      ctx.font = "500 22px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.text, 0.5);
      ctx.fillText(chapter.mood.toUpperCase(), cx + cardW / 2, y + 168);
    });
    y += 24 + cardH;
  }

  // 6. Narrative chapters — a 2x2 grid of editorial cards.
  y += 90;
  ctx.font = "600 26px Inter, sans-serif";
  ctx.fillStyle = hexToRgba(palette.text, 0.55);
  tracked(ctx, "Narrative Chapters", W / 2, y);
  y += 40;
  const gridGap = 52;
  const cardW2 = (CONTENT_W - gridGap) / 2;
  const posterChapters = analysis.chapters.slice(0, 4);
  const rows: (typeof posterChapters)[] = [];
  for (let i = 0; i < posterChapters.length; i += 2) {
    rows.push(posterChapters.slice(i, i + 2));
  }
  for (const row of rows) {
    // Height is driven by the tallest card in the row.
    const heights = row.map((chapter) => {
      ctx.font = "400 30px Inter, sans-serif";
      const narrativeLines = wrapText(ctx, chapter.narrative, cardW2 - 96).slice(0, 4).length;
      return 96 + chapter.songIndexes.length * 40 + narrativeLines * 44 + 40;
    });
    const rowH = Math.max(...heights);
    row.forEach((chapter, i) => {
      const cx = MARGIN + i * (cardW2 + gridGap);
      ctx.strokeStyle = hexToRgba(palette.primary, 0.28);
      ctx.fillStyle = hexToRgba(palette.text, 0.05);
      ctx.lineWidth = 2;
      roundRectPath(ctx, cx, y, cardW2, rowH, 28);
      ctx.fill();
      ctx.stroke();
      // Diamond ornament + chapter title.
      const titleY = y + 62;
      ctx.save();
      ctx.translate(cx + 60, titleY - 10);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = palette.accent;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.restore();
      ctx.textAlign = "left";
      ctx.font = `700 34px ${display}`;
      ctx.fillStyle = palette.primary;
      ctx.fillText(fitLine(ctx, chapter.title.toUpperCase(), cardW2 - 160), cx + 84, titleY);
      ctx.font = "500 25px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.accent, 0.9);
      ctx.fillText(`${chapter.ageRange} · ${chapter.mood}`, cx + 60, titleY + 44);
      // Numbered songs listed in the chapter.
      ctx.font = "600 29px Inter, sans-serif";
      let songY = titleY + 96;
      for (const index of chapter.songIndexes) {
        ctx.fillStyle = hexToRgba(palette.accent, 0.85);
        ctx.fillText(String(index).padStart(2, "0"), cx + 60, songY);
        ctx.fillStyle = hexToRgba(palette.text, 0.92);
        ctx.fillText(fitLine(ctx, songTitle(index), cardW2 - 176), cx + 128, songY);
        songY += 40;
      }
      // Narrative paragraph.
      ctx.font = "400 30px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.text, 0.78);
      const lines = wrapText(ctx, chapter.narrative, cardW2 - 96).slice(0, 4);
      let narrativeY = songY + 18;
      for (const line of lines) {
        ctx.fillText(line, cx + 60, narrativeY);
        narrativeY += 44;
      }
      ctx.textAlign = "center";
    });
    y += rowH + gridGap;
  }

  // 7. Emotional timeline — a smoothed waveform panel.
  const curve = [
    ...analysis.emotionalCurve.map((point) => point.intensity),
    ...feedEntries.map((entry) => feedEntryIntensity(entry)),
  ];
  if (curve.length > 0) {
    ctx.font = "600 26px Inter, sans-serif";
    ctx.fillStyle = hexToRgba(palette.text, 0.55);
    tracked(ctx, "Emotional Timeline", W / 2, y + 10);
    const panelY = y + 50;
    const panelH = 320;
    ctx.strokeStyle = hexToRgba(palette.primary, 0.25);
    ctx.fillStyle = hexToRgba(palette.background, 0.55);
    ctx.lineWidth = 2;
    roundRectPath(ctx, MARGIN, panelY, CONTENT_W, panelH, 28);
    ctx.fill();
    ctx.stroke();
    const box = { x: MARGIN + 80, y: panelY + 56, width: CONTENT_W - 160, height: 180 };
    const maxI = Math.max(...curve, 0.01);
    const points = buildWaveformPoints(curve, box, maxI);
    // Smoothed path through the points (midpoint quadratic curves).
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
    ctx.strokeStyle = hexToRgba(auraColor, 0.18);
    ctx.lineWidth = 14;
    ctx.stroke(path);
    const gradient = ctx.createLinearGradient(box.x, 0, box.x + box.width, 0);
    gradient.addColorStop(0, extras.waveGradient[0]);
    gradient.addColorStop(1, extras.waveGradient[1]);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 5;
    ctx.stroke(path);
    const baseCount = analysis.emotionalCurve.length;
    points.forEach((point, i) => {
      ctx.fillStyle = i < baseCount ? palette.accent : palette.primary;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "500 24px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.text, 0.55);
      ctx.fillText(
        i < baseCount ? String(i + 1).padStart(2, "0") : `+${i - baseCount + 1}`,
        point.x,
        panelY + panelH - 40,
      );
    });
    y = panelY + panelH + 80;
  }

  // 8. The eight tracks — numbered playlist with one-line insights.
  if (analysis.songInsights.length > 0) {
    ctx.font = "600 26px Inter, sans-serif";
    ctx.fillStyle = hexToRgba(palette.text, 0.55);
    tracked(ctx, "The Eight Tracks", W / 2, y + 10);
    y += 60;
    for (const insight of analysis.songInsights) {
      const entry = songAt(insight.index);
      const lineH = 104;
      ctx.strokeStyle = hexToRgba(palette.primary, 0.2);
      ctx.fillStyle = hexToRgba(palette.text, 0.03);
      ctx.lineWidth = 2;
      roundRectPath(ctx, MARGIN, y, CONTENT_W, lineH, 20);
      ctx.fill();
      ctx.stroke();
      // Vinyl placeholder: concentric disc with a spindle dot.
      const discX = MARGIN + 58;
      const discY = y + lineH / 2;
      ctx.strokeStyle = hexToRgba(palette.primary, 0.7);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(discX, discY, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(discX, discY, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = hexToRgba(palette.primary, 0.9);
      ctx.beginPath();
      ctx.arc(discX, discY, 3, 0, Math.PI * 2);
      ctx.fill();
      // Number + title + artist.
      ctx.textAlign = "left";
      ctx.font = "500 26px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.accent, 0.85);
      ctx.fillText(String(insight.index).padStart(2, "0"), MARGIN + 112, y + 40);
      ctx.font = "700 33px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.text, 0.95);
      ctx.fillText(fitLine(ctx, insight.title, CONTENT_W - 220), MARGIN + 172, y + 40);
      if (entry?.artist) {
        ctx.font = "500 25px Inter, sans-serif";
        ctx.fillStyle = hexToRgba(palette.accent, 0.9);
        ctx.fillText(fitLine(ctx, entry.artist, CONTENT_W - 220), MARGIN + 172, y + 72);
      }
      ctx.font = "400 27px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.text, 0.7);
      ctx.fillText(fitLine(ctx, insight.insight, CONTENT_W - 220), MARGIN + 172, y + lineH - 24);
      ctx.textAlign = "center";
      y += lineH + 22;
    }
  }

  // 9. Life Feed rows — the map beyond the original eight.
  if (feedEntries.length > 0) {
    ctx.font = "600 26px Inter, sans-serif";
    ctx.fillStyle = hexToRgba(palette.text, 0.55);
    tracked(ctx, "Life Feed — Still Growing", W / 2, y + 10);
    y += 60;
    const reserved = 520; // duality panel + footer.
    const budget = H - reserved - y;
    const { shown, hidden } = fitFeedRows(feedEntries.length, budget, 68);
    ctx.textAlign = "left";
    for (const [i, entry] of feedEntries.slice(0, shown).entries()) {
      const lineH = 56;
      ctx.strokeStyle = hexToRgba(palette.primary, 0.18);
      ctx.fillStyle = hexToRgba(palette.text, 0.03);
      roundRectPath(ctx, MARGIN, y, CONTENT_W, lineH, 16);
      ctx.fill();
      ctx.stroke();
      ctx.font = "500 26px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.accent, 0.85);
      ctx.fillText(`+${i + 1}`, MARGIN + 40, y + 38);
      ctx.font = "600 29px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.text, 0.92);
      ctx.fillText(fitLine(ctx, entry.song.title, CONTENT_W - 620), MARGIN + 110, y + 37);
      ctx.font = "400 26px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.text, 0.55);
      const sub = entry.song.artist || entry.note || "Life Feed entry";
      ctx.fillText(fitLine(ctx, sub, 460), MARGIN + CONTENT_W - 490, y + 37);
      y += lineH + 12;
    }
    if (hidden > 0) {
      ctx.font = "400 26px Inter, sans-serif";
      ctx.fillStyle = hexToRgba(palette.text, 0.5);
      ctx.fillText(`+${hidden} more on your living map`, MARGIN + 40, y + 36);
      y += 56;
    }
    ctx.textAlign = "center";
    y += 20;
  }

  // 10. Core duality — closing panel.
  const dualityBg = ctx.createLinearGradient(MARGIN, y, W - MARGIN, y + 330);
  dualityBg.addColorStop(0, hexToRgba(palette.primary, 0.08));
  dualityBg.addColorStop(1, hexToRgba(palette.accent, 0.08));
  ctx.strokeStyle = hexToRgba(palette.accent, 0.35);
  ctx.fillStyle = dualityBg;
  ctx.lineWidth = 2;
  roundRectPath(ctx, MARGIN, y, CONTENT_W, 330, 32);
  ctx.fill();
  ctx.stroke();
  ctx.font = "600 26px Inter, sans-serif";
  ctx.fillStyle = hexToRgba(palette.text, 0.6);
  tracked(ctx, "Core Duality", W / 2, y + 62);
  // Centered tri-colored axis label.
  ctx.font = `800 68px ${display}`;
  const left = analysis.coreDuality.left;
  const right = analysis.coreDuality.right;
  const sep = " / ";
  const totalW =
    ctx.measureText(left).width + ctx.measureText(sep).width + ctx.measureText(right).width;
  let axisX = W / 2 - totalW / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = palette.primary;
  ctx.fillText(left, axisX, y + 150);
  axisX += ctx.measureText(left).width;
  ctx.fillStyle = hexToRgba(palette.text, 0.45);
  ctx.fillText(sep, axisX, y + 150);
  axisX += ctx.measureText(sep).width;
  ctx.fillStyle = palette.accent;
  ctx.fillText(right, axisX, y + 150);
  ctx.textAlign = "center";
  ctx.font = "400 30px Inter, sans-serif";
  ctx.fillStyle = hexToRgba(palette.text, 0.75);
  const resLines = wrapText(ctx, analysis.coreDuality.resolution, CONTENT_W - 240).slice(0, 3);
  let resY = y + 214;
  for (const line of resLines) {
    ctx.fillText(line, W / 2, resY);
    resY += 42;
  }

  // 11. Footer: theme signature + brand line.
  ctx.font = "400 24px Inter, sans-serif";
  ctx.fillStyle = hexToRgba(palette.text, 0.45);
  ctx.fillText(`${analysis.visual.themeId} · ${analysis.visual.typography}`, W / 2, H - 170);
  ctx.font = "600 28px Inter, sans-serif";
  ctx.fillStyle = hexToRgba(palette.accent, 0.8);
  tracked(ctx, "Life in a Sound", W / 2, H - 116);

  const link = document.createElement("a");
  link.download = "soundmap-music-map.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}
