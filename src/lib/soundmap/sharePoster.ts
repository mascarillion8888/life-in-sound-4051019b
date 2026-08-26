/**
 * Social Share Poster — single-card 1080x1920 (Instagram Story) export.
 *
 * Canvas-only renderer, no DOM rasterization, same trust model as
 * poeticPoster.ts: every byte on the poster comes from the card row itself
 * (painting data URL / signed URL, lore, metadata), webfonts are awaited via
 * `document.fonts.ready` so the Cinzel/Playfair display faces survive the
 * export, and a missing painting degrades to a hand-drawn gothic placeholder
 * frame — never a broken image.
 *
 * Layout (top → bottom):
 *   - gothic vignette backdrop
 *   - the AI painting in an etched double frame (chiaroscuro border glow)
 *   - era metadata row (scene · era year · age)
 *   - the poetic 2-sentence lore in italic Playfair
 *   - song / artist / discovery-score stat block
 *   - "LifeInSound — Multiverse Soundtrack" watermark strip
 */
import type { CardRow } from "@/lib/supabase/cards-remote";

export const POSTER_W = 1080;
export const POSTER_H = 1920;

const DISPLAY_FONT = "'Cinzel', Georgia, serif";
const BODY_FONT = "'Playfair Display', Georgia, serif";
const UI_FONT = "'Inter', 'Segoe UI', sans-serif";

/** Deterministic discovery score (40–99) seeded by the track identity. */
export function discoveryScore(trackKey: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < trackKey.length; i++) {
    h ^= trackKey.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return 40 + ((h >>> 0) % 60);
}

/** Era caption, e.g. "SUMMER OF 1987 · AGE 9" — pieces omitted when unknown. */
export function eraCaption(card: CardRow): string {
  const parts: string[] = [];
  if (card.eraYear !== null) parts.push(`${card.eraYear}`);
  else if (card.releaseYear !== null) parts.push(`${card.releaseYear}`);
  if (card.encounterAge !== null) parts.push(`age ${card.encounterAge}`);
  return parts.join(" · ").toUpperCase();
}

/**
 * Greedy word-wrap for the canvas. Pure — exported for tests. Never returns
 * more than `maxLines` lines; overflow is ellipsized on the last line.
 */
export function wrapText(
  measure: (text: string) => number,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines) {
    if (current) lines.push(current);
    return lines;
  }
  // Overflow: ellipsize the final line until it fits.
  let last = lines[maxLines - 1];
  while (last.length > 1 && measure(`${last}…`) > maxWidth) {
    last = last.slice(0, -1);
  }
  lines[maxLines - 1] = `${last.replace(/\s+$/, "")}…`;
  return lines;
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
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPlaceholderPainting(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, "#171310");
  bg.addColorStop(1, "#0b0908");
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  // Candlelit arcs — the gothic placeholder motif from the card skeleton.
  ctx.strokeStyle = "rgba(216,166,90,0.35)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.62, w * 0.3, h * 0.18, 0, Math.PI, 0);
  ctx.stroke();
  ctx.strokeStyle = "rgba(216,166,90,0.18)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.62, w * 0.42, h * 0.26, 0, Math.PI, 0);
  ctx.stroke();
}

