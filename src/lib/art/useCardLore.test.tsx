// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Song } from "@/lib/song/types";

// The server fn is a network boundary (covered by generateCard.server.test.ts).
// Stub it and the Supabase client so the hook's invalidation side-effect can
// be exercised deterministically.
const generateMock = vi.fn();
vi.mock("./generateCard.server", () => ({
  generateCard: (args: unknown) => generateMock(args),
}));
vi.mock("@/lib/supabase/client", () => ({
  getSupabase: () => null,
}));

const invalidateMock = vi.fn();
vi.mock("@/lib/supabase/cards-remote", () => ({
  invalidateCardsCache: () => invalidateMock(),
  loadRemoteCards: vi.fn().mockResolvedValue([]),
  loadGalleryCards: vi.fn().mockResolvedValue([]),
}));

import { __clearCardLoreCache, useCardLore } from "./useCardLore";

function song(): Song {
  return {
    provider: "itunes",
    providerId: "42",
    title: "Fragile",
    artist: "Sting",
    album: null,
    artworkUrl: null,
    isrc: null,
  };
}

describe("useCardLore — persistence cache invalidation", () => {
  beforeEach(() => {
    __clearCardLoreCache();
    generateMock.mockReset();
    invalidateMock.mockReset();
  });

  it("invalidates the gallery card cache when the server persists a card", async () => {
    generateMock.mockResolvedValue({
      lore: "A child hums along in the lamplight. The song never leaves the room.",
      image: null,
      scene: "gothic",
      persisted: true,
    });

    const { result } = renderHook(() => useCardLore(song()));

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(invalidateMock).toHaveBeenCalledTimes(1);
  });

  it("does not invalidate when persistence is skipped", async () => {
    generateMock.mockResolvedValue({
      lore: "Only a scent of rain remains. It carries her voice back.",
      image: null,
      scene: "gothic",
      persisted: false,
    });

    const { result } = renderHook(() => useCardLore(song()));

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it("keeps the deterministic lore and does not invalidate when the server call fails", async () => {
    generateMock.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useCardLore(song()));

    // Failures resolves to null (never an empty-but-persisted card), and no
    // invalidation fires because nothing was written.
    await waitFor(() => expect(generateMock).toHaveBeenCalledTimes(1));
    expect(result.current).toBeNull();
    expect(invalidateMock).not.toHaveBeenCalled();
  });
});
