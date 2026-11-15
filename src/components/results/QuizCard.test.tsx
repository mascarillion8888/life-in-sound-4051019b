// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildLifeCards } from "@/lib/soundmap/lifeCards";
import { __clearCardArtworkMemoryCache, cardArtworkKey } from "@/lib/art/useCardArtwork";
import { COLLECTION_STORAGE_KEY, isInCollection, loadCollection } from "@/lib/collection";
import { birthYearStore } from "@/lib/supabase/birth-year-store";
import type { Song } from "@/lib/song/types";

import { QuizCard } from "./QuizCard";

vi.mock("@/lib/card/cardTemplates", () => ({
  cardTemplateUrl: (file: string) =>
    file === "frame-gothic.png" ? "data:image/png;base64,AA==" : undefined,
  CARD_TEMPLATES: [],
}));

// The Supabase mirror is a network boundary — stub it so the card's own
// local-first behaviour is what is under test.
vi.mock("@/lib/supabase/use-collection-sync", () => ({
  syncCollectionToggle: vi.fn(),
}));

// Capture every lore context so a test can assert what the card passes for a
// chosen period (e.g. no age for "Now" without a birth year). Returning null
// keeps the deterministic card copy as the visible lore.
const lore = vi.hoisted(() => ({ contexts: [] as Array<Record<string, unknown>> }));
vi.mock("@/lib/art/useCardLore", () => ({
  useCardLore: (_song: unknown, context: Record<string, unknown>) => {
    lore.contexts.push(context);
    return null;
  },
}));

