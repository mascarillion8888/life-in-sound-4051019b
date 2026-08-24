// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { eraStyleFor, type EraMountStyle } from "@/lib/soundmap/eraStyle";
import type { Song } from "@/lib/song/types";

import { OrganicArtwork } from "./OrganicArtwork";

function song(overrides: Partial<Song> = {}): Song {
  return {
    provider: "itunes",
    providerId: "42",
    title: "Fragile",
    artist: "Sting",
    album: "...Nothing Like the Sun",
    artworkUrl: "https://example.com/art.jpg",
    releaseYear: 1987,
    isrc: null,
    ...overrides,
  };
}

describe("OrganicArtwork", () => {
  it("embeds the real cover in every mount scene — never a fabricated image", () => {
    const mounts: [EraMountStyle, number][] = [
      ["vinyl-sleeve", 1975],
      ["cassette-desk", 1987],
      ["vintage-poster", 1994],
      ["framed-portrait", 2005],
    ];
    for (const [mount, year] of mounts) {
      const s = song({ releaseYear: year });
      const { unmount } = render(<OrganicArtwork song={s} style={eraStyleFor(s, 0)} />);
      const scene = screen.getByTestId("organic-artwork");
      expect(scene.dataset.mount).toBe(mount);
      const img = screen.getByRole("img") as HTMLImageElement;
      expect(img.src).toContain("art.jpg");
      expect(img.alt).toBe("Fragile — Sting");
      // Scene color grading is applied — the cover is lit by its environment.
      expect(img.style.filter).toContain("sepia");
      unmount();
    }
  });

  it("renders the scene backdrop from the era palette", () => {
    const s = song({ releaseYear: 1987 });
    const style = eraStyleFor(s, 0);
    const { container } = render(<OrganicArtwork song={s} style={style} />);
    const scene = container.querySelector("[data-mount]") as HTMLElement;
    // jsdom normalizes hex colors to rgb() — compare against that form.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(style.palette.backdrop[0].slice(i, i + 2), 16));
    expect(scene.style.background).toContain(`rgb(${r}, ${g}, ${b})`);
  });

  it("re-renders the cover as an illustration — never a clean photograph", () => {
    const s = song({ releaseYear: 1987 });
    const { container } = render(<OrganicArtwork song={s} style={eraStyleFor(s, 2)} />);
    const img = screen.getByRole("img") as HTMLImageElement;

    // Painterly edge warp precedes the era color grading.
    expect(img.style.filter).toContain("url(#soundmap-painterly-warp)");
    expect(img.style.filter).toContain("sepia");

    // The deterministic warp filter is registered in the scene's SVG defs.
    const defs = container.querySelector(`svg defs filter#soundmap-painterly-warp`);
    expect(defs).not.toBeNull();
    expect(defs?.querySelector("feDisplacementMap")).not.toBeNull();

    // Paper/canvas tooth + palette wash + brush-faded edges sit on the paint.
    const overlays = container.querySelectorAll("img ~ span");
    const styles = Array.from(overlays).map((el) => (el as HTMLElement).style);
    expect(styles.some((st) => st.backgroundImage.includes("data:image/svg"))).toBe(true);
    expect(styles.some((st) => st.mixBlendMode === "multiply")).toBe(true);
  });
});
