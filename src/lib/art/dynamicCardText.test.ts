import { describe, expect, it } from "vitest";

import { dynamicCardText } from "./dynamicCardText";

const base = {
  cardIndex: 0,
  eraTag: "Innocence",
  eraNarrative: "The years when the world was still vast and soft.",
  trackKey: "itunes:42",
  title: "Jammin'",
  artist: "Bob Marley",
  album: "Exodus",
};

describe("dynamicCardText — every string derived from the track", () => {
  it("builds an uppercase era title with a track-seeded companion", () => {
    const copy = dynamicCardText(base);
    expect(copy.title).toMatch(/^DISCOVERY & [A-Z]+$/);
  });

  it("weaves the era narrative with the track's own metadata", () => {
    const copy = dynamicCardText(base);
    expect(copy.body).toContain("the world was still vast and soft");
    expect(copy.body).toContain("Jammin' by Bob Marley, from Exodus");
  });

  it("computes the collector sequence and score from the track identity", () => {
    const copy = dynamicCardText(base);
    expect(copy.sequence).toMatch(/^[1-9][0-9]?\/100$|^100\/100$/);
    expect(copy.score).toBeGreaterThanOrEqual(2);
    expect(copy.score).toBeLessThanOrEqual(10);
    expect(copy.scoreLabel).toBe("INNOCENCE");
  });

  it("is deterministic — same track, same card", () => {
    expect(dynamicCardText(base)).toEqual(dynamicCardText(base));
  });

  it("differs across tracks — the body always carries the track's identity", () => {
    const a = dynamicCardText(base);
    const b = dynamicCardText({
      ...base,
      trackKey: "itunes:99",
      title: "Bad",
      artist: "Michael Jackson",
      album: "Bad",
    });
    // The body is unique per track even when titles happen to collide.
    expect(a.body).toContain("Bob Marley");
    expect(b.body).toContain("Michael Jackson");
    expect(b.body).not.toContain("Bob Marley");
  });

  it("handles coverless/manual tracks without an album", () => {
    const copy = dynamicCardText({ ...base, album: null });
    expect(copy.body).toContain("Jammin' by Bob Marley");
    expect(copy.body).not.toContain("from ");
  });
});
