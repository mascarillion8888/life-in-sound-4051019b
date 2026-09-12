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

  it("reads soul, grunge and hiphop rooms from genre keywords", () => {
    expect(cardArtworkScene({}, "Inner City Blues — Marvin Gaye soul", 1971)).toBe("soul");
    expect(cardArtworkScene({}, "Smells Like Teen Spirit — Nirvana grunge", 1991)).toBe("grunge");
    expect(cardArtworkScene({}, "Lose Yourself — Eminem rap", 2002)).toBe("hiphop");
  });

  it("falls back to the decade ladder — every era has its own visual identity", () => {
    expect(cardArtworkScene({}, "untitled demo", 1984)).toBe("synth");
    // Every era bucket maps to its own atmospheric time capsule (70s soul
    // vinyl, 90s grunge basement, contemporary hiphop studio); a song
    // without a year never fabricates a culture.
    expect(cardArtworkScene({}, "untitled demo", 1959)).toBe("jazz");
    expect(cardArtworkScene({}, "untitled demo", 1972)).toBe("soul");
    expect(cardArtworkScene({}, "untitled demo", 1994)).toBe("grunge");
    expect(cardArtworkScene({}, "untitled demo", 2003)).toBe("hiphop");
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
    expect(prompt).toContain("typographic album sleeve for Bob Marley");
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
    expect(prompt).toContain("typographic vinyl sleeve echoing Sting");
  });

  it("builds the 80s synth scene for synth/pop material", () => {
    const { prompt, scene } = buildCardArtworkPrompt("A-ha", "Take On Me", {
      genreText: "Take On Me A-ha synth pop",
    });
    expect(scene).toBe("synth");
    expect(prompt).toContain("Retro 80s neon-lit studio aesthetic");
    expect(prompt).toContain("cyan and magenta ambient lighting");
    expect(prompt).toContain("typographic cassette J-card for A-ha");
  });

  it("builds the jazz club scene for jazz/blues material", () => {
    const { prompt, scene } = buildCardArtworkPrompt("Miles Davis", "So What", {
      genreText: "So What Miles Davis jazz",
    });
    expect(scene).toBe("jazz");
    expect(prompt).toContain("Dimly lit vintage jazz club atmosphere");
    expect(prompt).toContain("warm brass accents");
    expect(prompt).toContain("typographic vinyl sleeve for Miles Davis");
  });

  it("falls back to the title alone when the artist is unknown", () => {
    const { prompt } = buildCardArtworkPrompt("", "Unknown Tune", { genreText: "gothic metal" });
    expect(prompt).toContain("typographic vinyl sleeve echoing Unknown Tune");
  });

  it("never asks for a painted portrait or card text inside the painting", () => {
    const { prompt } = buildCardArtworkPrompt("Sting", "Fragile", { genreText: "gothic metal" });
    expect(prompt).not.toContain("framed painted portrait");
    expect(prompt).not.toContain("portrait of Sting");
    expect(prompt).toContain("pure abstract typographic design");
    expect(prompt).toContain("no photographic face, portrait or human figure");
    expect(prompt).toContain("no painted artist portrait anywhere in the scene");
    expect(prompt).toContain("never draw card titles");
  });
});

