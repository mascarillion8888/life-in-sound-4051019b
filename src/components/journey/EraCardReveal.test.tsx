// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildLifeCards, type LifeCard } from "@/lib/soundmap/lifeCards";
import type { Song } from "@/lib/song/types";

import { EraCardReveal } from "./EraCardReveal";

// Audio playback is stubbed — jsdom cannot play media; rAF runs
// synchronously so the fade-out completes without a timer.
const playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
  // The fake clock jumps past the fade window so ramps finish in one tick.
  cb(performance.now() + 1000);
  return 0;
});

function song(overrides: Partial<Song> = {}): Song {
  return {
    provider: "itunes",
    providerId: "42",
    title: "Painkiller",
    artist: "Judas Priest",
    album: "Painkiller",
    artworkUrl: "https://example.com/cover.jpg",
    releaseYear: 1990,
    previewUrl: "https://example.com/preview.m4a",
    isrc: null,
    verified: true,
    ...overrides,
  };
}

const cards: LifeCard[] = buildLifeCards({ locale: "en" });

describe("EraCardReveal", () => {
  it("shows the era position, the card, and the English narrative on its face", () => {
    render(<EraCardReveal card={cards[2]} song={song()} isLast={false} onContinue={() => {}} />);
    expect(screen.getByText("Era 3 of 8")).toBeInTheDocument();
    // Era title appears in the reveal heading and on the card's title bar.
    expect(screen.getAllByText("REBELLION").length).toBeGreaterThanOrEqual(2);
    // The dynamic English narrative lives on the card face.
    expect(screen.getByText(/volume ran higher than feeling/)).toBeInTheDocument();
    expect(screen.getByText(/Painkiller — Judas Priest/)).toBeInTheDocument();
  });

  it("labels the advance action 'Next Era / Continue' until the last card", () => {
    render(<EraCardReveal card={cards[0]} song={song()} isLast={false} onContinue={() => {}} />);
    expect(screen.getByRole("button", { name: /next era \/ continue/i })).toBeInTheDocument();
  });

  it("labels the final advance 'See Your Master Poster'", () => {
    render(<EraCardReveal card={cards[7]} song={song()} isLast onContinue={() => {}} />);
    expect(screen.getByRole("button", { name: /see your master poster/i })).toBeInTheDocument();
  });

  it("starts the real preview on reveal and stops it when continuing", () => {
    playSpy.mockClear();
    pauseSpy.mockClear();
    const onContinue = vi.fn();
    const { unmount } = render(
      <EraCardReveal card={cards[0]} song={song()} isLast={false} onContinue={onContinue} />,
    );
    // Autoplay fired for the provider's real preview URL.
    expect(playSpy).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /next era/i }));
    expect(onContinue).toHaveBeenCalled();
    // The journey advances by unmounting the reveal — the audio singleton
    // fades out and pauses.
    unmount();
    expect(pauseSpy).toHaveBeenCalled();
  });

  it("renders the empty dark frame — never fabricated art — when the song is missing", () => {
    render(<EraCardReveal card={cards[4]} song={null} isLast={false} onContinue={() => {}} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText(/the tempering/i)).toBeInTheDocument();
  });
});
