// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
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

  it("locks the simplified template: centered header, square art window, dark lore box, footer with score chip", () => {
    render(<QuizCard card={cards[0]} song={song()} />);
    // 1 · Centered gold header: AGE | dynamic TITLE | ERA NAME.
    const header = screen.getByTestId("card-header");
    expect(header.textContent).toContain("Ages 5-9");
    expect(header.textContent).toMatch(/DISCOVERY & [A-Z]+/);
    expect(header.textContent).toContain("FIRST SPARK");
    expect(header.className).toContain("text-center");
    // Removed layers stay gone.
    expect(screen.queryByTestId("card-banner")).toBeNull();
    expect(screen.queryByTestId("card-sequence")).toBeNull();
    expect(screen.queryByTestId("card-credit")).toBeNull();
    // 3 · Dark inset lore box.
    const loreBox = screen.getByTestId("card-lore-box");
    expect(loreBox.textContent).toMatch(/vast and soft/);
    expect(loreBox.textContent).toMatch(/carried by Fragile by Sting/);
    expect(loreBox.className).toContain("bg-[#161920]");
    // 4 · Flat score chip in the footer (no octagon clip-path).
    const badge = screen.getByTestId("card-score-badge");
    expect(badge.textContent).toMatch(/\/10/);
    expect(badge.className).toContain("bg-[#c8aa6e]/20");
    expect(badge.style.clipPath).toBe("");
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
      "soundmap.card-art.v2",
      JSON.stringify({ "v2|itunes:42|gothic": "data:image/png;base64,AA==" }),
    );
    render(<QuizCard card={cards[0]} song={song()} />);
    // The AI painting is now the primary layer — the cover is not rendered
    expect(screen.queryByTestId("card-art-cover")).toBeNull();
    const ai = screen.getByTestId("card-art-ai") as HTMLImageElement;
    expect(ai.src).toContain("data:image/png;base64,AA==");
    expect(ai.className).toContain("fade-in");
  });

  it("hides the album cover when AI generation fails — placeholder takes over", async () => {
    // No cache, no key — generation resolves unavailable. The provider's
    // album photo (e.g. a Michael Jackson cover) must NOT remain the card's
    // imagery: the card face keeps the gothic placeholder instead.
    render(<QuizCard card={cards[0]} song={song()} />);
    // Gen fails fast server-side, but the hook only flips to "unavailable"
    // after that resolves — wait for the cover to leave.
    await waitFor(() => expect(screen.queryByTestId("card-art-cover")).toBeNull());
    expect(screen.queryByTestId("card-art-ai")).toBeNull();
    const skeleton = screen.getByTestId("card-art-skeleton");
    // Static (non-pulsing) placeholder — nothing is generating anymore.
    expect(skeleton.dataset.generating).toBe("false");
  });

  it("falls back to the gothic woodcut skeleton only for coverless songs", () => {
    render(<QuizCard card={cards[0]} song={song({ artworkUrl: null })} />);
    expect(screen.queryByTestId("card-art-cover")).toBeNull();
    const skeleton = screen.getByTestId("card-art-skeleton");
    expect(skeleton.dataset.generating).toBe("true");
    // Spinner + i18n generation caption appear while the painting generates.
    expect(skeleton.querySelector("svg.animate-spin")).toBeTruthy();
    expect(skeleton.textContent).toContain("Etched ink art generating…");
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

  it("carries the simplified frame: responsive 340px, serif typeface, carved border", () => {
    render(<QuizCard card={cards[0]} song={song()} />);
    const article = screen.getByTestId("quiz-card-1");
    // Simplified frame — responsive (no fixed pixel width), serif, carved border.
    expect(article.className).toContain("font-serif");
    expect(article.className).toContain("max-w-[340px]");
    expect(article.style.borderColor).toBe("rgb(201, 169, 97)"); // #c9a961
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