/** Render the card onto a canvas. Returns the canvas for preview/testing. */
export async function renderSharePoster(
  card: CardRow,
  canvas: HTMLCanvasElement,
  loadImage: (url: string) => Promise<HTMLImageElement | null> = defaultLoadImage,
): Promise<HTMLCanvasElement> {
  canvas.width = POSTER_W;
  canvas.height = POSTER_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  try {
    await document.fonts.ready;
  } catch {
    /* jsdom / older engines — system serif fallback still renders */
  }

  // Backdrop: deep gothic vignette.
  const bg = ctx.createRadialGradient(
    POSTER_W / 2,
    POSTER_H * 0.38,
    120,
    POSTER_W / 2,
    POSTER_H * 0.5,
    POSTER_H * 0.75,
  );
  bg.addColorStop(0, "#241d16");
  bg.addColorStop(0.55, "#141010");
  bg.addColorStop(1, "#070505");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);

  // Outer etched hairline.
  ctx.strokeStyle = "rgba(216,166,90,0.28)";
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, POSTER_W - 72, POSTER_H - 72);

  const margin = 96;
  const contentW = POSTER_W - margin * 2;

  // Scene eyebrow.
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(216,166,90,0.85)";
  ctx.font = `600 30px ${UI_FONT}`;
  ctx.fillText(card.scene.toUpperCase(), POSTER_W / 2, 132);

  // Title + artist.
  ctx.fillStyle = "#ece2c8";
  ctx.font = `700 64px ${DISPLAY_FONT}`;
  for (const [i, line] of wrapText(
    (s) => ctx.measureText(s).width,
    card.title,
    contentW,
    2,
  ).entries()) {
    ctx.fillText(line, POSTER_W / 2, 210 + i * 74);
  }
  ctx.fillStyle = "rgba(184,168,144,0.95)";
  ctx.font = `italic 400 36px ${BODY_FONT}`;
  ctx.fillText(card.artist || "—", POSTER_W / 2, card.title.length > 24 ? 352 : 288);

  // Painting in its double frame.
  const artY = 400;
  const artH = 760;
  ctx.strokeStyle = "rgba(216,166,90,0.55)";
  ctx.lineWidth = 3;
  roundRectPath(ctx, margin - 14, artY - 14, contentW + 28, artH + 28, 30);
  ctx.stroke();
  const image = card.imageUrl ? await loadImage(card.imageUrl) : null;
  ctx.save();
  roundRectPath(ctx, margin, artY, contentW, artH, 18);
  ctx.clip();
  if (image) {
    // Cover-fit the painting into the frame.
    const scale = Math.max(contentW / image.width, artH / image.height);
    const iw = image.width * scale;
    const ih = image.height * scale;
    ctx.drawImage(image, margin + (contentW - iw) / 2, artY + (artH - ih) / 2, iw, ih);
  } else {
    drawPlaceholderPainting(ctx, margin, artY, contentW, artH);
  }
  // Chiaroscuro melt at the frame edges.
  const melt = ctx.createLinearGradient(0, artY + artH - 160, 0, artY + artH);
  melt.addColorStop(0, "rgba(7,5,5,0)");
  melt.addColorStop(1, "rgba(7,5,5,0.55)");
  ctx.fillStyle = melt;
  ctx.fillRect(margin, artY, contentW, artH);
  ctx.restore();

  // Era caption + discovery score stat row.
  let y = artY + artH + 96;
  ctx.fillStyle = "rgba(216,166,90,0.8)";
  ctx.font = `600 30px ${UI_FONT}`;
  const caption = eraCaption(card);
  if (caption) {
    ctx.fillText(caption, POSTER_W / 2, y);
    y += 44;
  }
  ctx.fillStyle = "#ece2c8";
  ctx.font = `700 40px ${DISPLAY_FONT}`;
  ctx.fillText(`DISCOVERY ${discoveryScore(card.trackKey)}/100`, POSTER_W / 2, y + 10);

  // Lore — the poetic 2-sentence snippet in italic Playfair.
  if (card.lore) {
    y += 108;
    ctx.fillStyle = "rgba(184,168,144,0.95)";
    ctx.font = `italic 400 38px ${BODY_FONT}`;
    for (const line of wrapText((s) => ctx.measureText(s).width, card.lore, contentW - 60, 4)) {
      ctx.fillText(line, POSTER_W / 2, y);
      y += 56;
    }
  }

  // Watermark strip.
  ctx.strokeStyle = "rgba(216,166,90,0.22)";
  ctx.beginPath();
  ctx.moveTo(margin, POSTER_H - 150);
  ctx.lineTo(POSTER_W - margin, POSTER_H - 150);
  ctx.stroke();
  ctx.fillStyle = "rgba(216,166,90,0.6)";
  ctx.font = `600 26px ${UI_FONT}`;
  ctx.fillText("LIFEINSOUND — MULTIVERSE SOUNDTRACK", POSTER_W / 2, POSTER_H - 104);

  return canvas;
}

function defaultLoadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 8000);
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

/** Render + trigger a PNG download. */
export async function exportSharePoster(card: CardRow): Promise<void> {
  const canvas = await renderSharePoster(card, document.createElement("canvas"));
  const link = document.createElement("a");
  link.download = `lifeinsound-${card.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "card"}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
