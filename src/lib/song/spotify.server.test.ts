import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetSpotifyTokenCache, spotifySuggestSongsLogic } from "./spotify.server";

function jsonResponse(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 500,
    headers: { "content-type": "application/json" },
  });
}

const TRACK_FRAGILE = {
  id: "3aKkxa3BQ1Q7mUz3o9YxG1",
  name: "Fragile",
  artists: [{ name: "Sting" }],
  album: {
    name: "...Nothing Like the Sun",
    release_date: "1987-10-01",
    images: [{ url: "https://i.scdn.co/image/fragile" }],
  },
};

const TRACK_TARKAN = {
  id: "tarkan-dudu",
  name: "Dudu",
  artists: [{ name: "Tarkan" }],
  album: {
    name: "Dudu",
    release_date: "2003",
    images: [{ url: "https://i.scdn.co/image/dudu" }],
  },
};

function tokenOk() {
  return jsonResponse({ access_token: "tok-123", token_type: "Bearer", expires_in: 3600 });
}

describe("spotifySuggestSongsLogic", () => {
  beforeEach(() => {
    resetSpotifyTokenCache();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns [] when SPOTIFY env vars are absent (fallback to iTunes)", async () => {
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
    const fetchImpl = vi.fn();
    const out = await spotifySuggestSongsLogic({ query: "Sting Fragile" }, { fetchImpl });
    expect(out.results).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps a Spotify track into a provider-neutral Song", async () => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "id");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "secret");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(jsonResponse({ tracks: { items: [TRACK_FRAGILE] } }));
    const out = await spotifySuggestSongsLogic({ query: "Sting - Fragile" }, { fetchImpl });
    expect(out.results).toHaveLength(1);
    const song = out.results[0]!;
    expect(song.provider).toBe("spotify");
    expect(song.providerId).toBe("3aKkxa3BQ1Q7mUz3o9YxG1");
    expect(song.title).toBe("Fragile");
    expect(song.artist).toBe("Sting");
    expect(song.album).toBe("...Nothing Like the Sun");
    expect(song.artworkUrl).toBe("https://i.scdn.co/image/fragile");
    expect(song.releaseYear).toBe(1987);
    expect(song.verified).toBe(true);
  });

  it("handles Turkish titles without inventing data", async () => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "id");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "secret");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(jsonResponse({ tracks: { items: [TRACK_TARKAN] } }));
    const out = await spotifySuggestSongsLogic({ query: "tarkan dudu" }, { fetchImpl });
    expect(out.results).toHaveLength(1);
    expect(out.results[0]!.title).toBe("Dudu");
    expect(out.results[0]!.artist).toBe("Tarkan");
  });

  it("returns [] on a token failure (never throws)", async () => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "id");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "secret");
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error("network down"));
    const out = await spotifySuggestSongsLogic({ query: "x" }, { fetchImpl });
    expect(out.results).toEqual([]);
  });

  it("returns [] on a search failure (never throws)", async () => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "id");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "secret");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenOk())
      .mockRejectedValueOnce(new Error("timeout"));
    const out = await spotifySuggestSongsLogic({ query: "opeth" }, { fetchImpl });
    expect(out.results).toEqual([]);
  });

  it("returns [] for a malformed search payload", async () => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "id");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "secret");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(jsonResponse({ tracks: null }));
    const out = await spotifySuggestSongsLogic({ query: "coco jamboo" }, { fetchImpl });
    expect(out.results).toEqual([]);
  });

  it("ignores tracks missing id/title/artist", async () => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "id");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "secret");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(tokenOk())
      .mockResolvedValueOnce(
        jsonResponse({
          tracks: {
            items: [
              { id: "ok", name: "Good", artists: [{ name: "Band" }] },
              { id: "bad", name: "", artists: [{ name: "Band" }] },
              { id: "bad2", name: "Song", artists: [] },
            ],
          },
        }),
      );
    const out = await spotifySuggestSongsLogic({ query: "good band" }, { fetchImpl });
    expect(out.results).toHaveLength(1);
    expect(out.results[0]!.providerId).toBe("ok");
  });
});
