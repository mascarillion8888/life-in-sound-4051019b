import { beforeEach, describe, expect, it } from "vitest";

import { JOURNEY_STORAGE_KEY } from "./journey-storage";
import { LIFE_FEED_STORAGE_KEY } from "./life-feed";
import { resetJourneySession } from "./reset-session";

function seedJourney() {
  window.localStorage.setItem(
    JOURNEY_STORAGE_KEY,
    JSON.stringify({ current: 8, answers: { 1: "Song A" }, songs: {} }),
  );
}

function seedFeed() {
  window.localStorage.setItem(
    LIFE_FEED_STORAGE_KEY,
    JSON.stringify({
      baseAnswers: { 1: "Song A" },
      baseSongs: {},
      entries: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }),
  );
}

describe("resetJourneySession", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("wipes the journey progress and the life feed from localStorage", async () => {
    seedJourney();
    seedFeed();

    await resetJourneySession(null);

    expect(window.localStorage.getItem(JOURNEY_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(LIFE_FEED_STORAGE_KEY)).toBeNull();
  });

  it("preserves unrelated keys — the language preference survives a reset", async () => {
    window.localStorage.setItem("soundmap:language", "de");
    seedJourney();

    await resetJourneySession(null);

    expect(window.localStorage.getItem("soundmap:language")).toBe("de");
    expect(window.localStorage.getItem(JOURNEY_STORAGE_KEY)).toBeNull();
  });

  it("clears local state for an authenticated user too (remote delete is best-effort)", async () => {
    // No Supabase env in tests — getSupabase() is null, so the remote delete
    // is skipped and the local clear is the observable behavior.
    seedJourney();
    seedFeed();

    await resetJourneySession("user-123");

    expect(window.localStorage.getItem(JOURNEY_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(LIFE_FEED_STORAGE_KEY)).toBeNull();
  });

  it("is a no-op when storage is already empty", async () => {
    await expect(resetJourneySession(null)).resolves.toBeUndefined();
    expect(window.localStorage.length).toBe(0);
  });
});
