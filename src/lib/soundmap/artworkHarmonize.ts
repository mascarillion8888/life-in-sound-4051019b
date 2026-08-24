/**
 * Artwork harmonization pipeline — makes external song covers / artist
 * portraits blend into the dark gothic, hand-drawn illustration style of the
 * poster instead of looking pasted on.
 *
 * One unified shader recipe: sepia + contrast (CSS filter), film grain,
 * bronze tint, edge vignette. The drawing entry point
 * (`drawHarmonizedArtwork`) needs a real CanvasRenderingContext2D; the recipe
 * itself is expressed through pure helpers so it is unit-testable in jsdom
 * without a canvas implementation.
 */

/** CSS filter applied before compositing (sepia + contrast). */
export function harmonizeFilter(): string {
  return "sepia(0.45) contrast(1.12) brightness(0.92) saturate(0.85)";
}

/** Bronze tint overlay color (multiply blend), alpha in [0,1]. */
export function bronzeTint(alpha = 0.16): string {
  return `rgba(150, 105, 52, ${Math.min(Math.max(alpha, 0), 1)})`;
}

/**
 * Edge vignette gradient stops: fully transparent center fading into a dark
 * edge, so rectangular artwork melts into the surrounding frame.
 */
export function vignetteStops(): [number, number][] {
  // [position, alpha] pairs — alpha climbs toward the edges.
  return [
    [0, 0.55],
    [0.55, 0.18],
    [0.8, 0.02],
    [1, 0],
  ];
}

/** Deterministic pseudo-random stream for grain placement (no Math.random —
 * the same artwork always harmonizes identically). */
function seededStream(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/**
 * Grain speck positions for a w×h box. Count scales with area but is capped;
 * alpha is intentionally low — a hand-drawn film grain, not noise soup.
 */
export function grainSpecks(
  w: number,
  h: number,
  seed: number,
  maxCount = 220,
): { x: number; y: number; r: number; a: number }[] {
  const rand = seededStream(seed);
  const count = Math.min(maxCount, Math.max(30, Math.round((w * h) / 4000)));
  return Array.from({ length: count }, () => ({
    x: rand() * w,
    y: rand() * h,
    r: 0.4 + rand() * 1.1,
    a: 0.04 + rand() * 0.08,
  }));
}

/**
 * Draw `image` into the (x,y,w,h) box with the full harmonization recipe.
 * Cover-fit, sepia+contrast filter, bronze multiply tint, deterministic
 * grain, and a radial edge vignette clipped to the box. Callers wrap this in
 * their own save/clip if the target area has a custom silhouette.
 */
export function drawHarmonizedArtwork(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
): void {
  ctx.save();

  // Cover-fit with the sepia/contrast filter.
  ctx.filter = harmonizeFilter();
  const scale = Math.max(w / image.width, h / image.height);
  const iw = image.width * scale;
  const ih = image.height * scale;
  ctx.drawImage(image, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.filter = "none";

  // Bronze tint (multiply) so warm gothic bronze unifies any source palette.
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = bronzeTint();
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  // Deterministic film grain.
  ctx.fillStyle = "#d8c9a8";
  for (const g of grainSpecks(w, h, seed)) {
    ctx.globalAlpha = g.a;
    ctx.beginPath();
    ctx.arc(x + g.x, y + g.y, g.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Edge vignette (destination-over darkening toward the edges).
  const gradient = ctx.createRadialGradient(
    x + w / 2,
    y + h / 2,
    Math.min(w, h) * 0.35,
    x + w / 2,
    y + h / 2,
    Math.max(w, h) * 0.72,
  );
  const stops = vignetteStops();
  // Radial gradients run inside→out; our stops are authored outside→in.
  for (const [pos, alpha] of [...stops].reverse()) {
    gradient.addColorStop(1 - pos, `rgba(8, 6, 10, ${alpha})`);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);

  ctx.restore();
}
