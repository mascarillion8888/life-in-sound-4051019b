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

  it("locks the reference template: engraved header, banner, parchment lore, octagon badge, credit", () => {
    render(<QuizCard card={cards[0]} song={song()} />);
    // 1 · Engraved header: AGE | dynamic TITLE | ERA NAME + sequence.
    const header = screen.getByTestId("card-header");
    expect(header.textContent).toContain("Ages 5-9");
    expect(header.textContent).toMatch(/DISCOVERY & [A-Z]+/);
    expect(header.textContent).toContain("FIRST SPARK");
    expect(screen.getByTestId("card-sequence").textContent).toMatch(/^\d+\/100$/);
    // 3 · Middle banner: type line + era name + emblem.
    expect(screen.getByTestId("card-banner").textContent).toContain(
      "Legendary Life Era — FIRST SPARK",
    );
    // 4 · Parchment lore box: narrative + ornamental signature.
    const loreBox = screen.getByTestId("card-lore-box");
    expect(loreBox.textContent).toMatch(/vast and soft/);
    expect(loreBox.textContent).toMatch(/carried by Fragile by Sting/);
    // 5 · Octagonal score badge.
    const badge = screen.getByTestId("card-score-badge");
    expect(badge.textContent).toMatch(/\/10/);
    expect(badge.textContent).toMatch(/INNOCENCE/);
    expect(badge.style.clipPath).toContain("polygon");
    // 6 · Footer credit.
    expect(screen.getByTestId("card-credit").textContent).toBe(
      "TM & © 2026 LifeInSound | Illus. R. Swanland",
    );
  });

  it("embeds the iTunes cover inside the black window — no skeleton when a cover exists", () => {
    render(<QuizCard card={cards[0]} song={song()} />);
    const cover = screen.getByTestId("card-art-cover") as HTMLImageElement;
    expect(cover.src).toContain("art.jpg");
    expect(screen.queryByTestId("card-art-skeleton")).toBeNull();
    expect(screen.queryByTestId("card-art-ai")).toBeNull();
  });

  it("cross-fades the AI painting over the cover when one is ready", () => {
    window.localStorage.setItem(
      "soundmap.card-art.v1",
      JSON.stringify({ "itunes:42": "data:image/png;base64,AA==" }),
    );
    render(<QuizCard card={cards[0]} song={song()} />);
    // The cover stays underneath; the painting fades in on top.
    expect(screen.getByTestId("card-art-cover")).toBeTruthy();
    const ai = screen.getByTestId("card-art-ai") as HTMLImageElement;
    expect(ai.src).toContain("data:image/png;base64,AA==");
    expect(ai.className).toContain("fade-in");
  });

  it("keeps the cover when AI generation fails or no key exists", () => {
    // No cache, no key — generation resolves unavailable; the iTunes cover
    // remains the window's imagery.
    render(<QuizCard card={cards[0]} song={song()} />);
    expect(screen.getByTestId("card-art-cover")).toBeTruthy();
    expect(screen.queryByTestId("card-art-ai")).toBeNull();
  });

  it("falls back to the gothic woodcut skeleton only for coverless songs", () => {
    render(<QuizCard card={cards[0]} song={song({ artworkUrl: null })} />);
    expect(screen.queryByTestId("card-art-cover")).toBeNull();
    expect(screen.getByTestId("card-art-skeleton").dataset.generating).toBe("true");
  });

  it("signs the parchment footer with artist — title (year)", () => {
    render(<QuizCard card={cards[0]} song={song({ releaseYear: 1987 })} />);
    expect(screen.getByText(/Sting — Fragile \(1987\)/)).toBeTruthy();
  });

  it("adapts the artwork scene to the song's era via the mount attribute", () => {
    const { rerender } = render(<QuizCard card={cards[0]} song={song({ releaseYear: 1987 })} />);
    expect(screen.getByTestId("quiz-card-1").dataset.mount).toBe("cassette-desk");

    rerender(<QuizCard card={cards[0]} song={song({ releaseYear: 1974 })} />);
    expect(screen.getByTestId("quiz-card-1").dataset.mount).toBe("vinyl-sleeve");

    // No release year → mount falls back to the card's journey position.
    rerender(<QuizCard card={cards[0]} song={song()} />);
    expect(screen.getByTestId("quiz-card-1").dataset.mount).toBe("vinyl-sleeve");
  });

  it("renders an empty dark frame — no fabricated artwork — when the song is missing", () => {
    render(<QuizCard card={cards[1]} song={null} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByText(/Fragile/)).toBeNull();
    // Fallbacks stay deterministic: era tag in header, narrative in the box.
    expect(screen.getByTestId("card-header").textContent).toContain("FIRST IDENTITY");
    expect(screen.getByTestId("card-lore-box").textContent).toMatch(/threshold/);
  });

  it("carries the wooden gallery frame: serif typeface, carved border, lucide motifs", () => {
    render(<QuizCard card={cards[0]} song={song()} />);
    const article = screen.getByTestId("quiz-card-1");
    // Ornate wooden frame — responsive (no fixed pixel width), serif, carved border.
    expect(article.className).toContain("font-serif");
    expect(article.className).toContain("max-w-md");
    expect(article.style.borderColor).toBe("rgb(201, 169, 97)"); // #c9a961
    // Shield emblem in the middle banner (lucide, never an emoji glyph).
    const banner = screen.getByTestId("card-banner");
    expect(banner.querySelector("svg")).toBeTruthy();
  });

  it("wraps the whole card in a double gold frame with four corner brackets", () => {
    render(<QuizCard card={cards[0]} song={song()} />);
    const article = screen.getByTestId("quiz-card-1");
    // Outer 2px gold border on the article itself.
    expect(article.className).toContain("border-2");
    expect(article.style.borderColor).toBe("rgb(201, 169, 97)"); // #c9a961
    // Inset darker-gold hairline (#8a6d3b) hugging the outer border.
    const inset = screen.getByTestId("card-frame-inset");
    expect(inset.className).toContain("border-[#8a6d3b]");
    // Four 20×20 L-shaped brackets — one per corner, decorative only.
    for (const v of ["top", "bottom"]) {
      for (const h of ["left", "right"]) {
        const corner = screen.getByTestId(`card-frame-corner-${v}-${h}`);
        expect(corner.className).toContain("h-5");
        expect(corner.className).toContain("w-5");
        expect(corner.className).toContain("border-[#c9a961]");
        // The two edges facing inward stay invisible — only the outer L shows.
        expect(corner.style.borderTopWidth).toBe(v === "top" ? "2px" : "0px");
        expect(corner.style.borderBottomWidth).toBe(v === "bottom" ? "2px" : "0px");
        expect(corner.style.borderLeftWidth).toBe(h === "left" ? "2px" : "0px");
        expect(corner.style.borderRightWidth).toBe(h === "right" ? "2px" : "0px");
      }
    }
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
