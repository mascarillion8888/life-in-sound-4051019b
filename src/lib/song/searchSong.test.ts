import { describe, expect, it, vi } from "vitest";

import { searchSongsLogic, suggestSongsLogic } from "./searchSong.server";
import {
  bestGhostCompletion,
  bestGhostMatch,
  buildSuggestTerm,
  catalogGhostCompletion,
  findConfidentMatch,
  highResArtworkUrl,
  matchCatalogSong,
  parseSongQuery,
  rankSongsFuzzy,
  trackToSong,
} from "./itunes-mapping";
import type { Song } from "./types";

// A realistic-shaped iTunes Search API payload (subset of fields). These are
// canned HTTP responses for unit tests — the provider is never hit live here.
function itunesPayload(results: unknown[]) {
  return { resultCount: results.length, results };
}

const TRACK_FRAGILE = {
  wrapperType: "track",
  kind: "song",
  trackId: 14617433,
  trackName: "Fragile",
  artistName: "Sting",
  collectionName: "...Nothing Like the Sun",
  artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/fragile/100x100bb.jpg",
  releaseDate: "1987-10-01T07:00:00Z",
  previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/fragile.m4a",
};

const TRACK_PAINKILLER = {
  wrapperType: "track",
  kind: "song",
  trackId: 25268,
  trackName: "Painkiller",
  artistName: "Judas Priest",
  collectionName: "Painkiller",
  artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/painkiller/100x100bb.jpg",
};

// Real iTunes result shape, but for a DIFFERENT song than the query asks for.
const TRACK_UNRELATED = {
  wrapperType: "track",
  kind: "song",
  trackId: 14617400,
  trackName: "Russians",
  artistName: "Sting",
  collectionName: "The Dream of the Blue Turtles",
  artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/russians/100x100bb.jpg",
};

const TRACK_DESERT_ROSE = {
  wrapperType: "track",
  kind: "song",
  trackId: 88,
  trackName: "Desert Rose",
  artistName: "Sting",
  collectionName: "Brand New Day",
  artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music/desert-rose/100x100bb.jpg",
};

const COLLECTION_RESULT = {
  wrapperType: "collection",
  collectionId: 999,
  collectionName: "...Nothing Like the Sun",
  artistName: "Sting",
};

describe("itunes mapping: trackToSong", () => {
  it("maps a full track into a verified Song with the itunes provider", () => {
    expect(trackToSong(TRACK_FRAGILE)).toEqual({
      provider: "itunes",
      providerId: "14617433",
      title: "Fragile",
      artist: "Sting",
      album: "...Nothing Like the Sun",
      artworkUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music/fragile/600x600bb.jpg",
      releaseYear: 1987,
      genre: null,
      era: "80s",
      previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/fragile.m4a",
      isrc: null,
      verified: true,
    });
  });

  it("maps the 30s preview URL only when the API supplies one", () => {
    expect(trackToSong(TRACK_FRAGILE)?.previewUrl).toBe(
      "https://audio-ssl.itunes.apple.com/itunes-assets/fragile.m4a",
    );
    const { previewUrl: _omitted, ...noPreview } = TRACK_FRAGILE;
    expect(trackToSong(noPreview)?.previewUrl).toBeNull();
  });

  it("upgrades artworkUrl100 to its high-resolution CDN variant (no fake URL)", () => {
    expect(
      highResArtworkUrl("https://is1-ssl.mzstatic.com/image/thumb/Music/x/100x100bb.jpg"),
    ).toBe("https://is1-ssl.mzstatic.com/image/thumb/Music/x/600x600bb.jpg");
    // Already-hi-res or non-standard URLs pass through unchanged.
    expect(
      highResArtworkUrl("https://is1-ssl.mzstatic.com/image/thumb/Music/x/600x600bb.jpg"),
    ).toBe("https://is1-ssl.mzstatic.com/image/thumb/Music/x/600x600bb.jpg");
    expect(highResArtworkUrl("https://example.com/cover.png")).toBe(
      "https://example.com/cover.png",
    );
  });

  it("maps a non-standard artwork URL through unchanged (never rewritten blindly)", () => {
    const song = trackToSong({ ...TRACK_FRAGILE, artworkUrl100: "https://example.com/cover.png" });
    expect(song?.artworkUrl).toBe("https://example.com/cover.png");
  });

  it("leaves album/artwork null when the API does not supply them (no invented data)", () => {
    const song = trackToSong({
      wrapperType: "track",
      kind: "song",
      trackId: 1,
      trackName: "Fragile",
      artistName: "Sting",
    });
    expect(song).toMatchObject({ album: null, artworkUrl: null, isrc: null, verified: true });
  });

  it("drops results that are not usable song tracks", () => {
    expect(trackToSong(COLLECTION_RESULT)).toBeNull();
    expect(
      trackToSong({
        wrapperType: "track",
        kind: "music-video",
        trackId: 1,
        trackName: "X",
        artistName: "Y",
      }),
    ).toBeNull();
    expect(
      trackToSong({
        wrapperType: "track",
        kind: "song",
        trackName: "Fragile",
        artistName: "Sting",
      }),
    ).toBeNull(); // no trackId
    expect(
      trackToSong({ wrapperType: "track", kind: "song", trackId: 1, artistName: "Sting" }),
    ).toBeNull(); // no trackName
  });
});

