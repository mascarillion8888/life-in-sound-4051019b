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

describe("SceneRoom - the fixed global library environment", () => {
  it("renders the pure black stage in every theme (no procedural room PNG)", () => {
    for (const themeId of Object.keys(SCENE_THEMES)) {
      const { container, unmount } = render(
        <SceneRoom themeId={themeId as keyof typeof SCENE_THEMES} />,
      );
      expect(screen.getByTestId(`scene-room-${themeId}`)).toBeTruthy();
      const wrap = container.querySelector(
        `[data-testid="scene-backdrop-${themeId}"]`,
      ) as HTMLElement;
      expect(wrap).toBeTruthy();
      expect(wrap.style.backgroundImage).toContain("radial-gradient");
      expect(wrap.style.background).toContain("radial-gradient");
      unmount();
    }
  });

  it("paints the neutral gold/amber chiaroscuro wash over pure black", () => {
    const { container } = render(<SceneRoom themeId="synth" />);
    const room = container.querySelector("[data-testid='scene-room-synth']") as HTMLElement;
    expect(room).toBeTruthy();
    expect(room.style.backgroundImage).toBe("none");
    const wash = container.querySelector(
      "[data-testid='scene-backdrop-synth']",
    ) as HTMLElement;
    expect(wash).toBeTruthy();
    expect(wash.style.background).toContain("34, 211, 238");
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

  it("falls back to the decade ladder — every era bucket has its own room", () => {
    expect(sceneThemeFor(song({ title: "x", artist: "y", album: null, releaseYear: 1985 }))).toBe(
      "synth",
    );
    expect(sceneThemeFor(song({ title: "x", artist: "y", album: null, releaseYear: 2001 }))).toBe(
      "hiphop",
    );
    expect(sceneThemeFor(null)).toBe("gothic");
  });

  it("eraThemeFor maps every decade to its atmospheric time capsule", () => {
    expect(eraThemeFor(1959)).toBe("jazz");
    expect(eraThemeFor(1972)).toBe("soul");
    expect(eraThemeFor(1984)).toBe("synth");
    expect(eraThemeFor(1994)).toBe("grunge");
    expect(eraThemeFor(2003)).toBe("hiphop");
    expect(eraThemeFor(null)).toBe("gothic");
  });

  it("does not let keyword collisions fabricate a culture", () => {
    // "dub" must not eat "Double Fantasy".
    expect(
      sceneThemeFor(
        song({ title: "Double Fantasy", artist: "John Lennon", album: null, releaseYear: 1980 }),
      ),
    ).toBe("synth");
  });
});
