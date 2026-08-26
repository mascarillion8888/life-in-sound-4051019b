// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("never renders the raw provider cover — the gothic skeleton is the only fallback", () => {
    render(<QuizCard card={cards[0]} song={song()} />);
    expect(screen.getByText(/Fragile — Sting/)).toBeTruthy();
    // The raw album photo is NEVER card imagery, under any circumstances:
    // the woodcut skeleton (shimmering while generation runs) is all the
    // art window shows until the AI painting exists.
    expect(screen.queryByTestId("card-art-fallback")).toBeNull();
    expect(screen.queryByTestId("card-art-ai")).toBeNull();
    const skeleton = screen.getByTestId("card-art-skeleton");
    expect(skeleton.dataset.generating).toBe("true");
    // No <img> in the card points at the provider cover URL (ideally none
    // exists at all until the painting is ready).
    for (const img of screen.queryAllByRole("img", { hidden: true })) {
      expect((img as HTMLImageElement).src).not.toContain("art.jpg");
    }
  });

  it("cross-fades the AI painting over the skeleton when one is ready", () => {
    window.localStorage.setItem(
      "soundmap.card-art.v1",
      JSON.stringify({ "itunes:42": "data:image/png;base64,AA==" }),
    );
    render(<QuizCard card={cards[0]} song={song()} />);
    // Still no raw cover — the painting is the only image in the window.
    expect(screen.queryByTestId("card-art-fallback")).toBeNull();
    const ai = screen.getByTestId("card-art-ai") as HTMLImageElement;
    expect(ai.src).toContain("data:image/png;base64,AA==");
    expect(ai.className).toContain("fade-in");
  });

  it("keeps the static gothic skeleton when AI generation fails or no key exists", () => {
    // No cache, no key — generation resolves unavailable; the skeleton
    // stays, never the raw cover.
    render(<QuizCard card={cards[0]} song={song()} />);
    expect(screen.queryByTestId("card-art-fallback")).toBeNull();
    expect(screen.queryByTestId("card-art-ai")).toBeNull();
    expect(screen.getByTestId("card-art-skeleton")).toBeTruthy();
  });

  it("shows the same skeleton contract for coverless songs", () => {
    render(<QuizCard card={cards[0]} song={song({ artworkUrl: null })} />);
    expect(screen.queryByTestId("card-art-fallback")).toBeNull();
    expect(screen.getByTestId("card-art-skeleton").dataset.generating).toBe("true");
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

  it("carries the wooden gallery frame: serif typeface, carved border, lucide motifs", () => {
    render(<QuizCard card={cards[0]} song={song()} />);
    const article = screen.getByTestId("quiz-card-1");
    // Ornate wooden frame — responsive (no fixed pixel width), serif, carved border.
    expect(article.className).toContain("font-serif");
    expect(article.className).toContain("max-w-md");
    expect(article.style.borderColor).toBe("rgb(139, 115, 85)"); // #8b7355
    // Shield motif in the category banner (lucide, never an emoji glyph).
    expect(screen.getByText("Legendary Life Era").nextSibling?.nodeName).toBe("svg");
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
