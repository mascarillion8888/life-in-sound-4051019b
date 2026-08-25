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

  it("STRICT: never renders a raw provider cover — skeleton while the painting forms", () => {
    render(<QuizCard card={cards[0]} song={song()} />);
    expect(screen.getByText(/Fragile — Sting/)).toBeTruthy();
    // No <img> based on the provider cover; the stylized gothic art-skeleton
    // breathes instead until the painting arrives.
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByTestId("card-art-skeleton").dataset.generating).toBe("true");
  });

  it("renders the AI painting with an accessible alt once ready", () => {
    window.localStorage.setItem(
      "soundmap.card-art.v1",
      JSON.stringify({ "itunes:42": "data:image/png;base64,AA==" }),
    );
    render(<QuizCard card={cards[0]} song={song()} />);
    const ai = screen.getByRole("img") as HTMLImageElement;
    expect(ai.src).toContain("data:image/png;base64,AA==");
    expect(ai.alt).toBe("Fragile — Sting");
    expect(ai.className).toContain("fade-in");
    expect(screen.queryByTestId("card-art-skeleton")).toBeNull();
  });

  it("keeps the stylized skeleton when AI generation fails (still no raw cover)", () => {
    // No cache, no key — generation resolves unavailable.
    render(<QuizCard card={cards[0]} song={song()} />);
    expect(screen.queryByRole("img")).toBeNull();
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
