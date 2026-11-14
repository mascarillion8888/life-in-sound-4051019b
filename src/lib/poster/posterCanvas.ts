/**
 * Life Poster — thin CANVAS layer (task P0-3, docs/architecture/CINEMATIC_LIFE_POSTER.md §8.3).
 *
 * The ONLY module that touches a real `CanvasRenderingContext2D`. It executes a
 * `PosterDrawPlan` (P0-3, `posterDrawPlan.ts`) and exports a PNG. Image loading
 * is INJECTED (`loadImage`) so tests never hit the network and the pure plan
 * layer stays testable without a canvas.
 *
 * Failure policy: a backdrop that fails to load degrades to the solid fill the
 * plan already emitted for that region — never throws, never yields a blank
 * poster. `renderDrawPlan` is synchronous and side-effect free apart from the
 * context it is given.
 */
import {
  POSTER_FONT_TOKENS,
  type DrawCommand,
  type PosterDrawPlan,
  type ScrimDirection,
  type TextAlign,
} from "./posterDrawPlan";

/** Injected image loader: resolves to a drawable source, or null on failure. */
export type LoadPosterImage = (src: string) => Promise<CanvasImageSource | null>;

/** Minimal canvas surface this layer needs (satisfied by HTMLCanvasElement). */
type CanvasLike = {
  width: number;
  height: number;
  getContext: (id: "2d") => CanvasRenderingContext2D | null;
};

const FONT_PX: Record<string, number> = {
  display: 128,
  title: 54,
  body: 38,
  label: 34,
  lore: 32,
};

function pxFor(font: string): number {
  return FONT_PX[font] ?? 36;
}

function textX(box: { x: number; w: number }, align: TextAlign): number {
  if (align === "left") return box.x;
  if (align === "right") return box.x + box.w;
  return box.x + box.w / 2;
}

function gradientEnd(
  box: { x: number; y: number; w: number; h: number },
  direction: ScrimDirection,
): { x: number; y: number } {
  return direction === "to-top" ? { x: box.x, y: box.y } : { x: box.x, y: box.y + box.h };
}

/** Draw a source into `box` with `cover` fit (crops, keeps aspect, focal point). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  box: { x: number; y: number; w: number; h: number },
  focal: { x: number; y: number },
): void {
  const iw = Number((image as { width?: number }).width) || box.w;
  const ih = Number((image as { height?: number }).height) || box.h;
  if (iw <= 0 || ih <= 0) return;
  const scale = Math.max(box.w / iw, box.h / ih);
  const sw = box.w / scale;
  const sh = box.h / scale;
  const sx = Math.min(Math.max(iw * focal.x - sw / 2, 0), Math.max(iw - sw, 0));
  const sy = Math.min(Math.max(ih * focal.y - sh / 2, 0), Math.max(ih - sh, 0));
  ctx.drawImage(image, sx, sy, sw, sh, box.x, box.y, box.w, box.h);
}

/** Execute one command on the context. Unknown commands are ignored, never throw. */
function execute(ctx: CanvasRenderingContext2D, cmd: DrawCommand): void {
  switch (cmd.kind) {
    case "rect":
      ctx.save();
      ctx.fillStyle = cmd.fill;
      ctx.fillRect(cmd.box.x, cmd.box.y, cmd.box.w, cmd.box.h);
      ctx.restore();
      return;
    case "line":
      ctx.save();
      ctx.strokeStyle = cmd.colour;
      ctx.lineWidth = cmd.width;
      ctx.beginPath();
      ctx.moveTo(cmd.box.x, cmd.box.y);
      ctx.lineTo(cmd.box.x + cmd.box.w, cmd.box.y);
      ctx.stroke();
      ctx.restore();
      return;
    case "gradientScrim": {
      const end = gradientEnd(cmd.box, cmd.direction);
      const gradient = ctx.createLinearGradient(cmd.box.x, cmd.box.y + cmd.box.h, end.x, end.y);
      gradient.addColorStop(0, cmd.from);
      gradient.addColorStop(1, cmd.to);
      ctx.save();
      ctx.fillStyle = gradient;
      ctx.fillRect(cmd.box.x, cmd.box.y, cmd.box.w, cmd.box.h);
      ctx.restore();
      return;
    }
    case "image": {
      const image = resolvedImages.get(cmd.src);
      if (image) drawCover(ctx, image, cmd.box, cmd.focal);
      return;
    }
    case "text": {
      if (cmd.lines.length === 0) return;
      const token = POSTER_FONT_TOKENS[cmd.font];
      const size = pxFor(cmd.font);
      const lineHeight = Math.round(size * 1.18);
      ctx.save();
      ctx.font = `${token.italic ? "italic " : ""}${token.weight} ${size}px ${token.family}`;
      ctx.textAlign = cmd.align === "center" ? "center" : cmd.align === "right" ? "right" : "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = cmd.colour;
      const x = textX(cmd.box, cmd.align);
      cmd.lines.forEach((line, i) => {
        ctx.fillText(line, x, cmd.box.y + i * lineHeight);
      });
      ctx.restore();
      return;
    }
  }
}

// Per-render image lookup. Kept module-local (single-threaded render) so the
// `execute` signature stays the plain canvas-command shape.
const resolvedImages = new Map<string, CanvasImageSource>();

/**
 * Execute a draw plan on a context. Image commands whose `src` is missing from
 * `loadedImages` are skipped (the plan's solid base fill remains) — a failed
 * backdrop never throws.
 */
export function renderDrawPlan(
  ctx: CanvasRenderingContext2D,
  plan: PosterDrawPlan,
  loadedImages: Record<string, CanvasImageSource | null> = {},
): void {
  resolvedImages.clear();
  for (const [src, image] of Object.entries(loadedImages)) {
    if (image) resolvedImages.set(src, image);
  }
  for (const cmd of plan.commands) execute(ctx, cmd);
}

function createCanvas(width: number, height: number): CanvasLike {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height) as unknown as CanvasLike;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasToBlob(canvas: CanvasLike): Promise<Blob> {
  if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: "image/png" });
  }
  const htmlCanvas = canvas as unknown as HTMLCanvasElement;
  return new Promise((resolve, reject) => {
    htmlCanvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("canvas.toBlob returned null"));
    }, "image/png");
  });
}

/**
 * Render a plan to a 2048×3072 PNG. Preloads every image command through the
 * injected `loadImage` (a rejection or null is treated as "no image"); a failed
 * backdrop degrades to the plan's solid fill. Throws only when no 2D context is
 * available at all.
 */
export async function exportPosterPng(
  plan: PosterDrawPlan,
  loadImage: LoadPosterImage,
): Promise<Blob> {
  const canvas = createCanvas(plan.canvas.width, plan.canvas.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  const srcs = [...new Set(plan.commands.filter((c) => c.kind === "image").map((c) => c.src))];
  const loadedImages: Record<string, CanvasImageSource | null> = {};
  await Promise.all(
    srcs.map(async (src) => {
      try {
        loadedImages[src] = await loadImage(src);
      } catch {
        loadedImages[src] = null;
      }
    }),
  );

  renderDrawPlan(ctx, plan, loadedImages);
  return canvasToBlob(canvas);
}
