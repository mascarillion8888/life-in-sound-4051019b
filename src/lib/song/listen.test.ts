import { describe, expect, it } from "vitest";

import { spotifySearchUrl } from "./listen";

describe("spotifySearchUrl", () => {
  it("builds a Spotify search deep link from artist + title", () => {
    expect(spotifySearchUrl("Fragile", "Sting")).toBe(
      "https://open.spotify.com/search/Sting%20Fragile",
    );
  });

  it("uses the title alone when no artist is known", () => {
    expect(spotifySearchUrl("Painkiller", "")).toBe("https://open.spotify.com/search/Painkiller");
    expect(spotifySearchUrl("Painkiller", null)).toBe("https://open.spotify.com/search/Painkiller");
  });

  it("encodes special characters and never invents a stream URL", () => {
    const url = spotifySearchUrl("Aşk & Acı", "Sezen Aksu");
    expect(url.startsWith("https://open.spotify.com/search/")).toBe(true);
    expect(url).toContain(encodeURIComponent("Sezen Aksu Aşk & Acı"));
  });
});
