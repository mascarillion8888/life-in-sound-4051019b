import { describe, expect, it } from "vitest";

import { analyzeUserJourney } from "@/lib/ai/pipeline";
import { deterministicPoeticAnalysis } from "@/lib/llm/poetic-analyzer";

import {
  resolveAtmosphere,
  resolveBackgroundScene,
  resolvePosterTheme,
  themeFromAnalysis,
} from "./posterTheme";

describe("resolveAtmosphere", () => {
  it("maps Metal/Doom to the gothic castle & thunder atmosphere", () => {
    expect(resolveAtmosphere(["Heavy Metal", "Doom"])).toBe("gothic-thunder");
    expect(resolveAtmosphere(["Judas Priest - Painkiller", "thrash metal"])).toBe("gothic-thunder");
  });

  it("maps Jazz/Classical to smoke & candlelight", () => {
    expect(resolveAtmosphere(["Miles Davis", "modal jazz"])).toBe("smoke-candlelight");
    expect(resolveAtmosphere(["classical piano nocturne"])).toBe("smoke-candlelight");
  });

  it("maps 80s Pop/Synth to retro grid & neon glow", () => {
    expect(resolveAtmosphere(["synthwave", "new wave"])).toBe("retro-grid-neon");
    expect(resolveAtmosphere(["80s pop hits"])).toBe("retro-grid-neon");
  });

  it("maps Rock/Folk to distressed parchment & woodcut", () => {
    expect(resolveAtmosphere(["folk rock", "americana"])).toBe("distressed-parchment");
    expect(resolveAtmosphere(["indie acoustic"])).toBe("distressed-parchment");
  });

  it("falls back to the neon decade on era signal alone (≥50% of years in 1978–1992)", () => {
    expect(resolveAtmosphere([], [1980, 1985, 1991, null])).toBe("retro-grid-neon");
    expect(resolveAtmosphere([], [1970, 1972, 1975])).toBe("gothic-thunder");
    expect(resolveAtmosphere([], [])).toBe("gothic-thunder");
  });

  it("genre keywords outrank the era fallback", () => {
    expect(resolveAtmosphere(["smooth jazz"], [1984, 1986])).toBe("smoke-candlelight");
  });

  it("does not let substrings eat unrelated words", () => {
    // "Metallica" contains "metal" but is not a genre tag — without a real
    // keyword the theme stays the gold default instead of going bronze.
    expect(resolvePosterTheme({ genres: ["Metallica - Fade to Black"] }).metal).toBe("gold");
    expect(resolvePosterTheme({ genres: ["Metallica - Fade to Black", "heavy metal"] }).metal).toBe(
      "bronze",
    );
  });

  it("consumes analyzer theme ids as a genre family signal", () => {
    expect(resolvePosterTheme({ genres: ["metal-gothic"] }).metal).toBe("bronze");
    expect(resolvePosterTheme({ genres: ["synthwave-80s"] }).atmosphere).toBe("retro-grid-neon");
    expect(resolvePosterTheme({ genres: ["jazz-classical"] }).metal).toBe("amber-brass");
    expect(resolvePosterTheme({ genres: ["indie-acoustic"] }).atmosphere).toBe(
      "distressed-parchment",
    );
  });
});

describe("resolveBackgroundScene", () => {
  it("high emotional intensity → stormy/turbulent", () => {
    expect(resolveBackgroundScene(0.8)).toBe("stormy");
    expect(resolveBackgroundScene(0.5)).toBe("stormy");
  });

  it("low intensity / peaceful arc → calm/starry", () => {
    expect(resolveBackgroundScene(0.2)).toBe("starry");
    expect(resolveBackgroundScene(undefined, ["peaceful", "content"])).toBe("starry");
  });

  it("mood words outrank the numeric arc in both directions", () => {
    expect(resolveBackgroundScene(0.9, ["happy", "serene"])).toBe("starry");
    expect(resolveBackgroundScene(0.1, ["fiery", "rage"])).toBe("stormy");
  });

  it("no signal at all defaults to starry (calm)", () => {
    expect(resolveBackgroundScene()).toBe("starry");
  });
});

