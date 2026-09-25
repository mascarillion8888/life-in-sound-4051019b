import { describe, expect, it } from "vitest";

import type { Song } from "./types";

import { collectUnverifiedManualSongs, songVerifyKey } from "./enrich-songs";

function manual(title: string, qid: number): [number, Song] {
  return [
    qid,
    {
      provider: "manual",
      providerId: `manual-${qid}`,
      title,
      artist: "",
      album: null,
      artworkUrl: null,
      releaseYear: null,
      previewUrl: null,
      isrc: null,
      genre: null,
      mood: null,
    },
  ];
}

describe("collectUnverifiedManualSongs — committed-song verification guarantee", () => {
  it("flags a fast-submitted manual song for verification even though navigation happened", () => {
    // "Michael Jackson": typed + submitted quickly, then navigated to next Q.
    // Because the requested-set is separate from the live debounce, the song is
    // NOT lost — it is returned once for a background verification request.
    const [q1, mj] = manual("Michael Jackson", 1);
    const [, second] = manual("Thriller", 2);
    const requested = new Set<string>();
    const pending = collectUnverifiedManualSongs({ 1: mj, 2: second }, requested);
    expect(pending).toHaveLength(2);
    expect(pending[0].questionId).toBe(1);
    expect(pending[0].song.title).toBe("Michael Jackson");
  });

  it("does not re-request a manual song that was already requested (dedupe)", () => {
    const [q1, mj] = manual("Michael Jackson", 1);
    const requested = new Set<string>([songVerifyKey(q1, mj.title)]);
    expect(collectUnverifiedManualSongs({ 1: mj }, requested)).toHaveLength(0);
  });

  it("skips non-manual songs and songs already carrying artwork", () => {
    const verified: Song = {
      provider: "itunes",
      providerId: "42",
      title: "Thriller",
      artist: "Michael Jackson",
      album: "Thriller",
      artworkUrl: "https://example.com/art.jpg",
      releaseYear: 1982,
      previewUrl: null,
      isrc: null,
      genre: "Pop",
      mood: null,
    };
    const [q1, manualSong] = manual("Billie Jean", 1);
    const pending = collectUnverifiedManualSongs({ 1: manualSong, 2: verified }, new Set<string>());
    expect(pending).toEqual([{ questionId: 1, song: manualSong }]);
  });

  it("keying is stable per question + title, case-insensitive", () => {
    expect(songVerifyKey(1, "Michael Jackson")).toBe(songVerifyKey(1, "michael jackson"));
    expect(songVerifyKey(1, "Michael Jackson")).not.toBe(songVerifyKey(2, "Michael Jackson"));
  });
});
