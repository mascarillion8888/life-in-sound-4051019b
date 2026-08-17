import { describe, expect, it, vi } from "vitest";

import { searchSongsLogic } from "./searchSong.server";
import {
  extractArtistName,
  extractFirstIsrc,
  extractFirstRelease,
  mapRecordingsToSongs,
  pickArtworkUrl,
  recordingToSong,
} from "./musicbrainz-mapping";
import type { Song } from "./types";

// A realistic-shaped MusicBrainz recording-search payload (subset of fields).
function mbPayload(recordings: unknown[]) {
  return { created: "2024-01-01", count: recordings.length, offset: 0, recordings };
}

const RECORDING_FULL = {
  id: "11111111-2222-3333-4444-555555555555",
  title: "  Upside Down  ",
  "artist-credit": [{ name: "Jack Johnson", artist: { name: "Jack Johnson" } }],
  releases: [{ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", title: "Sing-A-Longs and Lullabies" }],
  isrcs: ["USCA10123456"],
};

const RECORDING_MISSING_ARTIST = {
  id: "22222222-3333-4444-5555-666666666666",
  title: "No Artist Track",
  "artist-credit": [],
  releases: [],
  isrcs: [],
};

const RECORDING_BAD_ID = {
  id: "not-a-uuid",
  title: "Bad Id Track",
  "artist-credit": [{ name: "Someone" }],
  releases: [],
  isrcs: [],
};

describe("mapping: recordingToSong", () => {
  it("maps a full recording into a Song with null artwork", () => {
    const song = recordingToSong(RECORDING_FULL);
    expect(song).toEqual({
      provider: "musicbrainz",
      providerId: "11111111-2222-3333-4444-555555555555",
      title: "Upside Down",
      artist: "Jack Johnson",
      album: "Sing-A-Longs and Lullabies",
      isrc: "USCA10123456",
      artworkUrl: null,
    });
  });

  it("drops a recording with no artist credit", () => {
    expect(recordingToSong(RECORDING_MISSING_ARTIST)).toBeNull();
  });

  it("drops a recording with a malformed MBID", () => {
    expect(recordingToSong(RECORDING_BAD_ID)).toBeNull();
  });
});

describe("mapping: sub-extractors", () => {
  it("extractArtistName returns null on empty credit", () => {
    expect(extractArtistName({ "artist-credit": [] })).toBeNull();
    expect(extractArtistName({} as never)).toBeNull();
  });

  it("extractFirstRelease returns nulls when no releases", () => {
    expect(extractFirstRelease({ releases: [] })).toEqual({ album: null, releaseId: null });
  });

  it("extractFirstIsrc returns null on empty isrcs", () => {
    expect(extractFirstIsrc({ isrcs: [] })).toBeNull();
    expect(extractFirstIsrc({} as never)).toBeNull();
  });

  it("pickArtworkUrl prefers large thumbnail then full image", () => {
    expect(
      pickArtworkUrl({ images: [{ image: "full.jpg", thumbnails: { large: "large.jpg" } }] }),
    ).toBe("large.jpg");
    expect(pickArtworkUrl({ images: [{ image: "full.jpg" }] })).toBe("full.jpg");
    expect(pickArtworkUrl({ images: [] })).toBeNull();
    expect(pickArtworkUrl(null)).toBeNull();
  });
});

describe("mapping: mapRecordingsToSongs", () => {
  it("keeps valid recordings and drops invalid ones, preserving order", () => {
    const songs = mapRecordingsToSongs(
      mbPayload([RECORDING_FULL, RECORDING_BAD_ID, RECORDING_MISSING_ARTIST]),
    );
    expect(songs).toHaveLength(1);
    expect(songs[0].title).toBe("Upside Down");
  });

  it("returns [] when recordings is missing/not an array", () => {
    expect(mapRecordingsToSongs({})).toEqual([]);
    expect(mapRecordingsToSongs({ recordings: "nope" })).toEqual([]);
  });
});

describe("searchSongsLogic", () => {
  it("returns [] for an empty query (no provider call)", async () => {
    const fetchImpl = vi.fn();
    const out = await searchSongsLogic({ query: "   " }, { fetchImpl, skipRateLimit: true });
    expect(out.results).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns [] for a too-short query (<2 chars)", async () => {
    const fetchImpl = vi.fn();
    const out = await searchSongsLogic({ query: "a" }, { fetchImpl, skipRateLimit: true });
    expect(out.results).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns [] on zero results from MusicBrainz", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(mbPayload([])), { status: 200 }),
    );
    const out = await searchSongsLogic(
      { query: "zzzzz-nothing" },
      { fetchImpl, skipRateLimit: true },
    );
    expect(out.results).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("musicbrainz.org/ws/2/recording");
  });

  it("maps real results into Song[] with provider musicbrainz", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify(mbPayload([RECORDING_FULL])), { status: 200 }),
    );
    const out = await searchSongsLogic(
      { query: "Upside Down" },
      { fetchImpl, skipRateLimit: true },
    );
    expect(out.results).toHaveLength(1);
    const song = out.results[0];
    expect(song.provider).toBe("musicbrainz");
    expect(song.title).toBe("Upside Down");
    expect(song.artist).toBe("Jack Johnson");
    expect(song.album).toBe("Sing-A-Longs and Lullabies");
    expect(song.isrc).toBe("USCA10123456");
  });

  it("returns [] on provider HTTP failure (never throws)", async () => {
    const fetchImpl = vi.fn(async () => new Response("server error", { status: 503 }));
    const out = await searchSongsLogic({ query: "anything" }, { fetchImpl, skipRateLimit: true });
    expect(out.results).toEqual([]);
  });

  it("returns [] on provider network rejection (never throws)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });
    const out = await searchSongsLogic({ query: "anything" }, { fetchImpl, skipRateLimit: true });
    expect(out.results).toEqual([]);
  });

  it("returns [] on malformed JSON (never throws)", async () => {
    const fetchImpl = vi.fn(async () => new Response("not json", { status: 200 }));
    const out = await searchSongsLogic({ query: "anything" }, { fetchImpl, skipRateLimit: true });
    expect(out.results).toEqual([]);
  });
});

describe("selection → Song object", () => {
  it("a selected result is a valid Song with guaranteed fields", () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify(mbPayload([RECORDING_FULL])), { status: 200 }),
    );
    return searchSongsLogic({ query: "Upside Down" }, { fetchImpl, skipRateLimit: true }).then(
      (out) => {
        expect(out.results.length).toBeGreaterThan(0);
        const selected: Song = out.results[0];
        // Guaranteed, non-nullable fields:
        expect(typeof selected.provider).toBe("string");
        expect(selected.provider.length).toBeGreaterThan(0);
        expect(typeof selected.providerId).toBe("string");
        expect(selected.providerId.length).toBeGreaterThan(0);
        expect(typeof selected.title).toBe("string");
        expect(selected.title.length).toBeGreaterThan(0);
        expect(typeof selected.artist).toBe("string");
        expect(selected.artist.length).toBeGreaterThan(0);
        // Nullable fields may be null but must be present:
        expect("album" in selected).toBe(true);
        expect("artworkUrl" in selected).toBe(true);
        expect("isrc" in selected).toBe(true);
      },
    );
  });
});
