/**
 * Canvas poster renderer — turns the deterministic PosterModel (personality +
 * emotion + music) into a real poster image. Browser-only (uses Canvas 2D);
 * call it from an effect, never during SSR.
 */
import type { PosterModel } from "./types";

export type PosterSong = { title: string; artist?: string | null };

export const POSTER_WIDTH = 1400;
export const POSTER_HEIGHT = 2000;

/** Hero line: hard cap, trimmed. PII/crisis filtering happens upstream (Dilim 2). */
export function normalizeHeroText(hero: string): string {
  return hero.trim().slice(0, 90);
}

/**
 * Pure layout computation — no canvas. Returns the same coordinates the legacy
 * renderer used verbatim when `heroLines === 0` (divider +80, song list +170
 * from headlineBottom). When a hero line is present it shifts divider + song
 * list down by one hero block so the deterministic poster never collides.
 */
export type PosterLayout = {
  archetypeY: number;
  headlineTop: number;
  headlineLineHeight: number;
  headlineBottom: number;
  /** Baseline of the first hero line, or null when no hero is rendered. */
  heroFirstY: number | null;
  heroLineHeight: number;
  subtitleY: number;
  dividerY: number;
  songStartY: number;
  songStep: number;
  /** Song list must not push past this y (keywords footer). */
  songBottomLimit: number;
  keywordsY: number;
  paletteY: number;
  brandY: number;
};