describe("itunes mapping: parseSongQuery", () => {
  it("splits separator queries without assuming title/artist order", () => {
    expect(parseSongQuery("Sting - Fragile")).toEqual({
      kind: "pair",
      title: "Sting",
      artist: "Fragile",
    });
    expect(parseSongQuery("Bad - Michael Jackson")).toEqual({
      kind: "pair",
      title: "Bad",
      artist: "Michael Jackson",
    });
    expect(parseSongQuery("Hurt by Johnny Cash")).toEqual({
      kind: "pair",
      title: "Hurt",
      artist: "Johnny Cash",
    });
  });

  it("keeps separator-free queries as free text", () => {
    expect(parseSongQuery("Judas Priest Painkiller")).toEqual({
      kind: "free",
      text: "Judas Priest Painkiller",
    });
    expect(parseSongQuery("Fragile")).toEqual({ kind: "free", text: "Fragile" });
  });

  it("splits on a bare hyphen too (documented: left side becomes the title)", () => {
    expect(parseSongQuery("sting-desert")).toEqual({
      kind: "pair",
      title: "sting",
      artist: "desert",
    });
  });

  it("returns null for an empty query", () => {
    expect(parseSongQuery("   ")).toBeNull();
  });
});

describe("itunes mapping: findConfidentMatch", () => {
  it("accepts a strong match for 'Sting - Fragile' (either field order)", () => {
    const song = findConfidentMatch("Sting - Fragile", itunesPayload([TRACK_FRAGILE]));
    expect(song).toMatchObject({
      title: "Fragile",
      artist: "Sting",
      provider: "itunes",
      verified: true,
    });
    // Reversed order ("title - artist" form) matches the same real track.
    expect(findConfidentMatch("Fragile - Sting", itunesPayload([TRACK_FRAGILE]))?.providerId).toBe(
      "14617433",
    );
  });

  it("matches separator-free queries like 'Judas Priest Painkiller'", () => {
    const song = findConfidentMatch("Judas Priest Painkiller", itunesPayload([TRACK_PAINKILLER]));
    expect(song).toMatchObject({ title: "Painkiller", artist: "Judas Priest" });
    expect(findConfidentMatch("fragile sting", itunesPayload([TRACK_FRAGILE]))?.title).toBe(
      "Fragile",
    );
  });

  it("rejects an unrelated result even when the artist matches", () => {
    // 'Russians' by Sting is a real track but NOT the requested 'Fragile'.
    expect(findConfidentMatch("Sting - Fragile", itunesPayload([TRACK_UNRELATED]))).toBeNull();
  });

  it("rejects a title match by the wrong artist", () => {
    const cover = { ...TRACK_FRAGILE, trackId: 555, artistName: "Someone Else" };
    expect(findConfidentMatch("Sting - Fragile", itunesPayload([cover]))).toBeNull();
  });

  it("rejects vague title-only overlap ('Love' ≠ 'Love of My Life')", () => {
    const queen = {
      ...TRACK_FRAGILE,
      trackId: 777,
      trackName: "Love of My Life",
      artistName: "Queen",
    };
    expect(findConfidentMatch("Queen - Love", itunesPayload([queen]))).toBeNull();
  });

  it("never fabricates a correction for a malformed query ('Stnig Fragile')", () => {
    expect(findConfidentMatch("Stnig Fragile", itunesPayload([TRACK_FRAGILE]))).toBeNull();
    expect(findConfidentMatch("Stnig Fragile", itunesPayload([]))).toBeNull();
  });

  it("returns null for empty or malformed API payloads", () => {
    expect(findConfidentMatch("Sting - Fragile", itunesPayload([]))).toBeNull();
    expect(findConfidentMatch("Sting - Fragile", {})).toBeNull();
    expect(findConfidentMatch("Sting - Fragile", { results: "nope" })).toBeNull();
  });

  it("skips non-track results and matches the first confident track", () => {
    const song = findConfidentMatch(
      "Sting - Fragile",
      itunesPayload([COLLECTION_RESULT, TRACK_UNRELATED, TRACK_FRAGILE]),
    );
    expect(song?.title).toBe("Fragile");
  });
});

