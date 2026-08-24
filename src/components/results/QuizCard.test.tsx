// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildLifeCards } from "@/lib/soundmap/lifeCards";
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
  it("renders the MTG frame: era title, age badge, type line, stats, narrative", () => {
    render(<QuizCard card={cards[0]} song={song()} />);
    expect(screen.getByText("FIRST SPARK")).toBeTruthy();
    expect(screen.getByText("Ages 5-9")).toBeTruthy();
    expect(screen.getByText("Legendary Life Era")).toBeTruthy();
    expect(screen.getByText("Innocence")).toBeTruthy();
    expect(screen.getByText(/Intensity 35/)).toBeTruthy();
    expect(screen.getByText(/vast and soft/)).toBeTruthy();
  });

  it("shows the song credit line and harmonized artwork when a song exists", () => {
    render(<QuizCard card={cards[0]} song={song()} />);
    expect(screen.getByText(/Fragile — Sting/)).toBeTruthy();
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.src).toContain("art.jpg");
    // Harmonized, never raw-pasted: the sepia/contrast filter is applied.
    expect(img.style.filter).toContain("sepia");
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
