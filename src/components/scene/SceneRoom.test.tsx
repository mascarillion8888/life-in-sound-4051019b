// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { eraThemeFor, sceneThemeFor } from "@/lib/art/sceneTheme";
import type { Song } from "@/lib/song/types";

import { SCENE_THEMES, SceneRoom } from "./SceneRoom";

function song(overrides: Partial<Song> = {}): Song {
  return {
    provider: "itunes",
    providerId: "42",
    title: "Jammin'",
    artist: "Bob Marley",
    album: "Exodus",
    artworkUrl: "https://example.com/art.jpg",
    releaseYear: 1977,
    isrc: null,
    ...overrides,
  };
}

describe("SceneRoom — the fixed global library environment", () => {
  it("shows the neutral dreamy mood backdrop by default when a song has no mood", () => {
    for (const themeId of Object.keys(SCENE_THEMES)) {
      const { container, unmount } = render(
        <SceneRoom themeId={themeId as keyof typeof SCENE_THEMES} />,
      );
      expect(screen.getByTestId(`scene-room-${themeId}`)).toBeTruthy();
      // Single sharp backdrop layer — covers the whole room, centered,
      // crop-safe, no letterbox bands, no duplicated blurred fill.
      const main = container.querySelector(
        `[data-testid='scene-backdrop-main-dreamy']`,
      ) as HTMLElement;
      expect(main).toBeTruthy();
      expect(main.style.backgroundImage).toContain("mood-backdrop-dreamy");
      expect(main.style.backgroundSize).toBe("cover");
      // No runtime DOM furniture vector elements are drawn.
      expect(container.querySelectorAll("[aria-hidden]").length).toBeLessThan(6);
      unmount();
    }
  });

  it("uses the song's mood backdrop when a mood is present (genre/decade do not pick the image alone)", () => {
    const { container } = render(<SceneRoom themeId="synth" mood="dark" />);
    const main = container.querySelector(`[data-testid='scene-backdrop-main-dark']`) as HTMLElement;
    expect(main).toBeTruthy();
    expect(main.style.backgroundImage).toContain("mood-backdrop-dark");
    expect(main.style.backgroundSize).toBe("cover");
  });

  it("paints the fallback wall gradient from the theme palette", () => {
    const { container } = render(<SceneRoom themeId="synth" />);
    const room = container.querySelector("[data-testid='scene-room-synth']") as HTMLElement;
    expect(room.style.background).toContain("rgb(20, 15, 34)"); // #140f22
  });

  it("keeps both darkening scrims fully opaque while the card is shown (default)", () => {
    const { container } = render(<SceneRoom themeId="synth" mood="dark" />);
    const scrim = screen.getByTestId("scene-backdrop-scrim");
    const fade = screen.getByTestId("scene-backdrop-fade-dark");
    // Card open: the scrims darken the room for readability — not faded out.
    expect(scrim).not.toHaveClass("opacity-0");
    expect(fade).not.toHaveClass("opacity-0");
    expect(scrim).toHaveClass("bg-black/40");
    expect(fade.style.background).toContain("rgba(0, 0, 0, 0.55)");
    // The smooth fade is wired for both, reduced-motion aware.
    expect(scrim).toHaveClass("transition-opacity");
    expect(fade).toHaveClass("transition-opacity");
    expect(scrim).toHaveClass("motion-reduce:transition-none");
    expect(container).toBeTruthy();
  });

  it("fades BOTH darkening scrims out (opacity 0) when cardHidden — the poster reads bright", () => {
    render(<SceneRoom themeId="synth" mood="dark" cardHidden />);
    const scrim = screen.getByTestId("scene-backdrop-scrim");
    const fade = screen.getByTestId("scene-backdrop-fade-dark");
    expect(scrim).toHaveClass("opacity-0");
    expect(fade).toHaveClass("opacity-0");
    // Still mounted (only faded) so the transition can animate both ways.
    expect(scrim).toBeTruthy();
    expect(fade).toBeTruthy();
  });

  it("leaves the ambient room-light layer untouched when cardHidden", () => {
    const { container } = render(<SceneRoom themeId="synth" mood="dark" cardHidden />);
    const room = screen.getByTestId("scene-room-synth");
    // The ambient light is the screen-blended layer; it must not carry opacity-0.
    const ambient = [...room.querySelectorAll("span[aria-hidden]")].find(
      (el) => (el as HTMLElement).style.mixBlendMode === "screen",
    ) as HTMLElement;
    expect(ambient).toBeTruthy();
    expect(ambient.className).not.toContain("opacity-0");
    expect(container).toBeTruthy();
  });
});

