import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Song } from "@/lib/song/types";

import { inferMood } from "./moodInference";
import { __resetSongMoodAttempts, resolveSongMood, songMoodKey } from "./enrichSongMood";

vi.mock("./moodInference", () => ({ inferMood: vi.fn() }));

const mockedInferMood = vi.mocked(inferMood);

function song(overrides: Partial<Song> = {}): Song {
  return {
    provider: "itunes",
    providerId: "42",
    title: "Dark Side of the Moon",
    artist: "Pink Floyd",
    album: null,
    artworkUrl: null,
    isrc: null,
    ...overrides,
  };
}

describe("resolveSongMood — journey-time mood enrichment", () => {
  beforeEach(() => {
    mockedInferMood.mockReset();
    __resetSongMoodAttempts();
  });

  it("stamps the inferred mood onto Song.mood", async () => {
    mockedInferMood.mockResolvedValue("Dark");
    const out = await resolveSongMood(song());
    expect(out.mood).toBe("Dark");
    expect(mockedInferMood).toHaveBeenCalledTimes(1);
  });

  it("leaves the Song untouched (same reference) when inference returns null — never guessed", async () => {
    mockedInferMood.mockResolvedValue(null);
    const s0 = song();
    const out = await resolveSongMood(s0);
    expect(out).toBe(s0);
    expect(out.mood ?? null).toBeNull();
  });

  it("does not re-infer a song that already carries a mood", async () => {
    const s = song({ mood: "Romantic" });
    const out = await resolveSongMood(s);
    expect(out.mood).toBe("Romantic");
    expect(mockedInferMood).not.toHaveBeenCalled();
  });

  it("dedupes within a session: a repeat call for a null-mood song does not re-call inference", async () => {
    mockedInferMood.mockResolvedValue(null);
    await resolveSongMood(song());
    await resolveSongMood(song());
    expect(mockedInferMood).toHaveBeenCalledTimes(1);
  });

  it("resolves cleanly when inference rejects — never throws, mood stays null", async () => {
    mockedInferMood.mockRejectedValue(new Error("boom"));
    const out = await resolveSongMood(song());
    expect(out.mood ?? null).toBeNull();
  });

  it("keying is stable per track and distinct per song", () => {
    expect(songMoodKey(song({ providerId: "7" }))).toBe("itunes:7");
    expect(songMoodKey(song({ provider: "manual", providerId: "manual-3" }))).toBe(
      "manual:pink floyd:dark side of the moon",
    );
  });
});
