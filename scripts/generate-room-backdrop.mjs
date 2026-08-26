/**
 * generate-room-backdrop.mjs — build-time procedural renderer for the fixed
 * global library room. Produces one atmospheric backdrop PNG per scene theme
 * (`src/assets/room-backdrop-<theme>.png`).
 *
 * Painterly version: no crisp rectangles or trapezoids. Everything on the
 * wall is computed through blurred coverage masks (noise-warped organic
 * rectangles for books, gaussian-lit lamp, smeared wood grain), followed by a
 * painterly "edge-breaker" modulation and a film-grain frost so the scene
 * reads like analog atmosphere rather than vector geometry.
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

/** Seeded value-noise sampler with fBm octaves (returns [0,1]). */
function makeNoise(seed) {
  const rnd = prng(seed);
  const grid = new Float32Array(256 * 256);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const at = (x, y) => grid[(((x | 0) & 255) * 256 + ((y | 0) & 255)) & 65535];
  const sm = (v) => v * v * (3 - 2 * v);
  function noise2(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = sm(xf);
    const v = sm(yf);
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
/** Gaussian falloff exp(-d²/σ²) — soft light pool, never an edge. */
const gauss = (d, sigma) => Math.exp(-(d * d) / (sigma * sigma));
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
/** Color jittered by a noise value; used to break flatness without edges.
 *  Values remain in 0-255 domain (clamped per component). */
function jitter(rgb, noiseVal, amplitude) {
  const f = 1 + (noiseVal - 0.5) * 2 * amplitude;
  return rgb.map((v) => Math.min(255, Math.max(0, v * f)));
}

/* --------------------------- organic geometry -------------------------- */

/** Soft rect: coverage eases from 1 to 0 over 1/n of each side. Painterly. */
function softRect(px, py, x0, x1, y0, y1, n = 14) {
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return 0;
  const u = Math.min(((px - x0) * n) / w, ((x1 - px) * n) / w);
  const v = Math.min(((py - y0) * n) / h, ((y1 - py) * n) / h);
  return clamp(Math.min(u, v));
}

function renderTheme(palette, seed) {
  const noise = makeNoise(seed * 7919 + 13);
  const buf = new Uint8Array(WIDTH * HEIGHT * 4);
  // Geometry: shelf band, desk band, lamp spot, organic book columns.
  const SHELF = { x0: 0.07, x1: 0.93, y0: 0.045, y1: 0.5, rows: 2, booksPerRow: 13 };
  const DESK = { y0: 0.74 };
  const LAMP = { x: 0.12, midY: 0.47, stemY0: 0.54 };
  const BOXES = [
    { x0: 0.84, x1: 0.885, yTop: 0.685 },
    { x0: 0.8, x1: 0.836, yTop: 0.7 },
  ];
  const caseH = SHELF.y1 - SHELF.y0;
  const rowH = caseH / SHELF.rows;
  const caseW = SHELF.x1 - SHELF.x0;
  const colW = caseW / SHELF.booksPerRow;
  const columns = [];
  {
    const rnd = prng(seed * 131 + 7);
    for (let i = 0; i < SHELF.booksPerRow; i++) {
      const gapped = rnd() < 0.16;
      columns.push({
        x0: SHELF.x0 + i * colW,
        x1: SHELF.x0 + (i + (gapped ? 0.86 : 0.99)) * colW,
        hFrac: 0.55 + rnd() * 0.36,
        colorIdx: (i * 3 + seed) % palette.books.length,
        gilded: rnd() < 0.3,
        tilt: rnd() < 0.22 ? (rnd() - 0.5) * 0.02 : 0,
        tone: 0.76 + rnd() * 0.5,
        edgeSeed: rnd() * 4,
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
      const idx = (y * WIDTH + x) * 4;

      /* 1) Wall: vertical gradient + fine film grain. */
      const grain0 = noise.fbm(px * 140, py * 140, 3);
      let rgb = [
        wall0[0] * (1 - py) + wall1[0] * py,
        wall0[1] * (1 - py) + wall1[1] * py,
        wall0[2] * (1 - py) + wall1[2] * py,
      ];
      rgb = jitter(rgb, grain0, 0.09);
      for (let c = 0; c < 3; c++) buf[idx + c] = rgb[c];
      buf[idx + 3] = 255;

      /* 2) Shelf zone — painterly case + organic book brush. */
      if (px > SHELF.x0 && px < SHELF.x1 && py > SHELF.y0 && py < SHELF.y1) {
        // Column cross once so we iterate only the books under the pixel.
        const rowIdx = Math.min(SHELF.rows - 1, Math.floor((py - SHELF.y0) / rowH));
        const rowTop = SHELF.y0 + rowIdx * rowH;
        const rowY = py - rowTop;

        let shelfColor;
        {
          // Wood back: warped rings, no seam lines — each fBm returns [0..1].
          const warpA = noise.fbm(px * 8, py * 30, 3);
          const warpB = noise.fbm(px * 30, py * 8, 3);
          let color = jitter(wood, warpA * 0.65 + warpB * 0.35, 0.45);
          // Books placed through blurred coverage masks.
          for (const col of columns) {
            if (px < col.x0 || px >= col.x1) continue;
            // Tilted brush rectangle breaks perfect perpendicularity.
            let tX0 = col.x0;
            let tX1 = col.x1;
            if (col.tilt !== 0) {
              if (col.tilt > 0) tX1 = col.x1 - col.tilt;
              else tX0 = col.x0 - col.tilt;
            }
            const rowFrac = 0.9;
            const bookTop = rowH * rowFrac * (1 - col.hFrac);
            const plank = rowH * rowFrac;
            const cov = softRect(px, rowY, tX0, tX1, bookTop, plank, 26);
            if (cov > 0) {
              let spine = jitter(
                books[col.colorIdx],
                noise.fbm(px * 70 + col.edgeSeed * 3, py * 12, 3),
                0.18,
              );
              // Diffused light from upper-left; crown falls off gently.
              const u = clamp((px - tX0) / Math.max(1e-4, tX1 - tX0));
              const relY = clamp((rowY - bookTop) / Math.max(1e-4, plank - bookTop));
              const crown = Math.pow(1 - relY, 2.3);
              let factor = clamp((0.86 + 0.18 * crown) * col.tone, 0, 1.4);
              // Soft rim: left lifts, right sinks — both blurred.
              factor += clamp((0.1 - u) * 3) * 0.18 - clamp(u - 0.86) * 2 * 0.22;
              // Streaky "gilded hub ring" without hard boundary.
              if (col.gilded) {
                const ringPhase = (Math.sin(relY * 24 + col.edgeSeed * 6) + 1) / 2;
                if (Math.abs(relY - 0.17) < 0.03 && ringPhase > 0.6) spine = [215, 162, 70];
              }
              spine = [
                clamp((spine[0] * factor) / 255) * 255,
                clamp((spine[1] * factor) / 255) * 255,
                clamp((spine[2] * factor) / 255) * 255,
              ];
              color = [
                color[0] * (1 - cov) + spine[0] * cov,
                color[1] * (1 - cov) + spine[1] * cov,
                color[2] * (1 - cov) + spine[2] * cov,
              ];
              break;
            }
          }
          shelfColor = color;
        }
        // Soft case frame (warped brush, not crisp) — blended ONCE at the end
        // so the pixel is never left unweighted.
        const frameCov = softRect(px, py, SHELF.x0, SHELF.x1, SHELF.y0, SHELF.y1, 30);
        if (frameCov < 1) {
          // "Upper-left" = nearer-top or nearer-left half of the frame —
          // catches lamp spill from the top-left lampshade.
          const midX = (SHELF.x0 + SHELF.x1) * 0.5;
          const midY = (SHELF.y0 + SHELF.y1) * 0.5;
          const upperLeft = px < midX || py < midY;
          const lift = upperLeft
            ? clamp((SHELF.y0 - py) * 40) + clamp((SHELF.x0 - px) * 40)
            : clamp((SHELF.y1 - py) * 40) - clamp((SHELF.x1 - px) * 40);
          const frameMul = upperLeft ? 1.55 + lift * 0.5 : 0.72 + lift * 0.5;
          const frameCol = [
            Math.min(255, wood[0] * frameMul),
            Math.min(255, wood[1] * frameMul * 0.94),
            Math.min(255, wood[2] * frameMul * 0.88),
          ];
          const w = clamp(1 - frameCov) * 0.8;
          shelfColor = [
            shelfColor[0] * (1 - w) + frameCol[0] * w,
            shelfColor[1] * (1 - w) + frameCol[1] * w,
            shelfColor[2] * (1 - w) + frameCol[2] * w,
          ];
        }
        blend(buf, idx, shelfColor, 1);
      }

      /* 3) Desk — smeared horizontal grain, soft edge catch-light. */
      if (py >= DESK.y0) {
        const d = (py - DESK.y0) / (1 - DESK.y0);
        const gWarp = noise.fbm(px * 6, py * 130, 4);
        let base = [
          desk0[0] * (1 - d) + desk1[0] * d,
          desk0[1] * (1 - d) + desk1[1] * d,
          desk0[2] * (1 - d) + desk1[2] * d,
        ];
        const lift = 1 - d * 0.5;
        base = [
          Math.min(255, base[0] * (gWarp * 1.4 + 0.18) * lift + 16),
          Math.min(255, base[1] * (gWarp * 1.4 + 0.14) * lift + 13),
          Math.min(255, base[2] * (gWarp * 1.35 + 0.12) * lift + 11),
        ];
        const front = gauss(py - DESK.y0, 0.008) * 0.85;
        base = [
          Math.min(255, base[0] * (1 + front)),
          Math.min(255, base[1] * (1 + front * 0.9)),
          Math.min(255, base[2] * (1 + front * 0.8)),
        ];
        blend(buf, idx, base, 1);
      }

      /* 4) Lamp — gaussian glow, organic shade silhouette. */
      const lampX = LAMP.x;
      const dxShade = px - lampX;
      const shadeT = (py - (LAMP.midY - 0.069)) / 0.138;
      const dyShade = py - LAMP.midY;
      addLight(
        buf,
        idx,
        glow,
        gauss(Math.sqrt(dxShade * dxShade * 2.4 + dyShade * dyShade), 0.22) * 0.34,
      );
      const stemCov = gauss(clamp(dxShade, -0.003, 0.003), 0.0025);
      if (py > LAMP.stemY0 && py < DESK.y0 && stemCov > 0.04)
        blend(buf, idx, [14, 11, 8], clamp(stemCov) * 0.9);
      if (shadeT > 0 && shadeT < 1) {
        const halfW = 0.03 * (1 - Math.abs(shadeT - 0.5) * 2 * 0.4);
        const dxn = dxShade / Math.max(halfW, 0.0001);
        const shadeCov = clamp(1 - dxn * dxn);
        if (shadeCov > 0) {
          const tex = noise.fbm(px * 180, py * 110, 2) - 0.5;
          const shine = clamp(1 - Math.abs(dxn)) * 0.55 + 0.5 + tex * 0.14;
          blend(
            buf,
            idx,
            [
              Math.min(255, glow[0] * shine),
              Math.min(255, glow[1] * shine),
              Math.min(255, glow[2] * shine),
            ],
            clamp(shadeCov) * 0.95,
          );
        }
      }

      /* 5) Desk boxes — blur-masked contents, soft rim catch-light. */
      for (const box of BOXES) {
        const cov = softRect(px, py, box.x0, box.x1, box.yTop, DESK.y0, 18);
        if (cov > 0) {
          const dirt = noise.fbm(px * 140, py * 56, 2) - 0.5;
          let rect = jitter(
            [
              artifact[0] * 0.55 + wood[0] * 0.45,
              artifact[1] * 0.55 + wood[1] * 0.45,
              artifact[2] * 0.55 + wood[2] * 0.45,
            ],
            0.5 + dirt,
            0.19,
          );
          const rimSoft = clamp(1 - cov) * 2.2;
          const nearTop = py - box.yTop < 0.01;
          const nearXr = px - box.x0 < 0.003 || box.x1 - px < 0.003;
          if (rimSoft > 0.1 && (nearTop || nearXr))
            rect = [artifact[0] * 1.35, artifact[1] * 1.25, artifact[2] * 1.18];
          blend(
            buf,
            idx,
            [Math.min(255, rect[0]), Math.min(255, rect[1]), Math.min(255, rect[2])],
            clamp(cov),
          );
        }
      }

      /* 6) Ambient + painterly edge-breaker (warped gradient shading). */
      const edgePull = noise.fbm(px * 4.5, py * 4.5, 3) - 0.5; // ±0.5
      const lampD = Math.sqrt((px - lampX) * (px - lampX) + (py - 0.47) * (py - 0.47));
      addLight(buf, idx, glow, clamp(0.34 - lampD * 0.5) * 0.52);
      addLight(buf, idx, [88, 96, 138], clamp(px - 0.58) * 0.15 * clamp(1 - py * 0.45));
      const edgeMul = 1 + edgePull * 0.16; // ±8% painterly modulation

      /* 7) Vignette + final film grain. */
      const vx = px - 0.5;
      const vy = py - 0.45;
      const vign = clamp(vx * vx * 2.2 + vy * vy * 1.8);
      const vigMul = (1 - vign * 0.6) * edgeMul;
      buf[idx] = buf[idx] * vigMul;
      buf[idx + 1] = buf[idx + 1] * vigMul;
      buf[idx + 2] = buf[idx + 2] * vigMul;
      const grainAdd = (noise.fbm(px * 260, py * 260, 2) - 0.5) * 9;
      buf[idx] = clamp((buf[idx] + grainAdd) / 255) * 255;
      buf[idx + 1] = clamp((buf[idx + 1] + grainAdd) / 255) * 255;
      buf[idx + 2] = clamp((buf[idx + 2] + grainAdd) / 255) * 255;
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
