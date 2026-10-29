/** 30-second audio preview playback for the Dynamic Life Cards. */

/* The preview URL comes straight from the Song model (`previewUrl`, supplied
 * by iTunes/Spotify — never fabricated). Playback is a single global
 * instance: starting one card fades out whichever card is currently playing,
 * so eight mounted cards can never overlap. Fades are rAF volume ramps;
 * autoplay rejections (browser gesture policy) are swallowed silently and the
 * card simply stays stopped behind its toggle.

 * Web Audio Analyser support: when an analyser is provided, real-time
 * frequency data is available via the returned `analyser` node. CORS-safe
 * fallback removes the crossOrigin attribute on error so playback never
 * breaks.
 */

/* eslint-disable no-unused-vars */
type Active = { audio: HTMLAudioElement; onInactive: () => void; analyser: AnalyserNode | null };
/* The one card allowed to sound at any moment. */
let active: Active | null = null;

const FADE_IN_MS = 900;
const FADE_OUT_MS = 450;

/* Web Audio singleton state (shared across all useAudioPreview calls) */
let globalCtx: AudioContext | null = null;
/* Maps each <audio> element to its { source, analyser } so we create once per element. */
const sourceMap = new Map<HTMLAudioElement, { source: MediaElementAudioSourceNode | null; analyser: AnalyserNode | null }>();

function ensureContext(): AudioContext | null {
  /* jsdom: no AudioContext — silently return null. */
  if (typeof AudioContext === "undefined") return null;
  if (!globalCtx) globalCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return globalCtx;
}

/* Create MediaElementSource + optional analyser for one <audio> element (one-time). */
function setupAudioElement(audio: HTMLAudioElement): { source: MediaElementAudioSourceNode | null; analyser: AnalyserNode | null } {
  const ctx = ensureContext();
  if (!ctx) return { source: null, analyser: null };
  /* One-time setup per audio element. */
  if (sourceMap.has(audio)) {
    const existing = sourceMap.get(audio)!;
    return { source: existing.source, analyser: existing.analyser };
  }
  try {
    const source = ctx.createMediaElementSource(audio);
    let analyser: AnalyserNode | null = null;
    /* Create analyser with fftSize 128, smoothingTimeConstant 0.8 */
    try {
      analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyser.connect(ctx.destination);
    } catch {
      /* analyser creation may fail (e.g. some environments); play without it. */
      analyser = null;
    }
    sourceMap.set(audio, { source, analyser });
    return { source, analyser };
  } catch (e) {
    /* createMediaElementSource can fail if crossOrigin is set and server
     * doesn't send anonymous CORS headers. Fallback: remove crossOrigin and retry. */
    try { audio.crossOrigin = "anonymous"; } catch {}
    try {
      const source = ctx.createMediaElementSource(audio);
      sourceMap.set(audio, { source, analyser: null });
      return { source, analyser: null };
    } catch {
      /* Last resort: remove crossOrigin and try again without analyser. */
      try { audio.removeAttribute("crossOrigin"); } catch {}
      try {
        const source = ctx.createMediaElementSource(audio);
        sourceMap.set(audio, { source, analyser: null });
        return { source, analyser: null };
      } catch {
        return { source: null, analyser: null };
      }
    }
  }
}

function rampVolume(audio: HTMLAudioElement, to: number, ms: number, done: () => void): void {
  const from = audio.volume;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    audio.volume = Math.min(1, Math.max(0, from + (to - from) * t));
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      done();
    }
  };
  if (ms <= 0) {
    audio.volume = to;
    done();
    return;
  }
  requestAnimationFrame(tick);
}

/* Fade out and release the globally active preview, if any. */
function fadeOutActive(): void {
  const a = active;
  if (!a) return;
  active = null;
  a.onInactive();
  rampVolume(a.audio, 0, FADE_OUT_MS, () => {
    a.audio.pause();
    a.audio.src = "";
    /* Clean up global graph for this element. */
    const entry = sourceMap.get(a.audio);
    if (entry && entry.source) {
      try { entry.source.disconnect(); } catch {}
      try { entry.analyser?.disconnect(); } catch {}
      sourceMap.delete(a.audio);
    }
    try { a.audio.removeAttribute("crossOrigin"); } catch {}
  });
}

export type AudioPreviewState = {
  /** True when the song carries a real provider preview URL. */
  available: boolean;
  /** True while this card's preview is (fading in or) playing. */
  playing: boolean;
  /** Optional Web Audio analyser for real-time waveform data. */
  analyser: AnalyserNode | null;
  /** Gothic mute/play toggle — no-op when no preview exists. */
  toggle: () => void;
};

import { useCallback, useEffect, useRef, useState } from "react";
import type { Song } from "@/lib/song/types";

export function useAudioPreview(
  song: Song | null | undefined,
  options: { autoPlay?: boolean } = {},
): AudioPreviewState {
  const previewUrl = song?.previewUrl ?? null;
  const available = typeof previewUrl === "string" && previewUrl.length > 0;
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (active?.audio === audioRef.current) {
      fadeOutActive();
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (!available || !previewUrl) return;
    /* Singleton: whoever is sounding now fades out first. */
    fadeOutActive();
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    /* CORS: set anonymous crossOrigin for potentially CORS-enabled previews.
     * Must be set BEFORE src so the browser doesn't block.
     * If the server doesn't support CORS, the error handler will clean up. */
    audio.crossOrigin = "anonymous";
    audio.src = previewUrl;
    /* Ensure AudioContext is resumed (autoplay policy). */
    const ctx = ensureContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }
    /* Set up Web Audio (source + analyser) for this audio element — one-time only.
     * Connect: source -> analyser -> ctx.destination */
    const { source, analyser } = setupAudioElement(audio);
    /* Wire the active state. */
    const effectiveAnalyser: AnalyserNode | null = source ? analyser : null;
    active = { audio, onInactive: () => setPlaying(false), analyser: effectiveAnalyser };
    /* Play the audio. */
    const p = audio.play();
    /* jsdom returns undefined; browsers return a promise that may reject on
     * the autoplay gesture policy — both paths are safe. */
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        if (active?.audio === audio) active = null;
        setPlaying(false);
      });
    }
    setPlaying(true);
    /* Fade in volume. */
    if (source) {
      rampVolume(audio, 1, FADE_IN_MS, () => {});
    } else {
      audio.volume = 1;
      setPlaying(true);
    }
  }, [available, previewUrl]);

  const toggle = useCallback(() => {
    if (playing) stop();
    else play();
  }, [playing, play, stop]);

  /* Optional autoplay on mount. */
  useEffect(() => {
    if (options.autoPlay && available) play();
    return () => {
      if (audioRef.current && active?.audio === audioRef.current) fadeOutActive();
    };
  }, [previewUrl]);

  const analyserNode = audioRef.current ? sourceMap.get(audioRef.current)?.analyser : null;
  /* The analyser may be undefined if the audio element is not in sourceMap;
   * cast to AnalyserNode | null to satisfy the type. */
  const analyser: AnalyserNode | null = analyserNode !== undefined ? analyserNode : null;
  return { available, playing, analyser, toggle };
}