export function computePosterLayout(headlineLines: number, heroLines: number): PosterLayout {
  const headlineBottom = 320 + Math.min(headlineLines, 3) * 96;
  // One hero block (line + breathing room) shifts the divider + song list down.
  const heroBlock = heroLines > 0 ? 14 + heroLines * 32 : 0;
  return {
    archetypeY: 190,
    headlineTop: 320,
    headlineLineHeight: 96,
    headlineBottom,
    heroFirstY: heroLines > 0 ? headlineBottom + 62 : null,
    heroLineHeight: 32,
    subtitleY: headlineBottom + 20,
    dividerY: headlineBottom + 80 + heroBlock,
    songStartY: headlineBottom + 170 + heroBlock,
    songStep: 110,
    songBottomLimit: POSTER_HEIGHT - 210,
    keywordsY: POSTER_HEIGHT - 190,
    paletteY: POSTER_HEIGHT - 130,
    brandY: POSTER_HEIGHT - 70,
  };
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawMotif(ctx: CanvasRenderingContext2D, model: PosterModel) {
  const { motif, glow, accent, intensity } = model.visual;
  const W = POSTER_WIDTH;
  const H = POSTER_HEIGHT;
  ctx.save();

  if (motif === "waveform") {
    const amplitude = 60 + intensity * 140;
    for (let line = 0; line < 5; line += 1) {
      ctx.beginPath();
      ctx.strokeStyle = withAlpha(accent, 0.06 + line * 0.03);
      ctx.lineWidth = 3;
      const baseY = H * 0.62 + line * 26;
      for (let x = 0; x <= W; x += 8) {
        const y = baseY + Math.sin((x / W) * Math.PI * (3 + line)) * amplitude * (1 - line * 0.12);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (motif === "orbit") {
    for (let ring = 1; ring <= 6; ring += 1) {
      ctx.beginPath();
      ctx.strokeStyle = withAlpha(glow, 0.05 + intensity * 0.06);
      ctx.lineWidth = 2;
      ctx.ellipse(W / 2, H * 0.35, ring * 130, ring * 90, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (motif === "grid") {
    ctx.strokeStyle = withAlpha(glow, 0.05 + intensity * 0.05);
    ctx.lineWidth = 2;
    for (let x = 0; x <= W; x += 70) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 70) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  } else {
    // rays
    ctx.translate(W / 2, H * 0.28);
    for (let i = 0; i < 24; i += 1) {
      ctx.rotate((Math.PI * 2) / 24);
      ctx.beginPath();
      ctx.strokeStyle = withAlpha(accent, 0.03 + intensity * 0.07);
      ctx.lineWidth = 10;
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -H * 0.75);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/** Draws the full poster onto an existing canvas element. */
export function renderPoster(
  canvas: HTMLCanvasElement,
  model: PosterModel,
  songs: PosterSong[],
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = POSTER_WIDTH;
  canvas.height = POSTER_HEIGHT;

  const v = model.visual;
  const W = POSTER_WIDTH;
  const H = POSTER_HEIGHT;

  ctx.fillStyle = v.background;
  ctx.fillRect(0, 0, W, H);

  drawMotif(ctx, model);

  const halo = ctx.createRadialGradient(W / 2, H * 0.22, 0, W / 2, H * 0.22, W);
  halo.addColorStop(0, withAlpha(v.glow, 0.16 + v.intensity * 0.22));
  halo.addColorStop(0.55, withAlpha(v.accent, 0.06));
  halo.addColorStop(1, withAlpha(v.background, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";

  // Archetype eyebrow
  ctx.fillStyle = v.textMuted;
  ctx.font = "600 30px Inter, sans-serif";
  ctx.fillText(model.archetype.toUpperCase(), W / 2, 190);

  // Headline with the personality-driven gradient
  const radians = (v.gradientAngle * Math.PI) / 180;
  const dx = (Math.cos(radians) * W) / 2;
  const dy = (Math.sin(radians) * 200) / 2;
  const titleGradient = ctx.createLinearGradient(W / 2 - dx, 300 - dy, W / 2 + dx, 300 + dy);
  titleGradient.addColorStop(0, v.accent);
  titleGradient.addColorStop(1, v.accentSoft);
  ctx.fillStyle = titleGradient;

  const words = model.headline.split(" ");
  const lines: string[] = [];
  let current = "";
  ctx.font = "800 78px Inter, sans-serif";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > W - 260 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  lines.slice(0, 3).forEach((line, i) => {
    ctx.fillText(line, W / 2, 320 + i * 96);
  });

  const headlineLines = lines.length;

  // Hero line wrapping (≤2 lines) — only when hero is set; undefined => none.
  const hero = model.hero ? normalizeHeroText(model.hero) : "";
  const heroLines = hero ? wrapHero(ctx, hero, W - 260).length : 0;

  const layout = computePosterLayout(headlineLines, heroLines);

  // Mood subheadline
  ctx.fillStyle = v.text;
  ctx.font = "500 36px Inter, sans-serif";
  ctx.fillText(model.subheadline, W / 2, layout.subtitleY);

  // Hero line — subtle, under the mood. Drawn only when present.
  if (heroLines > 0 && layout.heroFirstY !== null) {
    ctx.fillStyle = withAlpha(v.accent, 0.85);
    ctx.font = "500 26px Inter, sans-serif";
    const heroLinesSplit = wrapHero(ctx, hero, W - 260);
    heroLinesSplit.slice(0, 2).forEach((line, i) => {
      ctx.fillText(line, W / 2, layout.heroFirstY! + i * layout.heroLineHeight);
    });
  }

  // Divider
  ctx.strokeStyle = withAlpha(v.accent, 0.4);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(200, layout.dividerY);
  ctx.lineTo(W - 200, layout.dividerY);
  ctx.stroke();

  // Song list
  ctx.textAlign = "left";
  let y = layout.songStartY;
  songs.slice(0, 8).forEach((song, i) => {
    ctx.fillStyle = withAlpha(v.accent, 0.7);
    ctx.font = "700 28px Inter, sans-serif";
    ctx.fillText(String(i + 1).padStart(2, "0"), 200, y);

    ctx.fillStyle = v.text;
    ctx.font = "700 40px Inter, sans-serif";
    ctx.fillText(song.title, 280, y);

    if (song.artist) {
      ctx.fillStyle = v.textMuted;
      ctx.font = "500 30px Inter, sans-serif";
      ctx.fillText(song.artist, 280, y + 44);
    }
    y += 110;
  });

  // Keywords footer
  ctx.textAlign = "center";
  ctx.fillStyle = v.textMuted;
  ctx.font = "500 30px Inter, sans-serif";
  ctx.fillText(model.keywords.join("  •  "), W / 2, H - 190);

  ctx.fillStyle = withAlpha(v.accent, 0.8);
  ctx.font = "600 28px Inter, sans-serif";
  ctx.fillText(model.paletteLabel, W / 2, H - 130);

  ctx.fillStyle = v.textMuted;
  ctx.font = "500 26px Inter, sans-serif";
  ctx.fillText("LIFE IN A SOUND", W / 2, H - 70);
}

/** Word-wrap within a max width; returns up to 2 lines (hero is a headline helper). */
function wrapHero(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  let current = "";
  text.split(" ").forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      out.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) out.push(current);
  return out.slice(0, 2);
}

/** Renders the poster off-screen and returns a PNG data URL. */
export function posterToDataUrl(model: PosterModel, songs: PosterSong[]): string | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  renderPoster(canvas, model, songs);
  return canvas.toDataURL("image/png");
}