describe("searchSongsLogic (iTunes)", () => {
  it("returns [] for an empty query (no provider call)", async () => {
    const fetchImpl = vi.fn();
    const out = await searchSongsLogic({ query: "   " }, { fetchImpl });
    expect(out.results).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns [] for a too-short query (<2 chars)", async () => {
    const fetchImpl = vi.fn();
    const out = await searchSongsLogic({ query: "a" }, { fetchImpl });
    expect(out.results).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("'Sting - Fragile' returns the real matching result, verified", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(itunesPayload([TRACK_FRAGILE])), { status: 200 }),
    );
    const out = await searchSongsLogic({ query: "Sting - Fragile" }, { fetchImpl });
    expect(out.results).toHaveLength(1);
    const song = out.results[0];
    expect(song.provider).toBe("itunes");
    expect(song.verified).toBe(true);
    expect(song.title).toBe("Fragile");
    expect(song.artist).toBe("Sting");
    expect(song.album).toBe("...Nothing Like the Sun");
    expect(song.artworkUrl).toContain("mzstatic.com");
    expect(song.providerId).toBe("14617433");
    expect(song.isrc).toBeNull();

    // The user's free text goes to the iTunes Search API, server-side.
    const url = String(fetchImpl.mock.calls[0][0]);
    expect(url).toContain("itunes.apple.com/search");
    expect(url).toContain(`term=${encodeURIComponent("Sting - Fragile")}`);
    expect(url).toContain("entity=song");
  });

  it("rejects an unrelated API result as a confident match", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(itunesPayload([TRACK_UNRELATED])), { status: 200 }),
    );
    const out = await searchSongsLogic({ query: "Sting - Fragile" }, { fetchImpl });
    expect(out.results).toEqual([]);
  });

  it("returns [] on an empty API response (no verified result)", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(itunesPayload([])), { status: 200 }),
    );
    const out = await searchSongsLogic({ query: "zzzzz-nothing" }, { fetchImpl });
    expect(out.results).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns [] on provider HTTP failure (never throws)", async () => {
    const fetchImpl = vi.fn(async () => new Response("server error", { status: 503 }));
    const out = await searchSongsLogic({ query: "anything" }, { fetchImpl });
    expect(out.results).toEqual([]);
  });

  it("returns [] on provider network rejection (never throws)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });
    const out = await searchSongsLogic({ query: "anything" }, { fetchImpl });
    expect(out.results).toEqual([]);
  });

  it("returns [] on malformed JSON (never throws)", async () => {
    const fetchImpl = vi.fn(async () => new Response("not json", { status: 200 }));
    const out = await searchSongsLogic({ query: "anything" }, { fetchImpl });
    expect(out.results).toEqual([]);
  });

  it("returns [] when the provider request hangs past the timeout (never stalls)", async () => {
    // A fetch that never resolves on its own — only the abort signal ends it.
    const fetchImpl = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const out = await searchSongsLogic({ query: "Sting - Fragile" }, { fetchImpl, timeoutMs: 10 });
    expect(out.results).toEqual([]);
  });
});

