/**
 * High-resolution PNG export for the Dynamic Music Map poster.
 *
 * Canvas-only renderer (no extra dependency, no DOM rasterization) — mirrors
 * the approach of `poster.ts`, but every color comes from the PoeticAnalysis
 * visual spec instead of hardcoded brand values.
 */
import type { PoeticAnalysis, VisualSpec } from "@/lib/llm/poetic-analyzer";
import type { Song } from "@/lib/song/types";
import { feedEntryIntensity, type LifeFeedEntry } from "@/lib/life-feed";
import { EXTRAS_BY_THEME } from "@/lib/soundmap/dynamicThemes";
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

/**
 * Renders the analysis as a 1600x2400 poster and triggers a PNG download.
 * No-op when a 2D context cannot be created.
 */
const FONT_BY_TYPOGRAPHY: Record<string, string> = {
  "blackletter-display": "'Cinzel', Georgia, serif",
  "neon-chrome": "'Plus Jakarta Sans', 'Segoe UI', sans-serif",
  "elegant-serif": "'Playfair Display', Georgia, serif",
  "handwritten-warm": "'Playfair Display', Georgia, serif",
  "bold-grotesque": "'Inter', 'Helvetica Neue', sans-serif",
  "cinematic-serif": "'Cinzel', Georgia, serif",
};

export function exportPoeticPoster(
  analysis: PoeticAnalysis,
  songs: Song[],
  feedEntries: LifeFeedEntry[] = [],
): void {
  const W = 2400;
  const H = 3600;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { palette, aura } = analysis.visual;
  const song = (i: number) => songs[i - 1]?.title ?? `Untitled track ${i}`;

  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, W, H);

  const extras = posterExtras(analysis.visual);
  const display = FONT_BY_TYPOGRAPHY[analysis.visual.typography] ?? "'Cinzel', Georgia, serif";
  const auraColor = extras.auraGlow ?? palette.accent;

  // Glowing aura circles (top + bottom) matching the on-screen radial glow.
  const glowTop = ctx.createRadialGradient(W / 2, 390, 0, W / 2, 390, 1950);
  glowTop.addColorStop(0, hexToRgba(palette.primary, 0.24));
  glowTop.addColorStop(0.5, hexToRgba(auraColor, 0.1));
  glowTop.addColorStop(1, hexToRgba(palette.background, 0));
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, W, H);

  const glowBottom = ctx.createRadialGradient(W / 2, H - 600, 0, W / 2, H - 600, 1500);
  glowBottom.addColorStop(0, hexToRgba(auraColor, 0.14));
  glowBottom.addColorStop(1, hexToRgba(palette.background, 0));
  ctx.fillStyle = glowBottom;
  ctx.fillRect(0, 0, W, H);

  // Frame border per theme (arch / double-rule / neon glow / hairline).
  ctx.strokeStyle = hexToRgba(palette.primary, extras.frame === "hairline" ? 0.35 : 0.5);
  ctx.lineWidth = extras.frame === "double-rule" ? 10 : 6;
  if (extras.frame !== "none") {
    ctx.strokeRect(90, 90, W - 180, H - 180);
  }
  if (extras.frame === "double-rule") {
    ctx.strokeStyle = hexToRgba(palette.accent, 0.4);
    ctx.lineWidth = 3;
    ctx.strokeRect(120, 120, W - 240, H - 240);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = hexToRgba(palette.accent, 0.9);
  ctx.font = "600 34px Inter, sans-serif";
  ctx.fillText("L I F E   I N   A   S O U N D", W / 2, 220);

  // Manifesto (wrapped, centered).
  ctx.fillStyle = palette.text;
  ctx.font = "italic 700 64px Georgia, serif";
  let y = 330;
  for (const line of wrapText(ctx, `“${analysis.manifesto}”`, W - 320).slice(0, 4)) {
    ctx.fillText(line, W / 2, y);
    y += 84;
  }

  ctx.strokeStyle = hexToRgba(palette.primary, 0.5);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(240, y + 20);
  ctx.lineTo(W - 240, y + 20);
  ctx.stroke();
  y += 120;

  // Emotional curve — the base 8 plus every Life Feed entry.
  const curve = [
    ...analysis.emotionalCurve,
    ...feedEntries.map((entry) => ({ intensity: feedEntryIntensity(entry) })),
  ];
  if (curve.length > 0) {
    const baseY = y + 200;
    const step = (W - 480) / curve.length;
    const baseCount = analysis.emotionalCurve.length;
    curve.forEach((point, i) => {
      const barH = Math.max(16, point.intensity * 180);
      const x = 240 + step * i + step / 2;
      ctx.fillStyle =
        i < baseCount ? hexToRgba(palette.primary, 0.85) : hexToRgba(palette.accent, 0.85);
      ctx.fillRect(x - 18, baseY - barH, 36, barH);
      ctx.fillStyle = hexToRgba(palette.text, 0.55);
      ctx.font = "500 24px Inter, sans-serif";
      ctx.fillText(i < baseCount ? String(i + 1) : `+${i - baseCount + 1}`, x, baseY + 44);
    });
    y = baseY + 120;
  }

  // Chapters.
  ctx.textAlign = "left";
  for (const chapter of analysis.chapters.slice(0, 4)) {
    ctx.fillStyle = hexToRgba(palette.text, 0.05);
    ctx.fillRect(200, y - 56, W - 400, 240);
    ctx.fillStyle = palette.primary;
    ctx.font = "700 40px Inter, sans-serif";
    ctx.fillText(chapter.title, 248, y);
    ctx.fillStyle = hexToRgba(palette.accent, 0.9);
    ctx.font = "500 28px Inter, sans-serif";
    ctx.fillText(chapter.mood.toUpperCase(), 248, y + 44);
    ctx.fillStyle = palette.text;
    ctx.font = "600 34px Inter, sans-serif";
    const chapterSongs = chapter.songIndexes.map((i) => `“${song(i)}”`).join("  ·  ");
    for (const [offset, line] of wrapText(ctx, chapterSongs, W - 496)
      .slice(0, 2)
      .entries()) {
      ctx.fillText(line, 248, y + 96 + offset * 44);
    }
    y += 280;
  }

  // Core duality.
  ctx.textAlign = "center";
  ctx.fillStyle = hexToRgba(palette.text, 0.6);
  ctx.font = "600 28px Inter, sans-serif";
  ctx.fillText("C O R E   D U A L I T Y", W / 2, y + 30);
  ctx.fillStyle = palette.primary;
  ctx.font = "800 72px Georgia, serif";
  ctx.fillText(analysis.coreDuality.axis, W / 2, y + 116);
  y += 210;

  // Footer: aura keywords.
  ctx.fillStyle = hexToRgba(palette.text, 0.5);
  ctx.font = "500 30px Inter, sans-serif";
  ctx.fillText(aura.map((a) => a.toUpperCase()).join("  •  "), W / 2, H - 120);

  const link = document.createElement("a");
  link.download = "soundmap-music-map.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}
