/**
 * Offline spectrum of a 30-second preview, so the card's equalizer can follow
 * the REAL music without touching the playing <audio> element.
 *
 * Flow: the server proxy returns the clip bytes -> an OfflineAudioContext
 * decodes them (no autoplay restrictions, no sound) -> a small FFT turns the
 * samples into `bands` log-spaced levels at `fps` frames per second. During
 * playback the card looks up the frame for audio.currentTime. The audio that
 * the user hears is never routed through Web Audio, so it cannot be silenced.
 *
 * Every failure resolves to null and the card keeps its generic animation.
 */
import { useEffect, useState } from "react";

import { fetchPreviewAudio } from "./previewAudio.server";

export type Spectrum = {
  fps: number;
  bands: number;
  frames: number;
  /** frames * bands levels, 0..255, frame-major. */
  data: Uint8Array;
};

export const SPECTRUM_BANDS = 24;
export const SPECTRUM_FPS = 20;
const FFT_SIZE = 2048;

function fft(re: Float64Array, im: Float64Array, cos: Float64Array, sin: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step];
        const wi = -sin[k * step];
        const a = i + k;
        const b = a + half;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

/** Pure analysis: mono samples -> banded spectrum timeline. */
export function analyzeSamples(
  samples: Float32Array,
  sampleRate: number,
  fps = SPECTRUM_FPS,
  bands = SPECTRUM_BANDS,
): Spectrum {
  const frames = Math.max(1, Math.floor((samples.length / sampleRate) * fps));
  const half = FFT_SIZE / 2;
  const cos = new Float64Array(half);
  const sin = new Float64Array(half);
  for (let i = 0; i < half; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / FFT_SIZE);
    sin[i] = Math.sin((2 * Math.PI * i) / FFT_SIZE);
  }
  const win = new Float64Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1));

  // Log-spaced band edges (bins), 50 Hz .. 14 kHz.
  const binHz = sampleRate / FFT_SIZE;
  const fMin = 50;
  const fMax = Math.min(14000, sampleRate / 2 - binHz);
  const edges: number[] = [];
  for (let b = 0; b <= bands; b++) {
    edges.push(Math.max(1, Math.round((fMin * Math.pow(fMax / fMin, b / bands)) / binHz)));
  }

  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  const raw = new Float64Array(frames * bands);
  const loud = new Float64Array(frames);

  for (let f = 0; f < frames; f++) {
    const start = Math.round((f / fps) * sampleRate) - half;
    for (let i = 0; i < FFT_SIZE; i++) {
      const s = start + i;
      re[i] = s >= 0 && s < samples.length ? samples[s] * win[i] : 0;
      im[i] = 0;
    }
    fft(re, im, cos, sin);
    let sum = 0;
    for (let b = 0; b < bands; b++) {
      const lo = edges[b];
      const hi = Math.max(lo + 1, edges[b + 1]);
      let acc = 0;
      for (let k = lo; k < hi; k++) acc += Math.hypot(re[k], im[k]) / FFT_SIZE;
      const e = Math.log1p((acc / (hi - lo)) * 60);
      raw[f * bands + b] = e;
      sum += e;
    }
    loud[f] = sum / bands;
  }

  // Normalise each band by its own 95th percentile so bass does not drown the
  // highs, then scale by the frame loudness so quiet passages stay low.
  const bandRef: number[] = [];
  for (let b = 0; b < bands; b++) {
    const col: number[] = [];
    for (let f = 0; f < frames; f++) col.push(raw[f * bands + b]);
    bandRef.push(Math.max(1e-6, percentile(col, 0.95)));
  }
  const loudRef = Math.max(1e-6, percentile(Array.from(loud), 0.95));

  const data = new Uint8Array(frames * bands);
  for (let f = 0; f < frames; f++) {
    const env = Math.min(1, loud[f] / loudRef);
    for (let b = 0; b < bands; b++) {
      const v = Math.min(1, raw[f * bands + b] / bandRef[b]);
      data[f * bands + b] = Math.round(Math.min(1, Math.pow(v, 1.15) * (0.4 + 0.6 * env)) * 255);
    }
  }
  return { fps, bands, frames, data };
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

const CACHE = new Map<string, Spectrum | null>();
const PENDING = new Map<string, Promise<Spectrum | null>>();

/** Fetch (via the server proxy), decode and analyse one preview URL. */
export function analyzePreview(url: string): Promise<Spectrum | null> {
  if (CACHE.has(url)) return Promise.resolve(CACHE.get(url) ?? null);
  const pending = PENDING.get(url);
  if (pending) return pending;

  const job = (async (): Promise<Spectrum | null> => {
    try {
      const Offline: typeof OfflineAudioContext | undefined =
        typeof OfflineAudioContext !== "undefined"
          ? OfflineAudioContext
          : (globalThis as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
              .webkitOfflineAudioContext;
      if (!Offline) return null;
      const res = await fetchPreviewAudio({ data: { url } });
      if (!res?.ok || !res.base64) return null;
      const bytes = base64ToBytes(res.base64);
      const ctx = new Offline(1, 1, 44100);
      const decoded = await ctx.decodeAudioData(bytes.buffer.slice(0) as ArrayBuffer);
      const mono = new Float32Array(decoded.length);
      for (let c = 0; c < decoded.numberOfChannels; c++) {
        const ch = decoded.getChannelData(c);
        for (let i = 0; i < mono.length; i++) mono[i] += ch[i] / decoded.numberOfChannels;
      }
      return analyzeSamples(mono, decoded.sampleRate);
    } catch {
      return null;
    }
  })();

  PENDING.set(url, job);
  void job.then((s) => {
    CACHE.set(url, s);
    PENDING.delete(url);
  });
  return job;
}

/** Test-only: reset the session cache. */
export function __clearSpectrumCache(): void {
  CACHE.clear();
  PENDING.clear();
}

/** Spectrum of a preview URL; null while loading or when unavailable. */
export function usePreviewSpectrum(url: string | null | undefined): Spectrum | null {
  const [state, setState] = useState<{ url: string; spectrum: Spectrum | null }>({
    url: "",
    spectrum: null,
  });

  useEffect(() => {
    if (!url) {
      setState({ url: "", spectrum: null });
      return;
    }
    let active = true;
    void analyzePreview(url).then((spectrum) => {
      if (active) setState({ url, spectrum });
    });
    return () => {
      active = false;
    };
  }, [url]);

  return url && state.url === url ? state.spectrum : null;
}