describe("buildSuggestTerm (provider query shaping)", () => {
  it("wordizes separators and completes a trailing partial word", () => {
    expect(buildSuggestTerm("sting-frag")).toBe("sting fragile");
    expect(buildSuggestTerm("sting frag")).toBe("sting fragile");
  });

  it("leaves already-complete and short trailing words untouched", () => {
    expect(buildSuggestTerm("sting fragile")).toBe("sting fragile");
    expect(buildSuggestTerm("sting")).toBe("sting");
  });

  it("never invents a word it cannot confidently complete", () => {
    expect(buildSuggestTerm("sting zzz")).toBe("sting zzz");
  });
});

describe("bestGhostMatch (raw-prefix alignment)", () => {
  const fragile = trackToSong(TRACK_FRAGILE)!;

  it("reports the RAW typed length even when a separator was stripped", () => {
    // "sting-frag" → candidate "Sting - Fragile": the hyphen is consumed by
    // normalize(), so the raw prefix length is 9, and slicing the completion
    // there yields the exact suffix to render after the typed text.
    const m = bestGhostMatch("sting-frag", [fragile]);
    expect(m).not.toBeNull();
    expect(m!.completion).toBe("Sting - Fragile");
    expect(m!.completion.slice(m!.rawPrefixLength)).toBe("agile");
  });
});

describe("bestGhostCompletion (ghost-text chain matching)", () => {
  const desertRose = trackToSong(TRACK_DESERT_ROSE)!;
  const fragile = trackToSong(TRACK_FRAGILE)!;

  it("completes the 'Artist - Title' chain from a partial typed prefix", () => {
    expect(bestGhostCompletion("sting-des", [desertRose])).toBe("Sting - Desert Rose");
    expect(bestGhostCompletion("sting des", [desertRose])).toBe("Sting - Desert Rose");
    expect(bestGhostCompletion("Sting - Desert", [desertRose])).toBe("Sting - Desert Rose");
  });

  it("falls back to the bare title chain when the artist chain does not match", () => {
    expect(bestGhostCompletion("frag", [fragile])).toBe("Fragile");
  });

  it("returns null when nothing extends the typed text (never invents)", () => {
    expect(bestGhostCompletion("beatles", [desertRose])).toBeNull();
    expect(bestGhostCompletion("Sting - Desert Rose", [desertRose])).toBeNull();
    expect(bestGhostCompletion("", [desertRose])).toBeNull();
  });

  it("prefers the artist chain over a later result's title chain", () => {
    expect(bestGhostCompletion("sting", [desertRose, fragile])).toBe("Sting - Desert Rose");
  });
});

