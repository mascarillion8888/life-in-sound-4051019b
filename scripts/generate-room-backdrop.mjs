/**
 * generate-room-backdrop.mjs — build-time procedural renderer for the fixed
 * global library room. Produces one rich wood-carved library backdrop PNG per
 * scene theme (`src/assets/room-backdrop-<theme>.png`) so the live UI layers
 * a real textured image instead of flat CSS/DOM vector shapes.
 *
 * Pure math + pngjs — no external services, fully deterministic.
 *
 * Run: node scripts/generate-room-backdrop.mjs  (or `npm run gen:room`)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

import { hexToRgb, SCENE_PALETTES } from "../src/components/scene/scenePalettes.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../src/assets");

const WIDTH = 1600;
const HEIGHT = 900;

/* ------------------------------- helpers ------------------------------ */

/** mulberry32 — seeded PRNG for stable noise grids. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded value-noise sampler with fBm octaves. */
function makeNoise(seed) {
  const rnd = prng(seed);
  const grid = new Float32Array(256 * 256);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const at = (x, y) => grid[(((x | 0) & 255) * 256 + ((y | 0) & 255)) & 65535];
  const smoothInterp = (v) => v * v * (3 - 2 * v) * v;
  function noise2(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = smoothInterp(xf);
    const v = smoothInterp(yf);
    const c00 = at(xi, yi);
    const c10 = at(xi + 1, yi);
    const c01 = at(xi, yi + 1);
    const c11 = at(xi + 1, yi + 1);
    return (c00 * (1 - u) + c10 * u) * (1 - v) + (c01 * (1 - u) + c11 * u) * v;
  }
  function fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amp = 0.5;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise2(x, y);
      norm += amp;
      amp *= gain;
      x *= lacunarity;
      y *= lacunarity;
    }
    return sum / norm;
  }
  return { fbm };
}

const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const pix = (buf, x, y) => ((y * WIDTH + x) * 4) | 0;
/** Alpha-composite `mix(base, add, coverage)` in place at pixel idx. */
function blend(buf, idx, rgb, coverage, alpha = 1) {
  const w = clamp(coverage) * alpha;
  buf[idx] = buf[idx] * (1 - w) + rgb[0] * w;
  buf[idx + 1] = buf[idx + 1] * (1 - w) + rgb[1] * w;
  buf[idx + 2] = buf[idx + 2] * (1 - w) + rgb[2] * w;
}
/** Additive (light) pass. */
function addLight(buf, idx, rgb, amount) {
  buf[idx] = Math.min(255, buf[idx] + rgb[0] * amount);
  buf[idx + 1] = Math.min(255, buf[idx + 1] + rgb[1] * amount);
  buf[idx + 2] = Math.min(255, buf[idx + 2] + rgb[2] * amount);
}

/** Color jittered by a noise value; used to break flatness. */
function jitter(rgb, noiseVal, amplitude) {
  const f = 1 + (noiseVal - 0.5) * 2 * amplitude;
  return [
    clamp((rgb[0] * f) / 255) * 255,
    clamp((rgb[1] * f) / 255) * 255,
    clamp((rgb[2] * f) / 255) * 255,
  ];
}

/* --------------------------- scene geometry --------------------------- */

const SHELF = {
  // The shelf case occupies the top band of the wall.
  x0: 0.07,
  x1: 0.93,
  y0: 0.045,
  y1: 0.5,
  rows: 2,
  rowGap: 0.035, // fraction of case height
  booksPerRow: 13,
};
const DESK = { y0: 0.74 }; // desk surface occupies the bottom band
const LAMP = { x: 0.12, shadeY0: 0.4, shadeY1: 0.54, stemY1: DESK.y0, radius: 0.022 };
const BOXES = [
  { x0: 0.84, x1: 0.885, yTop: 0.685 }, // larger
  { x0: 0.8, x1: 0.836, yTop: 0.7 }, // smaller
];

