import { describe, expect, it } from "vitest";

import { eraStyleFor, genreAccent } from "@/lib/soundmap/eraStyle";
import type { Song } from "@/lib/song/types";

function song(overrides: Partial<Song> = {}): Song {
  return {
    provider: "itunes",
    providerId: "1",
    title: "Fragile",
    artist: "Sting",
    album: null,
    artworkUrl: "https://example.com/art.jpg",
    releaseYear: null,
    isrc: null,
    ...overrides,
  };
}

describe("eraStyleFor", () => {
  it("maps the release decade to the contextual mount", () => {
    expect(eraStyleFor(song({ releaseYear: 1975 }), 0).mount).toBe("vinyl-sleeve");
    expect(eraStyleFor(song({ releaseYear: 1987 }), 0).mount).toBe("cassette-desk");
    expect(eraStyleFor(song({ releaseYear: 1994 }), 0).mount).toBe("vintage-poster");
    expect(eraStyleFor(song({ releaseYear: 2005 }), 0).mount).toBe("framed-portrait");
    expect(eraStyleFor(song({ releaseYear: 2023 }), 0).mount).toBe("framed-portrait");
  });

  it("labels the era chip from the decade, null when the year is unknown", () => {
    expect(eraStyleFor(song({ releaseYear: 1987 }), 0).eraLabel).toBe("'80s");
    expect(eraStyleFor(song({ releaseYear: 2005 }), 0).eraLabel).toBe("'00s");
    expect(eraStyleFor(song({ releaseYear: null }), 0).eraLabel).toBeNull();
    expect(eraStyleFor(null, 0).eraLabel).toBeNull();
  });

  it("falls back to the user's-age-appropriate mount by journey position", () => {
    expect(eraStyleFor(song(), 0).mount).toBe("vinyl-sleeve");
    expect(eraStyleFor(song(), 1).mount).toBe("vinyl-sleeve");
    expect(eraStyleFor(song(), 2).mount).toBe("cassette-desk");
    expect(eraStyleFor(song(), 3).mount).toBe("cassette-desk");
    expect(eraStyleFor(song(), 4).mount).toBe("vintage-poster");
    expect(eraStyleFor(song(), 5).mount).toBe("vintage-poster");
    expect(eraStyleFor(song(), 6).mount).toBe("framed-portrait");
    expect(eraStyleFor(song(), 7).mount).toBe("framed-portrait");
    expect(eraStyleFor(null, 2).mount).toBe("cassette-desk");
  });

  it("overrides the accent from genre keywords in title/artist/album", () => {
    const metal = eraStyleFor(
      song({ title: "Painkiller", artist: "Judas Priest", releaseYear: 1990 }),
      4,
    );
    expect(metal.palette.accent).toBe("#b3122e");
    // ...but the mount still comes from the decade, not the genre.
    expect(metal.mount).toBe("vintage-poster");

    const synth = eraStyleFor(
      song({ title: "Just Can't Get Enough", artist: "Depeche Mode", releaseYear: 1981 }),
      2,
    );
    expect(synth.palette.accent).toBe("#22d3ee");
    expect(synth.mount).toBe("cassette-desk");
  });

  it("keeps the decade accent when no genre signal exists", () => {
    const style = eraStyleFor(song({ releaseYear: 1987 }), 0);
    expect(style.palette.accent).toBe("#ff2fb3");
  });

  it("grades the artwork with an era-tuned sepia-based filter", () => {
    for (const year of [1975, 1987, 1994, 2005]) {
      expect(eraStyleFor(song({ releaseYear: year }), 0).grading).toContain("sepia");
    }
    expect(eraStyleFor(song(), 0).grading).toContain("sepia");
  });

  it("is deterministic — same inputs, same scene", () => {
    const a = eraStyleFor(song({ releaseYear: 1987 }), 3);
    const b = eraStyleFor(song({ releaseYear: 1987 }), 3);
    expect(a).toEqual(b);
  });
});

describe("genreAccent", () => {
  it("returns null when nothing matches", () => {
    expect(genreAccent("Fragile Sting")).toBeNull();
  });

  it("matches known genre keywords case-insensitively", () => {
    expect(genreAccent("THRASH METAL anthem")).toBe("#b3122e");
    expect(genreAccent("quiet folk song")).toBe("#7fa36b");
  });
});
