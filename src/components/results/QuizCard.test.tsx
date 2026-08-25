// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildLifeCards } from "@/lib/soundmap/lifeCards";
import { __clearCardArtworkMemoryCache } from "@/lib/art/useCardArtwork";
import type { Song } from "@/lib/song/types";

import { QuizCard } from "./QuizCard";

// Audio playback is stubbed — jsdom cannot play media.
vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

function song(overrides: Partial<Song> = {}): Song {
  return {
    provider: "itunes",
    providerId: "42",
    title: "Fragile",
    artist: "Sting",
    album: "...Nothing Like the Sun",
    artworkUrl: "https://example.com/art.jpg",
    previewUrl: "https://example.com/preview.m4a",
    isrc: null,
    verified: true,
    ...overrides,
  };
}

const cards = buildLifeCards();

describe("QuizCard", () => {
  beforeEach(() => {
    __clearCardArtworkMemoryCache();
    window.localStorage.clear();
  });

  it("renders the MTG frame: dynamic title, age badge, type line, score shield", () => {
    render(<QuizCard card={cards[0]} song={song()} />);
    // Dynamic per-track title (deterministic companion), not static filler.
    expect(screen.getByText(/DISCOVERY & [A-Z]+/)).toBeTruthy();
    expect(screen.getByText("Ages 5-9")).toBeTruthy();
    expect(screen.getByText("Legendary Life Era")).toBeTruthy();
    // Score shield computed from the track identity.
    expect(screen.getByText(/\/10 INNOCENCE/)).toBeTruthy();
    expect(screen.getByText(/Intensity 35/)).toBeTruthy();
    // Body weaves the era narrative with the track's metadata.
    expect(screen.getByText(/vast and soft/)).toBeTruthy();
    expect(screen.getByText(/carried by Fragile by Sting/)).toBeTruthy();
  });

  it("never shows a blank box — the painterly-filtered cover is the instant fallback", () => {
    render(<QuizCard card={cards[0]} song={song()} />);
    expect(screen.getByText(/Fragile — Sting/)).toBeTruthy();
    // The provider cover is visible IMMEDIATELY (painterly grading applied),
    // while the painting generates in the background — no empty icon box.
    const fallback = screen.getByTestId("card-art-fallback") as HTMLImageElement;
    expect(fallback.src).toContain("art.jpg");
    expect(fallback.style.filter).toContain("sepia");
    expect(screen.queryByTestId("card-art-placeholder")).toBeNull();
  });

  it("cross-fades the AI painting over the fallback cover when one is ready", () => {
    window.localStorage.setItem(
      "soundmap.card-art.v1",
      JSON.stringify({ "itunes:42": "data:image/png;base64,AA==" }),
    );
    render(<QuizCard card={cards[0]} song={song()} />);
    // Base layer: the filtered cover.
    const fallback = screen.getByTestId("card-art-fallback") as HTMLImageElement;
    expect(fallback.src).toContain("art.jpg");
    // Top layer: the cached painting, fading in (aria-hidden — the cover's
    // alt already describes the art).
    const ai = screen.getByTestId("card-art-ai") as HTMLImageElement;
    expect(ai.src).toContain("data:image/png;base64,AA==");
    expect(ai.className).toContain("fade-in");
  });

  it("keeps the filtered cover as the primary visual when AI generation fails", async () => {
    // No cache, no key — generation resolves unavailable; the cover stays.
    render(<QuizCard card={cards[0]} song={song()} />);
    const fallback = screen.getByTestId("card-art-fallback") as HTMLImageElement;
    expect(fallback.src).toContain("art.jpg");
    expect(screen.queryByTestId("card-art-ai")).toBeNull();
  });

  it("shows the gothic placeholder only for coverless songs while generating", () => {
    render(<QuizCard card={cards[0]} song={song({ artworkUrl: null })} />);
    expect(screen.queryByTestId("card-art-fallback")).toBeNull();
    expect(screen.getByTestId("card-art-placeholder").dataset.generating).toBe("true");
  });

  it("adapts the artwork scene to the song's era and shows the era badge", () => {
    const { rerender } = render(<QuizCard card={cards[0]} song={song({ releaseYear: 1987 })} />);
    expect(screen.getByTestId("quiz-card-1").dataset.mount).toBe("cassette-desk");
    expect(screen.getByText("'80s")).toBeTruthy();

    rerender(<QuizCard card={cards[0]} song={song({ releaseYear: 1974 })} />);
    expect(screen.getByTestId("quiz-card-1").dataset.mount).toBe("vinyl-sleeve");
    expect(screen.getByText("'70s")).toBeTruthy();

    // No release year → mount falls back to the card's journey position,
    // and no era badge is shown.
    rerender(<QuizCard card={cards[0]} song={song()} />);
    expect(screen.getByTestId("quiz-card-1").dataset.mount).toBe("vinyl-sleeve");
    expect(screen.queryByText("'80s")).toBeNull();
  });

  it("renders an empty dark frame — no fabricated artwork — when the song is missing", () => {
    render(<QuizCard card={cards[1]} song={null} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByText(/Fragile/)).toBeNull();
  });

  it("enables the preview toggle only when the song carries a real preview URL", () => {
    const { rerender } = render(<QuizCard card={cards[0]} song={song()} />);
    const toggle = screen.getByRole("button", { name: /play preview/i });
    expect((toggle as HTMLButtonElement).disabled).toBe(false);

    rerender(<QuizCard card={cards[0]} song={song({ previewUrl: null })} />);
    const disabled = screen.getByRole("button", { name: /preview unavailable/i });
    expect((disabled as HTMLButtonElement).disabled).toBe(true);
  });
});