describe("sceneThemeFor — DOM-side mirror of the server scene vocabulary", () => {
  it("reads the scene from genre keywords", () => {
    expect(sceneThemeFor(song())).toBe("reggae");
    expect(
      sceneThemeFor(song({ title: "Painkiller", artist: "Judas Priest", releaseYear: 1990 })),
    ).toBe("gothic");
    expect(
      sceneThemeFor(
        song({ title: "Sweet Dreams", artist: "Eurythmics synth pop", releaseYear: 1983 }),
      ),
    ).toBe("synth");
    expect(
      sceneThemeFor(song({ title: "So What", artist: "Miles Davis jazz", releaseYear: 1959 })),
    ).toBe("jazz");
  });

  it("reads soul, grunge and hiphop rooms from genre keywords", () => {
    expect(
      sceneThemeFor(song({ title: "Lose Yourself", artist: "Eminem", releaseYear: 2002 })),
    ).toBe("hiphop");
    expect(
      sceneThemeFor(song({ title: "Come As You Are", artist: "Nirvana", releaseYear: 1991 })),
    ).toBe("grunge");
    expect(
      sceneThemeFor(song({ title: "Respect", artist: "Aretha Franklin", releaseYear: 1967 })),
    ).toBe("soul");
  });

  it("falls back to the neutral era default — a year no longer guesses a genre family", () => {
    expect(sceneThemeFor(song({ title: "x", artist: "y", album: null, releaseYear: 1985 }))).toBe(
      "gothic",
    );
    expect(sceneThemeFor(song({ title: "x", artist: "y", album: null, releaseYear: 2001 }))).toBe(
      "gothic",
    );
    expect(sceneThemeFor(null)).toBe("gothic");
  });

  it("eraThemeFor returns the neutral gothic default for every year (year → genre guess removed)", () => {
    expect(eraThemeFor(1959)).toBe("gothic");
    expect(eraThemeFor(1972)).toBe("gothic");
    expect(eraThemeFor(1984)).toBe("gothic");
    expect(eraThemeFor(1994)).toBe("gothic");
    expect(eraThemeFor(2003)).toBe("gothic");
    expect(eraThemeFor(null)).toBe("gothic");
  });

  it("does not let keyword collisions fabricate a culture", () => {
    // "dub" must not eat "Double Fantasy" — and with the neutral era default
    // a year alone no longer invents a synth atmosphere: no genre keyword hit
    // resolves to the gothic default.
    expect(
      sceneThemeFor(
        song({ title: "Double Fantasy", artist: "John Lennon", album: null, releaseYear: 1980 }),
      ),
    ).toBe("gothic");
  });

  it("routes acoustic/roots and classical/chamber keywords to the acoustic room", () => {
    expect(
      sceneThemeFor(
        song({ title: "Take Me Home Country Roads", artist: "John Denver", releaseYear: 1971 }),
      ),
    ).toBe("acoustic");
    expect(
      sceneThemeFor(
        song({ title: "Clair de Lune", artist: "Debussy classical piano", releaseYear: 1905 }),
      ),
    ).toBe("acoustic");
    expect(
      sceneThemeFor(song({ title: "Only Love Can Hurt Like This", artist: "Paloma Faith folk" })),
    ).toBe("acoustic");
  });

  it("keeps metal/punk/doom in the dark gothic room after the split", () => {
    expect(
      sceneThemeFor(song({ title: "Painkiller", artist: "Judas Priest", releaseYear: 1990 })),
    ).toBe("gothic");
    expect(
      sceneThemeFor(song({ title: "Anarchy in the UK", artist: "Sex Pistols", releaseYear: 1977 })),
    ).toBe("gothic");
  });
});
