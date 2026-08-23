import { describe, expect, it } from "vitest";
import {
  resolveDynamicTheme,
  withDynamicExtras,
  EXTRAS_BY_THEME,
} from "@/lib/soundmap/dynamicThemes";

describe("resolveDynamicTheme", () => {
  it("genres dominate — jazz + classical resolve to vintage jazz", () => {
    const theme = resolveDynamicTheme({ genres: ["jazz", "classical"] });
    expect(theme.themeId).toBe("jazz-classical");
    expect(theme.vibe).toBe("vintage-jazz");
  });

  it("metal resolves to the gothic-dark vibe", () => {
    const theme = resolveDynamicTheme({ genres: ["heavy metal", "doom"] });
    expect(theme.themeId).toBe("metal-gothic");
    expect(theme.vibe).toBe("gothic-dark");
  });

  it("emotional tone can tip a tie toward its affinity", () => {
    const theme = resolveDynamicTheme({
      genres: [],
      songs: [],
      emotionalTone: ["victorious", "hope"],
    });
    expect(theme.themeId).toBe("pop-bright");
    expect(theme.vibe).toBe("vibrant-pop");
  });

  it("melancholic tone leans raw-melancholy (indie-acoustic)", () => {
    const theme = resolveDynamicTheme({
      genres: [],
      songs: [],
      emotionalTone: ["melancholic rain", "longing"],
    });
    expect(theme.themeId).toBe("indie-acoustic");
    expect(theme.vibe).toBe("raw-melancholy");
  });

  it("life-phase labels nudge the era affinity (deep resonance → jazz/ambient)", () => {
    const theme = resolveDynamicTheme({
      genres: [],
      songs: [],
      emotionalTone: [],
      lifePhases: ["DEEP RESONANCE (Ages 35+)"],
    });
    expect(["jazz-classical", "ambient-default"]).toContain(theme.themeId);
  });

  it("no signal at all falls back to ambient-default", () => {
    const theme = resolveDynamicTheme({ genres: [], songs: [], emotionalTone: [], lifePhases: [] });
    expect(theme.themeId).toBe("ambient-default");
  });

  it("extras define frame, waveform gradient, texture and glow for every theme", () => {
    for (const [themeId, extras] of Object.entries(EXTRAS_BY_THEME)) {
      expect(extras.frame).toBeTruthy();
      expect(extras.waveGradient[0]).toBeTruthy();
      expect(extras.waveGradient[1]).toBeTruthy();
      expect(extras.texture).toBeTruthy();
      expect(extras.auraGlow).toMatch(/^#/);
      expect(themeId).toBeTruthy();
    }
  });

  it("withDynamicExtras merges the engine extras onto a base spec", () => {
    const theme = resolveDynamicTheme({ genres: ["jazz"] });
    const merged = withDynamicExtras(
      {
        themeId: theme.themeId,
        palette: { primary: "#111", accent: "#222", background: "#333", text: "#eee" },
        typography: "elegant-serif",
        aura: [],
        artworkPrompt: "",
      },
      theme,
    );
    expect(merged.frame).toBe(theme.extras.frame);
    expect(merged.waveGradient).toEqual(theme.extras.waveGradient);
  });
});
