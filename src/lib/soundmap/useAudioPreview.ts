/**
 * 30-second audio preview playback for the Dynamic Life Cards.
 *
 * The preview URL comes straight from the Song model (`previewUrl`, supplied
 * by iTunes/Spotify — never fabricated). Playback is a single global
 * instance: starting one card fades out whichever card is currently playing,
 * so eight mounted cards can never overlap. Fades are rAF volume ramps;
 * autoplay rejections (browser gesture policy) are swallowed silently and the
 * card simply stays stopped behind its toggle.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { Song } from "@/lib/song/types";

const FADE_IN_MS = 900;
const FADE_OUT_MS = 450;

type Active = { audio: HTMLAudioElement; onInactive: () => void };
/** The one card allowed to sound at any moment. */
let active: Active | null = null;

function rampVolume(audio: HTMLAudioElement, to: number, ms: number, done: () => void): void {
  const from = audio.volume;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    // Clamp: 0.7 + 0.3 can be 1.0000000000000002, which throws IndexSizeError.
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

/** Fade out and release the globally active preview, if any. The owning
 * card is notified so its `playing` flag clears too. */
function fadeOutActive(): void {
  const a = active;
  if (!a) return;
  active = null;
  a.onInactive();
  rampVolume(a.audio, 0, FADE_OUT_MS, () => {
    a.audio.pause();
    a.audio.src = "";
  });
}

export type AudioPreviewState = {
  /** True when the song carries a real provider preview URL. */
  available: boolean;
  /** True while this card's preview is (fading in or) playing. */
  playing: boolean;
  /** Gothic mute/play toggle — no-op when no preview exists. */
  toggle: () => void;
  /** Playback position as 0..1 (0 when stopped or no preview). */
  progress: number;
  /** Seconds played so far. */
  currentTime: number;
  /** Live playback position in seconds — cheap to call from rAF loops. */
  getTime: () => number;
  /** Preview length in seconds (30 until the real duration is known). */
  duration: number;
};

const DEFAULT_DURATION = 30;
const TIME_TICK_MS = 200;

export function useAudioPreview(
  song: Song | null | undefined,
  options: { autoPlay?: boolean } = {},
): AudioPreviewState {
  const previewUrl = song?.previewUrl ?? null;
  const available = typeof previewUrl === "string" && previewUrl.length > 0;
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [time, setTime] = useState({ cur: 0, dur: DEFAULT_DURATION });

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
    // Singleton: whoever is sounding now fades out first.
    fadeOutActive();
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    audio.src = previewUrl;
    audio.volume = 0;
    audio.onended = () => {
      if (active?.audio === audio) active = null;
      setPlaying(false);
      setTime((t) => ({ ...t, cur: t.dur }));
    };
    setTime({ cur: 0, dur: DEFAULT_DURATION });
    active = { audio, onInactive: () => setPlaying(false) };
    const p = audio.play();
    // jsdom returns undefined; browsers return a promise that may reject on
    // the autoplay gesture policy — both paths are safe here.
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        if (active?.audio === audio) active = null;
        setPlaying(false);
      });
    }
    setPlaying(true);
    rampVolume(audio, 1, FADE_IN_MS, () => {});
  }, [available, previewUrl]);

  // Position ticker: only runs while this card is playing.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const a = audioRef.current;
      if (!a) return;
      const dur = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : DEFAULT_DURATION;
      setTime({ cur: Math.min(a.currentTime, dur), dur });
    }, TIME_TICK_MS);
    return () => clearInterval(id);
  }, [playing]);

  const getTime = useCallback(() => audioRef.current?.currentTime ?? 0, []);

  const toggle = useCallback(() => {
    if (playing) stop();
    else play();
  }, [playing, play, stop]);

  // Optional autoplay on mount (results page was reached via user gesture).
  useEffect(() => {
    if (options.autoPlay && available) play();
    // Fade out when the card unmounts or the song changes (card transition).
    return () => {
      if (audioRef.current && active?.audio === audioRef.current) fadeOutActive();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  const progress = playing || time.cur > 0 ? Math.max(0, Math.min(1, time.cur / time.dur)) : 0;
  return { available, playing, toggle, progress, currentTime: time.cur, duration: time.dur, getTime };
}
