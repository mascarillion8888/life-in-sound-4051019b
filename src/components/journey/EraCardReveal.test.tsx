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
  it("shows the card and the English narrative on its face", () => {
    render(<EraCardReveal card={cards[2]} song={song()} isLast={false} onContinue={() => {}} />);
    // The reveal no longer renders its own header text (position line and
    // era-title h2 were both removed 2026-09-29) — the card face carries the
    // per-track title and the card-face tag (REBELLION & <CAPTION>).
    expect(screen.getByTestId("card-title").textContent).toBe("Painkiller");
    // The dynamic English narrative lives on the card face.
        expect(screen.getByTestId("card-lore")).toHaveTextContent(/Painkiller/);
    expect(screen.getByTestId("card-artist").textContent).toBe("Judas Priest");
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

  it("shows loading skeleton when artStatus is loading", () => {
    render(
      <EraCardReveal
        card={cards[4]}
        song={{
          ...song(),
          artworkUrl: null,
          provider: "manual",
          providerId: "manual-1",
          artist: "",
        }}
        artStatus="loading"
        isLast={false}
        onContinue={() => {}}
      />,
    );
    const skeleton = screen.getByTestId("card-art-skeleton");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton.dataset.generating).toBe("true");
    // Breathing animation should be active
    expect(skeleton.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows notfound skeleton (no breathing animation) when artStatus is notfound", () => {
    render(
      <EraCardReveal
        card={cards[4]}
        song={{
          ...song(),
          artworkUrl: null,
          provider: "manual",
          providerId: "manual-1",
          artist: "",
        }}
        artStatus="notfound"
        isLast={false}
        onContinue={() => {}}
      />,
    );
    const skeleton = screen.getByTestId("card-art-skeleton");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton.dataset.notfound).toBe("true");
    // Breathing animation should NOT be active for notfound
    expect(skeleton.querySelector(".animate-pulse")).not.toBeInTheDocument();
  });

  it("renders album cover <img> when artwork arrives (artStatus ok)", () => {
    render(
      <EraCardReveal
        card={cards[4]}
        song={song({ artworkUrl: "https://example.com/late-cover.jpg" })}
        artStatus="ok"
        isLast={false}
        onContinue={() => {}}
      />,
    );
    const cover = screen.getByTestId("card-art-cover") as HTMLImageElement;
    expect(cover).toBeInTheDocument();
    expect(cover.src).toContain("late-cover.jpg");
    // Skeleton should not be present
    expect(screen.queryByTestId("card-art-skeleton")).toBeNull();
  });
});