function renderTheme(palette, seed) {
  const noise = makeNoise(seed * 7919 + 13);
  const buf = new Uint8Array(WIDTH * HEIGHT * 4);
  // Precompute book columns per row (same distribution every row).
  const shelfH = SHELF.y1 - SHELF.y0;
  const rowH = shelfH / SHELF.rows;
  const bookRnd = prng(seed * 131 + 7);
  const columns = [];
  {
    const caseW = SHELF.x1 - SHELF.x0;
    const colW = caseW / SHELF.booksPerRow;
    for (let i = 0; i < SHELF.booksPerRow; i++) {
      const hFrac = 0.58 + bookRnd() * 0.32;
      const colorIdx = (i * 3 + seed) % palette.books.length;
      const gilded = bookRnd() < 0.34;
      const hubBands = 1 + Math.floor(bookRnd() * 2);
      const tone = 0.78 + bookRnd() * 0.5; // per-volume readability variation
      columns.push({
        x0: SHELF.x0 + i * colW,
        x1: SHELF.x0 + (i + 0.97) * colW,
        hFrac,
        colorIdx,
        gilded,
        hubBands,
        tone,
      });
    }
  }
  const glow = hexToRgb(palette.glow);
  const wall0 = hexToRgb(palette.wall[0]);
  const wall1 = hexToRgb(palette.wall[1]);
  const wood = hexToRgb(palette.wood);
  const desk0 = hexToRgb(palette.desk[0]);
  const desk1 = hexToRgb(palette.desk[1]);
  const artifact = hexToRgb(palette.artifact);
  const books = palette.books.map(hexToRgb);

  for (let y = 0; y < HEIGHT; y++) {
    const py = y / HEIGHT;
    for (let x = 0; x < WIDTH; x++) {
      const px = x / WIDTH;
      const idx = pix(buf, x, y);

      /* 1) Wall base: vertical gradient + grainy radiance noise. */
      const gBase = py;
      const grainFine = noise.fbm(px * 120, py * 120, 3);
      let rgb = [
        wall0[0] * (1 - gBase) + wall1[0] * gBase,
        wall0[1] * (1 - gBase) + wall1[1] * gBase,
        wall0[2] * (1 - gBase) + wall1[2] * gBase,
      ];
      rgb = jitter(rgb, grainFine, 0.08);
      for (let c = 0; c < 3; c++) buf[idx + c] = rgb[c];
      buf[idx + 3] = 255;

      /* 2) Shelf case — carved wood paneling, books, frame. */
      if (px > SHELF.x0 && px < SHELF.x1 && py > SHELF.y0 && py < SHELF.y1) {
        // Paneled wood back with vertical plank seams + wood-grain rings.
        const seamPhase = px * 30 + noise.fbm(px * 3, py * 3, 2);
        const seam = Math.abs(Math.sin(seamPhase));
        const plankLight = 0.28 + 0.72 * (seam > 0.06 ? 1 : 0);
        const grain = noise.fbm(px * 14 + Math.sin(py * 40) * 0.3, py * 4, 4);
        let woodCol = jitter(wood, grain, 0.42);
        for (let c = 0; c < 3; c++) woodCol[c] = (woodCol[c] / 255) * plankLight * 255;

        // Books within each row band.
        const rowIdx = Math.floor((py - SHELF.y0) / rowH);
        const rowTop = SHELF.y0 + rowIdx * rowH;
        const rowY = py - rowTop;
        let color = woodCol;
        for (const col of columns) {
          if (px >= col.x0 && px < col.x1) {
            const bookTop = rowH * 0.92 * (1 - col.hFrac);
            const plankLine = rowH * 0.92;
            if (rowY > bookTop && rowY < plankLine) {
              // Spine: base book color, richer grain on the cloth/leather face.
              let spine = jitter(books[col.colorIdx], noise.fbm(px * 90, py * 9, 2), 0.16);
              // Light falls from the left; crown light from above.
              const u = (px - col.x0) / (col.x1 - col.x0);
              const relY = (rowY - bookTop) / (plankLine - bookTop);
              const crown = clamp(1 - relY * 4);
              let factor = (0.66 + 0.24 * crown) * col.tone;
              // Side rims: light catches the left edge, darkness pools on the right.
              if (u < 0.05) factor += 0.18;
              else if (u > 0.93) factor -= 0.3;
              else if (u < 0.11) factor -= 0.08;
              // Hub bands (raised rings) darken slightly with edge highlights.
              for (let b = 0; b < col.hubBands; b++) {
                const bandY = 0.26 + b * 0.24;
                if (Math.abs(relY - bandY) < 0.016) factor -= 0.2;
                else if (Math.abs(relY - bandY) < 0.03) factor += 0.09;
              }
              // Gilded title line near the crown of taller books.
              if (col.gilded && Math.abs(relY - 0.15) < 0.012) {
                spine = [210 + (col.colorIdx % 3) * 10, 158, 66];
              }
              color = [
                clamp((spine[0] * factor) / 255) * 255,
                clamp((spine[1] * factor) / 255) * 255,
                clamp((spine[2] * factor) / 255) * 255,
              ];
            } else if (rowY >= plankLine) {
              // Shelf plank beneath the books — lit lip + board grain.
              const plank = jitter(wood, noise.fbm(py * 60, px * 4, 2), 0.22);
              const lip = rowY - plankLine < rowH * 0.022 ? 1.7 : 1.12;
              color = [
                Math.min(255, plank[0] * lip),
                Math.min(255, plank[1] * lip * 0.95),
                Math.min(255, plank[2] * lip * 0.88),
              ];
            }
            break;
          }
        }
        blend(buf, idx, color, 1);
        // Deep frame border with bevel light top-left.
        const margin = Math.min(SHELF.y1 - SHELF.y0, SHELF.x1 - SHELF.x0) * 0.008;
        const inFrameX =
          (px > SHELF.x0 && px < SHELF.x0 + margin) || (px < SHELF.x1 && px > SHELF.x1 - margin);
        const inFrameY =
          (py > SHELF.y0 && py < SHELF.y0 + margin) || (py < SHELF.y1 && py > SHELF.y1 - margin);
        if (inFrameX || inFrameY) {
          const lit = py < SHELF.y0 + margin || px < SHELF.x0 + margin;
          const frameMul = lit ? 2.2 : 0.62;
          const frameCol = [
            Math.min(255, wood[0] * frameMul),
            Math.min(255, wood[1] * frameMul * 0.94),
            Math.min(255, wood[2] * frameMul * 0.88),
          ];
          blend(buf, idx, frameCol, 0.95);
        }
      }

      /* 3) Desk band with horizontal wood grain + front edge highlight. */
      if (py >= DESK.y0) {
        const d = (py - DESK.y0) / (1 - DESK.y0);
        // Stretched noise along x → long grain lines.
        const grain = noise.fbm(px * 5, py * 110, 4);
        let base = [
          desk0[0] * (1 - d) + desk1[0] * d,
          desk0[1] * (1 - d) + desk1[1] * d,
          desk0[2] * (1 - d) + desk1[2] * d,
        ];
        const lift = 1 - d * 0.55;
        base = [
          Math.min(255, grain * 1.6 * base[0] * lift + 18),
          Math.min(255, grain * 1.6 * base[1] * lift + 14),
          Math.min(255, grain * 1.6 * base[2] * lift + 12),
        ];
        // Front edge catch-light.
        if (py - DESK.y0 < 0.004)
          base = [
            Math.min(255, base[0] * 1.9),
            Math.min(255, base[1] * 1.7),
            Math.min(255, base[2] * 1.5),
          ];
        blend(buf, idx, base, 1);
      }

      /* 4) Lamp — warm emissive glow, shade, stem, base. */
      const lampX = LAMP.x;
      const shadeTop = LAMP.shadeY0;
      const shadeBottom = LAMP.shadeY1;
      const dx = px - lampX;
      const dyShade = py - (shadeTop + shadeBottom) / 2;
      const glowDis = Math.sqrt(dx * dx * 3.2 + dyShade * dyShade * 1.6);
      // Cone of light from the shade.
      addLight(buf, idx, glow, clamp(0.22 - glowDis) * 1.9);
      // Stem (dark rod).
      if (Math.abs(px - lampX) < 0.0018 && py > shadeBottom && py < LAMP.stemY1) {
        blend(buf, idx, [12, 10, 8], 0.85);
      }
      // Base ellipse.
      const baseDx = (px - lampX) / LAMP.radius;
      const baseDy = (py - (DESK.y0 - 0.007)) / 0.007;
      if (py >= shadeBottom && baseDx * baseDx + baseDy * baseDy < 1)
        blend(buf, idx, [16, 13, 10], 0.85);
      // Shade trapezoid — emissive cloth.
      if (py > shadeTop && py < shadeBottom) {
        const t = (py - shadeTop) / (shadeBottom - shadeTop);
        const halfW = 0.028 + t * 0.03; // widens toward the bottom
        if (Math.abs(px - lampX) < halfW) {
          const texr = noise.fbm(px * 200, py * 120, 2);
          const shine = clamp(1 - Math.abs(px - lampX) / halfW) * 0.5 + 0.55 + texr * 0.1;
          blend(
            buf,
            idx,
            [
              Math.min(255, glow[0] * shine),
              Math.min(255, glow[1] * shine),
              Math.min(255, glow[2] * shine),
            ],
            1,
          );
        }
      }

      /* 5) Boxes on the desk — carved, beveled artifacts. */
      for (const box of BOXES) {
        if (px > box.x0 && px < box.x1 && py > box.yTop && py < DESK.y0) {
          const plank = noise.fbm(px * 160, py * 60, 2);
          let rect = jitter(
            [
              artifact[0] * 0.55 + wood[0] * 0.45,
              artifact[1] * 0.55 + wood[1] * 0.45,
              artifact[2] * 0.55 + wood[2] * 0.45,
            ],
            plank,
            0.2,
          );
          // Beveled rim.
          const nearX = px - box.x0 < 0.0022 || box.x1 - px < 0.0022;
          const nearY = py - box.yTop < 0.005 || DESK.y0 - py < 0.003;
          if (nearX || nearY) rect = [artifact[0] * 1.2, artifact[1] * 1.15, artifact[2] * 1.1];
          blend(
            buf,
            idx,
            [Math.min(255, rect[0]), Math.min(255, rect[1]), Math.min(255, rect[2])],
            1,
          );
        }
      }

      /* 6) Room ambient: lamp spills warm light across shelves + desk. */
      const lampDist = Math.sqrt((px - lampX) * (px - lampX) + (py - 0.47) * (py - 0.47));
      addLight(buf, idx, glow, clamp(0.36 - lampDist * 0.5) * 0.55);
      // Subtle cool counter-light from the far right.
      addLight(buf, idx, [90, 100, 140], clamp(px - 0.55) * 0.16 * (1 - py * 0.4));

      /* 7) Vignette — corner falloff locks the eye to the desk. */
      const vx = px - 0.5;
      const vy = py - 0.45;
      const vign = clamp(vx * vx * 2.2 + vy * vy * 1.8);
      const vigMul = 1 - vign * 0.62;
      buf[idx] = buf[idx] * vigMul;
      buf[idx + 1] = buf[idx + 1] * vigMul;
      buf[idx + 2] = buf[idx + 2] * vigMul;
    }
  }
  const png = new PNG({ width: WIDTH, height: HEIGHT, colorType: 2 });
  png.data = Buffer.from(buf);
  return PNG.sync.write(png, { bitDepth: 8 });
}

mkdirSync(OUT_DIR, { recursive: true });
const themes = Object.keys(SCENE_PALETTES);
for (const [i, theme] of themes.entries()) {
  const data = renderTheme(SCENE_PALETTES[theme], i + 1);
  const file = join(OUT_DIR, `room-backdrop-${theme}.png`);
  writeFileSync(file, data);
  console.log(`rendered ${file} (${(data.length / 1024).toFixed(0)} KB)`);
}
console.log(`done: ${themes.length} backdrops → src/assets/`);