import { syncCollectionToggle } from "@/lib/supabase/use-collection-sync";

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
    vi.mocked(syncCollectionToggle).mockClear();
    lore.contexts.length = 0;
    act(() => birthYearStore.set(null));
  });

  it("renders meta line, cover, title, artist, lore, badge, era, mood and progress", () => {
    render(<QuizCard card={cards[0]} song={song({ releaseYear: 1987 })} />);
    const meta = screen.getByTestId("card-meta").textContent ?? "";
    // No birth year → no smart default, so the "met" part is omitted; the
    // release year and the era title remain.
    expect(meta).toContain("1987");
    expect(meta).toContain("FIRST SPARK");
    expect(meta).not.toContain("Ages");
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

  it("mirrors the heart toggle to the sync layer: push on save, remove on unsave", () => {
    const s = song();
    const key = cardArtworkKey(s);
    render(<QuizCard card={cards[0]} song={s} />);
    const heart = screen.getByTestId("card-heart");

    fireEvent.click(heart);
    expect(syncCollectionToggle).toHaveBeenLastCalledWith(
      key,
      expect.objectContaining({ trackKey: key }),
    );

    fireEvent.click(heart);
    expect(syncCollectionToggle).toHaveBeenLastCalledWith(key, null);
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
    expect((screen.getByTestId("card-art-template") as HTMLImageElement).src).toContain(
      "data:image/png",
    );
  });

  it("preselects the smart default period from the release year when a birth year is known", () => {
    // born 1981 + 1999 song → met at 18 → Youth (the chip looks normal).
    act(() => birthYearStore.set(1981));
    render(<QuizCard card={cards[0]} song={song({ releaseYear: 1999 })} />);
    const meta = screen.getByTestId("card-meta").textContent ?? "";
    expect(meta).toContain("Met in Youth");
    expect(meta).toContain("1999");
    expect(meta).not.toContain("Ages 5-9");
    expect(screen.getByTestId("card-stage").textContent).toBe("Youth");
  });

  it("shows no 'met' part in the meta line when there is no default and no choice", () => {
    render(<QuizCard card={cards[0]} song={song({ releaseYear: 1987 })} />);
    const meta = screen.getByTestId("card-meta").textContent ?? "";
    expect(meta).not.toContain("Ages");
    expect(meta).not.toContain("Met");
  });

  it("toggles the favorite heart: aria-pressed flips and persists to localStorage", () => {
    const s = song();
    const key = cardArtworkKey(s);
    render(<QuizCard card={cards[0]} song={s} />);
    const heart = screen.getByTestId("card-heart");
    expect(heart.getAttribute("aria-pressed")).toBe("false");
    expect(heart.getAttribute("aria-label")).toBe("Add to Collection");
    fireEvent.click(heart);
    expect(heart.getAttribute("aria-pressed")).toBe("true");
    expect(heart.getAttribute("aria-label")).toBe("In Collection ✓");
    expect(window.localStorage.getItem(COLLECTION_STORAGE_KEY)).toBeTruthy();
    expect(isInCollection(loadCollection(), key)).toBe(true);
    fireEvent.click(heart);
    expect(heart.getAttribute("aria-pressed")).toBe("false");
    expect(isInCollection(loadCollection(), key)).toBe(false);
  });

  it("restores the favorite state on a fresh render (persisted across refresh)", () => {
    const s = song();
    const first = render(<QuizCard card={cards[0]} song={s} />);
    fireEvent.click(screen.getByTestId("card-heart"));
    expect(screen.getByTestId("card-heart").getAttribute("aria-pressed")).toBe("true");
    first.unmount();
    render(<QuizCard card={cards[0]} song={s} />);
    expect(screen.getByTestId("card-heart").getAttribute("aria-pressed")).toBe("true");
  });

  it("does not trigger the surrounding card click when the heart is clicked", () => {
    const onCardClick = vi.fn();
    const s = song();
    render(
      <div onClick={onCardClick}>
        <QuizCard card={cards[0]} song={s} />
      </div>,
    );
    fireEvent.click(screen.getByTestId("card-heart"));
    expect(onCardClick).not.toHaveBeenCalled();
    expect(screen.getByTestId("card-heart").getAttribute("aria-pressed")).toBe("true");
  });

  it("renders the stage chip as a centered structure", () => {
    act(() => birthYearStore.set(1981));
    render(<QuizCard card={cards[0]} song={song({ releaseYear: 1999 })} />);
    const stage = screen.getByTestId("card-stage");
    expect(stage.textContent).toBe("Youth");
    const chip = screen.getByTestId("card-stage-button");
    expect(chip.tagName).toBe("BUTTON");
    expect(chip.textContent).toBe("Youth");
    expect(chip.getAttribute("aria-haspopup")).toBe("listbox");
  });

  it("shows the English meeting prompt when no default is possible", () => {
    // A recent song with no birth year: no default → the prompt, not an invented age.
    render(<QuizCard card={cards[7]} song={song({ releaseYear: 2023 })} />);
    expect(screen.getByTestId("card-stage-button").textContent).toBe("When did you meet it?");
  });

  it("still renders the favorite heart alongside the stage label", () => {
    act(() => birthYearStore.set(1981));
    render(<QuizCard card={cards[0]} song={song({ releaseYear: 1999 })} />);
    expect(screen.getByTestId("card-stage-button").textContent).toBe("Youth");
    expect(screen.getByTestId("card-heart")).toBeTruthy();
  });

  it("opens the period menu, selects a period, and updates the chip and meta line", () => {
    const onPeriodChange = vi.fn();
    render(<QuizCard card={cards[0]} song={song()} onPeriodChange={onPeriodChange} />);
    const chip = screen.getByTestId("card-stage-button");
    // No birth year → no default → the prompt.
    expect(chip.textContent).toBe("When did you meet it?");
    expect(screen.queryByTestId("period-listbox")).toBeNull();

    fireEvent.click(chip);
    expect(screen.getByTestId("period-listbox")).toBeTruthy();
    // All nine options are present when the birth year is unknown.
    expect(screen.getAllByRole("option")).toHaveLength(9);

    fireEvent.click(screen.getByTestId("period-option-teen"));
    // Menu closed, chip shows the choice, meta line shows the period label.
    expect(screen.queryByTestId("period-listbox")).toBeNull();
    expect(chip.textContent).toBe("Teen years");
    expect(screen.getByTestId("card-meta").textContent).toContain("Met in Teen years");
    expect(onPeriodChange).toHaveBeenCalledWith("teen");
  });

  it("closes the period menu on Escape and returns focus to the chip", () => {
    render(<QuizCard card={cards[0]} song={song()} />);
    const chip = screen.getByTestId("card-stage-button");
    fireEvent.click(chip);
    const listbox = screen.getByTestId("period-listbox");
    expect(listbox).toBeTruthy();

    fireEvent.keyDown(listbox, { key: "Escape" });
    expect(screen.queryByTestId("period-listbox")).toBeNull();
    expect(document.activeElement).toBe(chip);
  });

  it("closes the period menu on an outside click", () => {
    render(<QuizCard card={cards[0]} song={song()} />);
    fireEvent.click(screen.getByTestId("card-stage-button"));
    expect(screen.getByTestId("period-listbox")).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByTestId("period-listbox")).toBeNull();
  });

  it("supports keyboard navigation: ArrowDown opens, arrows move, Enter selects", () => {
    const onPeriodChange = vi.fn();
    render(<QuizCard card={cards[0]} song={song()} onPeriodChange={onPeriodChange} />);
    const chip = screen.getByTestId("card-stage-button");
    fireEvent.keyDown(chip, { key: "ArrowDown" });
    const listbox = screen.getByTestId("period-listbox");
    expect(listbox).toBeTruthy();

    // No choice yet → opens on the first option (Childhood, index 0); ArrowDown
    // moves to the next option in life order (Pre-teen).
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Enter" });
    expect(chip.textContent).toBe("Pre-teen");
    expect(onPeriodChange).toHaveBeenCalledWith("preTeen");
  });

  it("restores a persisted period from the song and shows it in the meta line", () => {
    render(<QuizCard card={cards[0]} song={song({ period: "now" })} />);
    expect(screen.getByTestId("card-stage-button").textContent).toBe("Now");
    expect(screen.getByTestId("card-meta").textContent).toContain("Met in Now · FIRST SPARK");
  });

  it("restores a persisted exact metAge and shows it in the meta line", () => {
    render(<QuizCard card={cards[0]} song={song({ metAge: 14, releaseYear: 1984 })} />);
    // The chip derives its period from the age (14 → Teen years).
    expect(screen.getByTestId("card-stage-button").textContent).toBe("Teen years");
    expect(screen.getByTestId("card-meta").textContent).toContain("Met at 14 · 1984");
  });

  it("omits the year part of the meta line when the release year is null", () => {
    render(<QuizCard card={cards[0]} song={song({ metAge: 14, releaseYear: null })} />);
    const meta = screen.getByTestId("card-meta").textContent ?? "";
    expect(meta).toContain("Met at 14");
    expect(meta).not.toMatch(/Met at 14 · \d/);
  });

  it("passes the chosen period's age to lore, but no age for 'Now' without a birth year", () => {
    // No birth year: "Now" has no resolvable age.
    render(<QuizCard card={cards[0]} song={song()} />);
    fireEvent.click(screen.getByTestId("card-stage-button"));
    fireEvent.click(screen.getByTestId("period-option-now"));
    const nowContext = lore.contexts.at(-1);
    expect(nowContext?.encounterAge).toBeNull();
  });

  it("passes the 'Now' current age to lore when the birth year is known", () => {
    act(() => birthYearStore.set(1981));
    render(<QuizCard card={cards[0]} song={song()} />);
    fireEvent.click(screen.getByTestId("card-stage-button"));
    fireEvent.click(screen.getByTestId("period-option-now"));
    const nowContext = lore.contexts.at(-1);
    expect(nowContext?.encounterAge).toBe(new Date().getFullYear() - 1981);
  });

  it("passes no age to lore when nothing is decided (never invented)", () => {
    render(<QuizCard card={cards[0]} song={song({ releaseYear: 1987 })} />);
    const context = lore.contexts.at(-1);
    expect(context?.encounterAge).toBeNull();
    expect(context?.discoveredLater).toBe(false);
  });

  it("shows only the periods a 26-year-old may be offered", () => {
    // born 2000 → current age 26: childhood..youngAdult + Now (six options).
    act(() => birthYearStore.set(2000));
    render(<QuizCard card={cards[0]} song={song({ releaseYear: null })} currentYear={2026} />);
    fireEvent.click(screen.getByTestId("card-stage-button"));
    const labels = screen.getAllByRole("option").map((o) => o.textContent);
    expect(labels).toEqual(["Childhood", "Pre-teen", "Teen years", "Youth", "Young adult", "Now"]);
    // Adulthood, Midlife and Later life are not offered to a 26-year-old.
    expect(screen.queryByTestId("period-option-adulthood")).toBeNull();
    expect(screen.queryByTestId("period-option-midlife")).toBeNull();
    expect(screen.queryByTestId("period-option-laterLife")).toBeNull();
  });

  it("keeps a persisted period that would no longer be offered (above the current age)", () => {
    // A 26-year-old whose saved choice is Midlife: still shown, still offered.
    act(() => birthYearStore.set(2000));
    render(
      <QuizCard
        card={cards[0]}
        song={song({ period: "midlife", releaseYear: null })}
        currentYear={2026}
      />,
    );
    expect(screen.getByTestId("card-stage-button").textContent).toBe("Midlife");
    fireEvent.click(screen.getByTestId("card-stage-button"));
    expect(screen.getByTestId("period-option-midlife")).toBeTruthy();
  });

  it("typing an exact age updates the chip, the meta line and the lore age", () => {
    const onMetAgeChange = vi.fn();
    render(
      <QuizCard
        card={cards[0]}
        song={song({ releaseYear: 1984 })}
        currentYear={2026}
        onMetAgeChange={onMetAgeChange}
      />,
    );
    fireEvent.click(screen.getByTestId("card-stage-button"));
    const input = screen.getByTestId("period-age-input");
    fireEvent.change(input, { target: { value: "14" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.queryByTestId("period-listbox")).toBeNull();
    expect(screen.getByTestId("card-stage-button").textContent).toBe("Teen years");
    expect(screen.getByTestId("card-meta").textContent).toContain("Met at 14 · 1984");
    expect(onMetAgeChange).toHaveBeenCalledWith(14);
    expect(lore.contexts.at(-1)?.encounterAge).toBe(14);
  });

  it("rejects an age above the listener's current age", () => {
    const onMetAgeChange = vi.fn();
    act(() => birthYearStore.set(2000)); // current age 26 in 2026
    render(
      <QuizCard
        card={cards[0]}
        song={song({ releaseYear: null })}
        currentYear={2026}
        onMetAgeChange={onMetAgeChange}
      />,
    );
    fireEvent.click(screen.getByTestId("card-stage-button"));
    const input = screen.getByTestId("period-age-input");
    fireEvent.change(input, { target: { value: "40" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onMetAgeChange).not.toHaveBeenCalledWith(40);
  });

  it("closes the menu on Escape from the age input", () => {
    render(<QuizCard card={cards[0]} song={song()} />);
    const chip = screen.getByTestId("card-stage-button");
    fireEvent.click(chip);
    const input = screen.getByTestId("period-age-input");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByTestId("period-listbox")).toBeNull();
    expect(document.activeElement).toBe(chip);
  });
});
