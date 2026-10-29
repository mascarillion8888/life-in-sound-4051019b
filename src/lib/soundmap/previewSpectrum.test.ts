import { describe, expect, it, vi } from "vitest";

import { analyzeSamples } from "./previewSpectrum";

vi.mock("./previewAudio.server", () => ({ fetchPreviewAudio: vi.fn() }));

const SR = 44100;

function signal(): Float32Array {
  const out = new Float32Array(SR * 6);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    if (t >= 2 && t < 4) out[i] = 0.8 * Math.sin(2 * Math.PI * 440 * t); // tone
    else if (t >= 4) out[i] = (Math.random() * 2 - 1) * 0.5; // noise
  }
  return out;
}

describe("analyzeSamples", () => {
  const sp = analyzeSamples(signal(), SR);
  const at = (sec: number) => sp.data.subarray(Math.floor(sec * sp.fps) * sp.bands, Math.floor(sec * sp.fps) * sp.bands + sp.bands);

  it("has the expected shape", () => {
    expect(sp.bands).toBe(24);
    expect(sp.frames).toBe(Math.floor(6 * sp.fps));
    expect(sp.data.length).toBe(sp.frames * sp.bands);
  });

  it("stays near zero in silence", () => {
    expect(Math.max(...at(1))).toBeLessThan(40);
  });

  it("lights a narrow band for a pure tone", () => {
    const frame = Array.from(at(3));
    const peak = Math.max(...frame);
    expect(peak).toBeGreaterThan(150);
    expect(frame.filter((v) => v > peak * 0.8).length).toBeLessThanOrEqual(4);
  });

  it("lights most bands for noise", () => {
    expect(Array.from(at(5)).filter((v) => v > 100).length).toBeGreaterThan(12);
  });
});
