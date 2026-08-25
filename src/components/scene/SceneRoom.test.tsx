// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { sceneThemeFor } from "@/lib/art/sceneTheme";
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
  it("renders the fixed furniture in every theme: shelves, desk, lamp, boxes", () => {
    for (const themeId of Object.keys(SCENE_THEMES)) {
      const { container, unmount } = render(
        <SceneRoom themeId={themeId as keyof typeof SCENE_THEMES} />,
      );
      expect(screen.getByTestId(`scene-room-${themeId}`)).toBeTruthy();
      // Two shelf rows with book spines + desk surface + lamp shade + desk boxes.
      expect(container.querySelectorAll("[aria-hidden]").length).toBeGreaterThan(10);
      unmount();
    }
  });

  it("paints the room from the theme palette", () => {
    const { container } = render(<SceneRoom themeId="synth" />);
    const room = container.querySelector("[data-testid='scene-room-synth']") as HTMLElement;
    expect(room.style.background).toContain("rgb(20, 15, 34)"); // #140f22
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

  it("falls back to the era only for the 80s, gothic otherwise", () => {
    expect(sceneThemeFor(song({ title: "x", artist: "y", album: null, releaseYear: 1985 }))).toBe(
      "synth",
    );
    expect(sceneThemeFor(song({ title: "x", artist: "y", album: null, releaseYear: 2001 }))).toBe(
      "gothic",
    );
    expect(sceneThemeFor(null)).toBe("gothic");
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
