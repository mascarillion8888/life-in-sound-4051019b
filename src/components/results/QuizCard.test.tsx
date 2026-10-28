// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildLifeCards } from "@/lib/soundmap/lifeCards";
import { __clearCardArtworkMemoryCache, cardArtworkKey } from "@/lib/art/useCardArtwork";
import { isInCollection, loadCollection } from "@/lib/collection";
import type { Song } from "@/lib/song/types";

import { QuizCard } from "./QuizCard";

vi.mock("@/lib/card/cardTemplates", () => ({
  cardTemplateUrl: (file: string) =>
    file === "frame-gothic.png" ? "data:image/png;base64,AA==" : undefined,
  CARD_TEMPLATES: [],
}));

// Audio playback is stubbed: jsdom cannot play media.
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
const cardId = `quiz-card-${cards[0].songIndex}`;

describe("QuizCard (player-card layout)", () => {
  beforeEach(() => {
    __clearCardArtworkMemoryCache();
    window.localStorage.clear();
  });

  it("renders meta line, cover, title, artist, lore, badge, era, mood and progress", () => {
    render(<QuizCard card={cards[0]} song={song({ releaseYear: 1987 })} />);
    const meta = screen.getByTestId("card-meta").textContent ?? "";
    expect(meta).toContain("Ages 5-9");
    expect(meta).toContain("FIRST SPARK");
    expect(meta).toMatch(/\d+\/100/);
    expect((screen.getByTestId("card-art-cover") as HTMLImageElement).src).toContain("art.jpg");
    expect(screen.getByTestId("card-title").textContent).toBe("Fragile");
    expect(screen.getByTestId("card-artist").textContent).toBe("Sting");
    expect(screen.getByTestId("card-lore").textContent).toMatch(/Sting/);
    const badge = screen.getByTestId("card-badge").textContent ?? "";
    expect(badge).toMatch(/\d+\/10/);
    expect(badge).toContain("DISCOVERY");
    expect(screen.getByTestId("card-progress").getAttribute("aria-valuenow")).toBe("0");
  });

  it("applies the genre family and mood as theme attributes", () => {
    const metal = { ...song({ genre: "Metal" }), mood: "Dark" } as unknown as Song;
    render(<QuizCard card={cards[0]} song={metal} />);
    const root = screen.getByTestId(cardId);
    expect(root.getAttribute("data-family")).toBe("gothic");
    expect(root.getAttribute("data-mood")).toBe("Dark");
  });

  it("maps hip-hop songs to the hiphop family", () => {
    render(<QuizCard card={cards[0]} song={song({ genre: "Hip-Hop" })} />);
    expect(screen.getByTestId(cardId).getAttribute("data-family")).toBe("hiphop");
  });

  it("toggles the collection through the collect button", () => {
    const s = song();
    render(<QuizCard card={cards[0]} song={s} />);
    const btn = screen.getByTestId("card-collect");
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(isInCollection(loadCollection(), cardArtworkKey(s))).toBe(true);
  });

  it("enables play when a preview exists and disables it when not", () => {
    const { unmount } = render(<QuizCard card={cards[0]} song={song()} />);
    expect((screen.getByTestId("card-play") as HTMLButtonElement).disabled).toBe(false);
    unmount();
    render(<QuizCard card={cards[0]} song={song({ previewUrl: null })} />);
    expect((screen.getByTestId("card-play") as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders without a song: no fabricated cover, collect does nothing", () => {
    render(<QuizCard card={cards[1]} song={null} />);
    expect(screen.queryByTestId("card-art-cover")).toBeNull();
    expect(screen.getByTestId("card-title").textContent).toBe(cards[1].eraTitle);
    const btn = screen.getByTestId("card-collect");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  it("draws the optional frame template over the artwork", () => {
    render(<QuizCard card={cards[0]} song={song()} templateFile="frame-gothic.png" />);
    expect((screen.getByTestId("card-art-template") as HTMLImageElement).src).toContain("data:image/png");
  });
});