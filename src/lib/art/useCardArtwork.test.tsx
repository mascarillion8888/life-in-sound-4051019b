// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Song } from "@/lib/song/types";

// The server function is a network boundary; its real logic is covered by
// cardArtwork.server.test.ts. Here it is stubbed so the hook's cache tiers
// can be exercised deterministically.
const generateMock = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  getSupabase: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "user-1" }, access_token: "test-token" } },
      }),
    },
  }),
}));
vi.mock("./cardArtwork.server", () => ({
  generateCardArtwork: (args: unknown) => generateMock(args),
}));

import { __clearCardArtworkMemoryCache, cardArtworkKey, useCardArtwork } from "./useCardArtwork";

function song(overrides: Partial<Song> = {}): Song {
  return {
    provider: "itunes",
    providerId: "42",
    title: "Fragile",
    artist: "Sting",
    album: null,
    artworkUrl: "https://example.com/art.jpg",
    isrc: null,
    ...overrides,
  };
}

describe("cardArtworkKey", () => {
  it("keys provider songs by provider track id", () => {
    expect(cardArtworkKey(song())).toBe("itunes:42");
  });

  it("keys manual songs by artist + title (per-question slugs must not collide)", () => {
    const manual = song({ provider: "manual", providerId: "manual-3", artist: "Sting" });
    expect(cardArtworkKey(manual)).toBe("manual:sting:fragile");
  });
});

describe("useCardArtwork", () => {
  beforeEach(() => {
    __clearCardArtworkMemoryCache();
    window.localStorage.clear();
    generateMock.mockReset();
  });

  it("stays idle without a song", () => {
    const { result } = renderHook(() => useCardArtwork(null));
    expect(result.current.status).toBe("idle");
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("serves a user-scoped persisted painting after resolving the anonymous session", async () => {
    window.localStorage.setItem(
      "soundmap.card-art.v1",
      JSON.stringify({ "user-1:itunes:42": "data:image/png;base64,AA==" }),
    );
    const { result } = renderHook(() => useCardArtwork(song()));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.imageUrl).toBe("data:image/png;base64,AA==");
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("generates once, then re-renders from the memory tier", async () => {
    generateMock.mockResolvedValue({ image: "data:image/png;base64,BB==" });
    const first = renderHook(() => useCardArtwork(song()));
    expect(first.result.current.status).toBe("loading");
    await waitFor(() => expect(first.result.current.status).toBe("ready"));
    expect(first.result.current.imageUrl).toBe("data:image/png;base64,BB==");

    // Persisted tier written for the next reload.
    const persisted = JSON.parse(
      window.localStorage.getItem("soundmap.card-art.v1") ?? "{}",
    ) as Record<string, string>;
    expect(persisted["user-1:itunes:42"]).toBe("data:image/png;base64,BB==");

    // A second mount is instant and does not spend another API call.
    const second = renderHook(() => useCardArtwork(song()));
    await waitFor(() => expect(second.result.current.status).toBe("ready"));
    expect(generateMock).toHaveBeenCalledTimes(1);
  });

  it("maps generation failure to the static placeholder — never a substituted cover", async () => {
    generateMock.mockResolvedValue({ image: null });
    const { result } = renderHook(() => useCardArtwork(song()));
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(result.current.imageUrl).toBeNull();
  });
});
