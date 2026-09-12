// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { extractSongFeatures, getGenreFromSong, getMoodFromSong } from "@/lib/ai/musicFeatures";
import { trackToSong } from "@/lib/song/itunes-mapping";
import { loadJourney, saveJourney } from "@/lib/journey-storage";

/**
 * Bulgu 3 smoke test — the genre field end-to-end:
 *
 *   iTunes JSON → trackToSong (Song.genre) → saveJourney → loadJourney
 *   (normalizeSong round-trip) → extractSongFeatures / results consumers.
 *
 * A regression anywhere in the pipeline (mapping, persistence, engine input)
 * fails here instead of silently showing "unknown" genres in the UI.
 */

const ITUNES_JAZZ_TRACK = {
  wrapperType: "track",
  kind: "song",
  trackId: 401953,
  trackName: "So What",
  artistName: "Miles Davis",
  collectionName: "Kind of Blue",
  artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/kind-of-blue/100x100bb.jpg",
  releaseDate: "1959-08-17T07:00:00Z",
  previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/so-what.m4a",
  primaryGenreName: "Jazz",
};

const ITUNES_SYNTH_TRACK = {
  wrapperType: "track",
  kind: "song",
  trackId: 7322,
  trackName: "Take On Me",
  artistName: "A-ha",
  collectionName: "Hunting High and Low",
  artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/a-ha/100x100bb.jpg",
  releaseDate: "1985-10-19T07:00:00Z",
  // No primaryGenreName at all — genre must normalize to null, never undefined.
};

describe("genre pipeline: iTunes → Song → storage → engine", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("carries genre from the iTunes payload to the engine input without loss", () => {
    const jazz = trackToSong(ITUNES_JAZZ_TRACK)!;
    const synth = trackToSong(ITUNES_SYNTH_TRACK)!;
    expect(jazz.genre).toBe("Jazz");
    expect(synth.genre).toBeNull(); // absent genre = unknown, not undefined

    // Persist + reload — the storage layer must keep both values.
    saveJourney({
      current: 1,
      answers: { 1: jazz.title, 2: synth.title },
      songs: { 1: jazz, 2: synth },
    });
    const reloaded = loadJourney();
    expect(reloaded?.songs[1].genre).toBe("Jazz");
    expect(reloaded?.songs[2].genre).toBeNull();
    expect(reloaded?.songs[1].mood).toBeNull();
    expect(reloaded?.songs[1].provider).toBe("itunes");

    // The results-page consumer reads the same value the UI renders with.
    const jazzFeatures = extractSongFeatures(reloaded!.songs[1]);
    expect(getGenreFromSong(jazzFeatures)).toBe("Jazz");
    expect(getMoodFromSong(jazzFeatures)).toBeNull();
  });
});