describe("resolvePosterTheme", () => {
  it("Metal/Doom → bronze frame over the gothic background", () => {
    const theme = resolvePosterTheme({ genres: ["doom metal"], emotionalIntensity: 0.9 });
    expect(theme.metal).toBe("bronze");
    expect(theme.metalColor).toBe("#a97142");
    expect(theme.atmosphere).toBe("gothic-thunder");
    expect(theme.primaryBg).toBe("#0b0b10");
    expect(theme.backgroundScene).toBe("stormy");
  });

  it("Jazz → amber brass + smoke & candlelight", () => {
    const theme = resolvePosterTheme({ genres: ["jazz"], mood: ["peaceful"] });
    expect(theme.metal).toBe("amber-brass");
    expect(theme.atmosphere).toBe("smoke-candlelight");
    expect(theme.backgroundScene).toBe("starry");
  });

  it("80s synth → neon magenta frame with cyan highlight", () => {
    const theme = resolvePosterTheme({ genres: ["synthpop"] });
    expect(theme.metal).toBe("neon-magenta");
    expect(theme.metalColor).toBe("#ff2fb3");
    expect(theme.metalHighlight).toBe("#7df9ff");
    expect(theme.atmosphere).toBe("retro-grid-neon");
  });

  it("Rock/Folk → copper + distressed parchment", () => {
    const theme = resolvePosterTheme({ genres: ["folk"] });
    expect(theme.metal).toBe("copper");
    expect(theme.atmosphere).toBe("distressed-parchment");
  });

  it("empty input → gold gothic default, starry sky", () => {
    const theme = resolvePosterTheme();
    expect(theme.metal).toBe("gold");
    expect(theme.atmosphere).toBe("gothic-thunder");
    expect(theme.backgroundScene).toBe("starry");
  });

  it("is deterministic — same input, same theme object", () => {
    const input = { genres: ["blues"], releaseYears: [1962], emotionalIntensity: 0.4 };
    expect(resolvePosterTheme(input)).toEqual(resolvePosterTheme(input));
  });
});

describe("themeFromAnalysis", () => {
  // Real pipeline fixture: answers → profile → deterministic analysis.
  const METAL = [
    "Judas Priest - Painkiller",
    "Metallica - Fade to Black",
    "Black Sabbath - Iron Man",
    "Iron Maiden - The Trooper",
    "Dio - Rainbow in the Dark",
    "Slayer - Raining Blood",
    "Queensrÿche - Silent Lucidity",
    "Motörhead - Ace of Spades",
  ];

  function fixture(titles: string[]) {
    const answers: Record<number, string> = {};
    titles.forEach((t, i) => {
      answers[i + 1] = t;
    });
    const profile = analyzeUserJourney(answers);
    if (!profile) throw new Error("fixture profile must exist");
    const analysis = deterministicPoeticAnalysis(profile, titles);
    const songs = titles.map((title, i) => ({
      provider: "manual" as const,
      providerId: `t-${i}`,
      title,
      artist: title.split(" - ")[0] ?? "",
      album: null,
      artworkUrl: null,
      isrc: null,
      releaseYear: null,
    }));
    return { analysis, songs };
  }

  it("resolves the exact theme every consumer shares (Bronze for a Metal journey)", () => {
    const { analysis, songs } = fixture(METAL);
    const theme = themeFromAnalysis(analysis, songs);
    expect(theme.metal).toBe("bronze");
    expect(theme.atmosphere).toBe("gothic-thunder");
    expect(theme.metalColor).toBe("#a97142");
    expect(theme.metalHighlight).toBe("#d09a68");
  });

  it("era-fallbacks to Neon Magenta when genre text is keyword-free but years live in the 80s", () => {
    const { analysis, songs } = fixture(METAL);
    // Strip every genre-carrying field so the era signal alone decides.
    analysis.visual.themeId = "ambient-default";
    analysis.chapters = analysis.chapters.map((c) => ({ ...c, title: "PHASE" }));
    const neon = themeFromAnalysis(
      analysis,
      songs.map((s, i) => ({
        ...s,
        title: "Instrumental Reflection",
        artist: "",
        releaseYear: 1980 + i,
      })),
    );
    expect(neon.atmosphere).toBe("retro-grid-neon");
    expect(neon.metal).toBe("neon-magenta");
    expect(neon.metalColor).toBe("#ff2fb3");
  });

  it("null analysis falls back to the Gold default, null-safe", () => {
    const theme = themeFromAnalysis(null, []);
    expect(theme.metal).toBe("gold");
    expect(theme.atmosphere).toBe("gothic-thunder");
    expect(theme.backgroundScene).toBe("starry");
  });
});