describe("generateCardArtworkCore", () => {
  beforeEach(() => {
    __clearCardArtworkServerCache();
    delete process.env.GEMINI_API_KEY;
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.HF_IMAGE_MODEL;
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

  it("serves via HF Inference alone when only HUGGINGFACE_API_KEY is set", async () => {
    process.env.HUGGINGFACE_API_KEY = "hf-test-key";
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]).buffer as ArrayBuffer, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    const image = await generateCardArtworkCore(
      { trackKey: "itunes:hf-1", artist: "Eminem", title: "Lose Yourself" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(image).toMatch(/^data:image\/png;base64,/);
    // Exactly one provider call: Gemini tiers are skipped without their key.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).toContain("router.huggingface.co");
  });

  it("falls through to HF Inference when both Gemini tiers fail", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.HUGGINGFACE_API_KEY = "hf-test-key";
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("err", { status: 500 }))
      .mockResolvedValueOnce(new Response("err", { status: 500 }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([9, 9]).buffer as ArrayBuffer, {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
      );
    const image = await generateCardArtworkCore(
      { trackKey: "itunes:hf-2", artist: "Nirvana", title: "Lithium" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(image).toMatch(/^data:image\/png;base64,/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
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
    expect(body.instances[0].prompt).toContain("typographic vinyl sleeve echoing Sting");
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

  it("shares one cache entry between the artwork hook and the card route (no ::card suffix)", async () => {
    // Regression guard for the double-paint bug: useCardArtwork and useCardLore
    // (via generateCard.server.ts) must land on the SAME `trackKey::scene` key.
    // The card route passes a blueprint promptOverride and a different cardinal
    // context, but the cache identity is trackKey+scene only — so both calls
    // must share one generation. A "::card" suffix on the card route would make
    // the second call miss the cache and paint twice.
    process.env.GEMINI_API_KEY = "test-key";
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(imagenOk()));
    const artworkCall = { trackKey: "itunes:42", artist: "Sting", title: "Fragile" };
    const cardRouteCall = {
      trackKey: "itunes:42", // same key — the card route must NOT add "::card"
      artist: "Sting",
      title: "Fragile",
      promptOverride: "A multidimensional blueprint prompt with candlelight and a typographic sleeve.",
    };
    const first = await generateCardArtworkCore(artworkCall, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const second = await generateCardArtworkCore(cardRouteCall, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(first).toBe(second);
    // Exactly one provider call across both hooks — the second call hit the
    // shared process-level cache instead of regenerating.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("an 8-card journey spends exactly ONE generation per track (shared between hooks)", async () => {
    // End-to-end call-count contract for the audit finding: 8 cards, each
    // rendered by BOTH useCardArtwork (screen) and useCardLore (persist to
    // gallery). With the shared trackKey, each card's two server calls hit the
    // same cache entry → exactly 8 provider calls total (one per scene), not 16.
    process.env.GEMINI_API_KEY = "test-key";
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(imagenOk()));
    const cards = [
      { trackKey: "itunes:1", artist: "Sting", title: "Fragile" },
      { trackKey: "itunes:2", artist: "Nirvana", title: "Lithium" },
      { trackKey: "itunes:3", artist: "Adele", title: "Rolling in the Deep" },
      { trackKey: "itunes:4", artist: "Eminem", title: "Lose Yourself" },
      { trackKey: "itunes:5", artist: "Marvin Gaye", title: "Inner City Blues" },
      { trackKey: "itunes:6", artist: "A-ha", title: "Take On Me" },
      { trackKey: "itunes:7", artist: "Bob Marley", title: "Three Little Birds" },
      { trackKey: "itunes:8", artist: "Miles Davis", title: "So What" },
    ];
    for (const card of cards) {
      // useCardArtwork path (no promptOverride).
      await generateCardArtworkCore(card, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      // useCardLore → generateCard path (blueprint promptOverride, same key).
      await generateCardArtworkCore(
        { ...card, promptOverride: "card blueprint override prompt" },
        { fetchImpl: fetchImpl as unknown as typeof fetch },
      );
    }
    expect(fetchImpl).toHaveBeenCalledTimes(8);
  });

  it("does NOT share a cache entry when the track key differs (a manual ::card suffix would double-paint)", async () => {
    // Documents that the cache identity is trackKey+scene: if the card route
    // ever reintroduces a suffix, it generates a second painting. This is the
    // failure mode Bulgu 2 was reporting — kept as a canary.
    process.env.GEMINI_API_KEY = "test-key";
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(imagenOk()));
    await generateCardArtworkCore(
      { trackKey: "itunes:42", artist: "Sting", title: "Fragile" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    await generateCardArtworkCore(
      { trackKey: "itunes:42::card", artist: "Sting", title: "Fragile" },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
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