describe("matchCatalogSong / catalogGhostCompletion (Fuse.js local autocomplete)", () => {
  it("matches free-form and typo'd queries via Fuse (threshold 0.4)", () => {
    expect(catalogGhostCompletion("lionel richie hel")).toBe("Lionel Richie - Hello");
    expect(catalogGhostCompletion("hel lionel")).toBe("Lionel Richie - Hello");
  });
  it("matches 'bad mic' to Michael Jackson - Bad (order-independent)", () => {
    const entry = matchCatalogSong("bad mic", [
      { artist: "Michael Jackson", title: "Bad" },
      { artist: "Sting", title: "Fragile" },
    ]);
    expect(entry).toEqual({ artist: "Michael Jackson", title: "Bad" });
  });

  it("matches 'frag stin' to Sting - Fragile", () => {
    expect(catalogGhostCompletion("frag stin")).toBe("Sting - Fragile");
  });

  it("matches 'sting-frag' to Sting - Fragile (hyphen treated as space)", () => {
    expect(catalogGhostCompletion("sting-frag")).toBe("Sting - Fragile");
  });

  it("matches 'sting des' to Sting - Desert Rose", () => {
    expect(catalogGhostCompletion("sting des")).toBe("Sting - Desert Rose");
  });

  it("is case-insensitive and strips separators: 'madonna -frozen' → Madonna - Frozen", () => {
    expect(catalogGhostCompletion("madonna -frozen")).toBe("Madonna - Frozen");
    expect(catalogGhostCompletion("MADONNA FROZEN")).toBe("Madonna - Frozen");
    expect(catalogGhostCompletion("Frozen madonna")).toBe("Madonna - Frozen");
  });

  it("tolerates letter typos: 'maddona frozn' → Madonna - Frozen", () => {
    expect(catalogGhostCompletion("maddona frozn")).toBe("Madonna - Frozen");
    expect(catalogGhostCompletion("mickael jackson bad")).toBe("Michael Jackson - Bad");
  });

  it("returns null for unrelated input (never fabricates)", () => {
    expect(catalogGhostCompletion("xyz abc")).toBeNull();
    expect(catalogGhostCompletion("qwerty zxcvbn")).toBeNull();
  });

  it("returns null for a single character (tokens under 2 chars are ignored)", () => {
    expect(catalogGhostCompletion("a")).toBeNull();
  });

  it("suggests from two characters onward: 'ab' → an ABBA song", () => {
    expect(catalogGhostCompletion("ab")).toBe("ABBA - Dancing Queen");
  });
});

describe("rankSongsFuzzy (iTunes results re-ranked with Fuse.js)", () => {
  it("surfaces the most relevant fetched track for a fuzzy query", () => {
    const fragile = trackToSong(TRACK_FRAGILE)!;
    const desertRose = trackToSong(TRACK_DESERT_ROSE)!;
    const ranked = rankSongsFuzzy("sting-frag", [desertRose, fragile]);
    expect(ranked[0]).toBe(fragile);
  });

  it("keeps unmatched songs at the end (never drops them)", () => {
    const fragile = trackToSong(TRACK_FRAGILE)!;
    const desertRose = trackToSong(TRACK_DESERT_ROSE)!;
    const ranked = rankSongsFuzzy("madonna frozen", [desertRose, fragile]);
    expect(ranked).toHaveLength(2);
  });

  it("returns songs unchanged for very short queries", () => {
    const fragile = trackToSong(TRACK_FRAGILE)!;
    expect(rankSongsFuzzy("a", [fragile])).toEqual([fragile]);
  });
});

describe("suggestSongsLogic (ghost-text suggestions)", () => {
  it("returns the top iTunes hit without the strict confidence rules", async () => {
    // The strict verification path rejects this (wrong artist for the query)…
    const cover = { ...TRACK_FRAGILE, trackId: 555, artistName: "Someone Else" };
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(itunesPayload([cover])), { status: 200 }),
    );
    const out = await suggestSongsLogic({ query: "Sting - Fragile" }, { fetchImpl });
    // …but the suggestion path still surfaces the provider's top hit.
    expect(out.results).toHaveLength(1);
    expect(out.results[0].title).toBe("Fragile");
  });

  it("returns [] for queries shorter than 3 chars (no provider call)", async () => {
    const fetchImpl = vi.fn();
    const out = await suggestSongsLogic({ query: "St" }, { fetchImpl });
    expect(out.results).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns [] on failure and skips non-track results", async () => {
    const failing = vi.fn(async () => new Response("err", { status: 503 }));
    expect(
      (await suggestSongsLogic({ query: "anything" }, { fetchImpl: failing })).results,
    ).toEqual([]);

    const collectionsOnly = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(itunesPayload([COLLECTION_RESULT])), { status: 200 }),
    );
    expect(
      (await suggestSongsLogic({ query: "anything" }, { fetchImpl: collectionsOnly })).results,
    ).toEqual([]);
  });
});

describe("selection → Song object", () => {
  it("a verified result is a valid Song with guaranteed fields", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify(itunesPayload([TRACK_FRAGILE])), { status: 200 }),
    );
    const out = await searchSongsLogic({ query: "Sting - Fragile" }, { fetchImpl });
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
  });
});
