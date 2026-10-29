// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Song } from "@/lib/song/types";

import { useAudioPreview } from "./useAudioPreview";

function songWith(previewUrl: string | null): Song {
  return {
    provider: "itunes",
    providerId: "1",
    title: "Fragile",
    artist: "Sting",
    album: null,
    artworkUrl: null,
    isrc: null,
    previewUrl,
  };
}

describe("useAudioPreview", () => {
  beforeEach(() => {
    // jsdom's Audio.play is "not implemented"; stub both media methods.
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    // rAF runs synchronously in tests so fades complete immediately.
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(performance.now() + 1000);
      return 0;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports unavailable without a previewUrl and never fabricates audio", () => {
    const { result } = renderHook(() => useAudioPreview(songWith(null)));
    expect(result.current.available).toBe(false);
    expect(result.current.playing).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(false);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });

  it("reports unavailable for a missing song entirely", () => {
    const { result } = renderHook(() => useAudioPreview(null));
    expect(result.current.available).toBe(false);
  });

  it("plays with fade-in on toggle when a preview exists", () => {
    const { result } = renderHook(() => useAudioPreview(songWith("https://x/p.m4a")));
    expect(result.current.available).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(true);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it("toggle again fades out and stops", () => {
    const { result } = renderHook(() => useAudioPreview(songWith("https://x/p.m4a")));
    act(() => result.current.toggle());
    act(() => result.current.toggle());
    expect(result.current.playing).toBe(false);
  });

  it("starting a second card fades out the first (singleton)", () => {
    const first = renderHook(() => useAudioPreview(songWith("https://x/a.m4a")));
    const second = renderHook(() => useAudioPreview(songWith("https://x/b.m4a")));
    act(() => first.result.current.toggle());
    expect(first.result.current.playing).toBe(true);
    act(() => second.result.current.toggle());
    expect(second.result.current.playing).toBe(true);
    // The singleton handoff notified the first card: its flag cleared and its
    // audio element was faded out and paused.
    expect(first.result.current.playing).toBe(false);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it("survives an autoplay rejection without throwing (gesture policy)", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(
      new DOMException("Autoplay blocked", "NotAllowedError"),
    );
    const { result } = renderHook(() =>
      useAudioPreview(songWith("https://x/p.m4a"), { autoPlay: true }),
    );
    // Flush the rejected promise.
    await act(async () => Promise.resolve());
    expect(result.current.playing).toBe(false);
  });

  it("autoplays on mount when enabled", () => {
    renderHook(() => useAudioPreview(songWith("https://x/p.m4a"), { autoPlay: true }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it("fades out on unmount", () => {
    const { result, unmount } = renderHook(() => useAudioPreview(songWith("https://x/p.m4a")));
    act(() => result.current.toggle());
    unmount();
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });
});
