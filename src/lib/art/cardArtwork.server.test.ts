import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __clearCardArtworkServerCache,
  buildCardArtworkPrompt,
  cardArtworkScene,
  generateCardArtworkCore,
} from "./cardArtwork.server";

function imagenOk(b64 = "aGVsbG8=") {
  return new Response(
    JSON.stringify({ predictions: [{ bytesBase64Encoded: b64, mimeType: "image/png" }] }),
    { status: 200 },
  );
}

function geminiImageOk(b64 = "d29ybGQ=") {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ inlineData: { data: b64, mimeType: "image/png" } }] } }],
    }),
    { status: 200 },
  );
}

describe("cardArtworkScene — user preference, then genre, then era", () => {
  it("honours an explicit user preference above every other signal", () => {
    expect(
      cardArtworkScene({ aesthetic: "I love reggae and dub" }, "Judas Priest metal", 1990),
    ).toBe("reggae");
    expect(cardArtworkScene({ aesthetic: "darkwave synth" }, "Miles Davis jazz", 1959)).toBe(
      "synth",
    );
  });

  it("reads the scene from genre keywords in the song metadata", () => {
    expect(cardArtworkScene({}, "Bob Marley redemption song reggae", 1980)).toBe("reggae");
    expect(cardArtworkScene({}, "Painkiller — Judas Priest", 1990)).toBe("gothic");
    expect(cardArtworkScene({}, "Sweet Dreams — Eurythmics synth pop", 1983)).toBe("synth");
    expect(cardArtworkScene({}, "Kind of Blue — Miles Davis jazz", 1959)).toBe("jazz");
    // Guard against keyword collisions — "dub" must not eat unrelated words.
    expect(cardArtworkScene({}, "Double Fantasy — John Lennon", 1980)).toBe("synth");
  });

  it("falls back to the era only where the era has its own visual identity", () => {
    expect(cardArtworkScene({}, "untitled demo", 1984)).toBe("synth");
    // A silent song from the 70s or 2000s must not invent a culture —
    // it defaults to the gothic fine-art base.
    expect(cardArtworkScene({}, "untitled demo", 1972)).toBe("gothic");
    expect(cardArtworkScene({}, "untitled demo", 2003)).toBe("gothic");
    expect(cardArtworkScene({}, "untitled demo", null)).toBe("gothic");
  });
});

describe("buildCardArtworkPrompt", () => {
  it("builds the reggae scene for reggae material", () => {
    const { prompt, scene } = buildCardArtworkPrompt("Bob Marley", "Three Little Birds", {
      genreText: "Three Little Birds Bob Marley reggae",
    });
    expect(scene).toBe("reggae");
    expect(prompt).toContain("Warm golden-hour sunlight");
    expect(prompt).toContain("vintage Jamaican wood aesthetic");
    expect(prompt).toContain("framed portrait of Bob Marley");
    expect(prompt).toContain("relaxed atmosphere");
  });

  it("builds the gothic scene for gothic/metal/folk material", () => {
    const { prompt, scene } = buildCardArtworkPrompt("Sting", "Fragile", {
      genreText: "Fragile Sting jazz",
      aesthetic: "gothic folk",
    });
    expect(scene).toBe("gothic");
    expect(prompt).toContain("Atmospheric dark gothic oil painting concept");
    expect(prompt).toContain("candlelit vintage room with detailed wood carvings");
    expect(prompt).toContain("framed painted portrait of Sting");
  });

  it("builds the 80s synth scene for synth/pop material", () => {
    const { prompt, scene } = buildCardArtworkPrompt("A-ha", "Take On Me", {
      genreText: "Take On Me A-ha synth pop",
    });
    expect(scene).toBe("synth");
    expect(prompt).toContain("Retro 80s neon-lit studio aesthetic");
    expect(prompt).toContain("cyan and magenta ambient lighting");
    expect(prompt).toContain("portrait of A-ha");
  });

  it("builds the jazz club scene for jazz/blues material", () => {
    const { prompt, scene } = buildCardArtworkPrompt("Miles Davis", "So What", {
      genreText: "So What Miles Davis jazz",
    });
    expect(scene).toBe("jazz");
    expect(prompt).toContain("Dimly lit vintage jazz club atmosphere");
    expect(prompt).toContain("warm brass accents");
    expect(prompt).toContain("portrait of Miles Davis");
  });

  it("falls back to the title alone when the artist is unknown", () => {
    const { prompt } = buildCardArtworkPrompt("", "Unknown Tune", { genreText: "gothic metal" });
    expect(prompt).toContain("portrait of Unknown Tune");
  });
});

describe("generateCardArtworkCore", () => {
  beforeEach(() => {
    __clearCardArtworkServerCache();
    delete process.env.GEMINI_API_KEY;
  });

  it("returns null without an API key — no call, no fabrication", async () => {
    const fetchImpl = vi.fn();
    const image = await generateCardArtworkCore(
      { trackKey: "itunes:42", artist: "Sting", title: "Fragile" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(image).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("generates via Imagen and returns a data URL", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(imagenOk()));
    const image = await generateCardArtworkCore(
      { trackKey: "itunes:42", artist: "Sting", title: "Fragile" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(image).toBe("data:image/png;base64,aGVsbG8=");
    const url = (fetchImpl.mock.calls[0] as unknown[])[0] as string;
    expect(url).toContain(":predict");
    const init = (fetchImpl.mock.calls[0] as unknown[])[1] as { body: string };
    const body = JSON.parse(init.body) as { instances: { prompt: string }[] };
    expect(body.instances[0].prompt).toContain("portrait of Sting");
  });

  it("scopes the memoization by scene — a new aesthetic regenerates the track", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(imagenOk()));
    const base = { trackKey: "itunes:42", artist: "Sting", title: "Fragile" };
    await generateCardArtworkCore(
      { ...base, aesthetic: "gothic folk" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    // Same track, different preferred aesthetic → different scene → a new
    // generation (the mock satisfies the Imagen primary path → 1 call each).
    await generateCardArtworkCore(
      { ...base, aesthetic: "reggae dub" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    // Same track + same aesthetic → memoized, no more calls.
    await generateCardArtworkCore(
      { ...base, aesthetic: "reggae dub" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("falls back to Gemini native image generation when Imagen fails", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("quota", { status: 429 }))
      .mockResolvedValueOnce(geminiImageOk());
    const image = await generateCardArtworkCore(
      { trackKey: "itunes:99", artist: "Adele", title: "Rolling in the Deep" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(image).toBe("data:image/png;base64,d29ybGQ=");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const url = (fetchImpl.mock.calls[1] as unknown[])[0] as string;
    expect(url).toContain("gemini-2.5-flash-image:generateContent");
  });

  it("memoizes by track key — a second render never re-calls the API", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(imagenOk()));
    const input = { trackKey: "itunes:42", artist: "Sting", title: "Fragile" };
    const first = await generateCardArtworkCore(input, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const second = await generateCardArtworkCore(input, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(first).toBe(second);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps total failure to null and does not cache the failure", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const input = { trackKey: "itunes:77", artist: "X", title: "Y" };
    expect(
      await generateCardArtworkCore(input, { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).toBeNull();
    // Failure is not memoized — a later retry reaches the network again.
    fetchImpl.mockResolvedValueOnce(imagenOk());
    expect(
      await generateCardArtworkCore(input, { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).toBe("data:image/png;base64,aGVsbG8=");
  });
});
