import { describe, expect, it } from "vitest";

import { analyzeUserJourney } from "@/lib/ai/pipeline";
import type { PersonalityProfile } from "@/lib/ai/types";
import {
  buildPoeticAnalyzerPrompt,
  deterministicEntryInsight,
  deterministicPoeticAnalysis,
  detectVisualTheme,
  extractJsonObject,
  parsePoeticAnalysis,
  THEME_CATALOG,
  type PoeticAnalysis,
} from "./poetic-analyzer";

const SONGS = [
  "Judas Priest - Painkiller",
  "Metallica - Fade to Black",
  "Black Sabbath - Iron Man",
  "Queensrÿche - Silent Lucidity",
  "Iron Maiden - The Trooper",
  "Dio - Rainbow in the Dark",
  "Slayer - Raining Blood",
  "Pink Floyd - Wish You Were Here",
];

function makeProfile(): PersonalityProfile {
  const answers: Record<number, string> = {};
  SONGS.forEach((song, i) => {
    answers[i + 1] = song;
  });
  const profile = analyzeUserJourney(answers);
  if (!profile) throw new Error("fixture profile must exist");
  return profile;
}

const ctx = () => ({ profile: makeProfile(), songs: SONGS });

function validGeminiPayload() {
  return {
    manifesto: "You were forged, not born — and every scar hums in tune.",
    chapters: [
      {
        id: "c1",
        title: "KEŞİF & BÜYÜLENME",
        songIndexes: [1, 2],
        narrative: "Where the first riff became a compass.",
        mood: "feral",
      },
      {
        id: "c2",
        title: "GEÇİŞ PORTALLARI",
        songIndexes: [3, 4, 5],
        narrative: "The doors that only open at full volume.",
        mood: "threshold",
      },
      {
        id: "c3",
        title: "THE LONG ECHO",
        songIndexes: [6, 7, 8],
        narrative: "What remains when the amps cool.",
        mood: "ember",
      },
    ],
    songInsights: SONGS.map((title, i) => ({
      index: i + 1,
      title,
      insight: `Insight for track ${i + 1}`,
    })),
    emotionalCurve: SONGS.map((_, i) => ({
      label: "Defiance",
      intensity: (i + 1) / 8,
    })),
    coreDuality: {
      axis: "Steel / Rain",
      left: "Steel",
      right: "Rain",
      resolution: "Your steel never rusted because you let the rain in.",
    },
    visual: {
      palette: { primary: "#a7b0c0", accent: "#b3122e" },
      aura: ["iron", "ember"],
      artworkPrompt: "A forge under storm clouds, crimson sparks",
    },
  };
}

describe("detectVisualTheme", () => {
  it("detects metal/gothic from genres", () => {
    expect(detectVisualTheme(["Heavy Metal", "Hard Rock"], [])).toBe("metal-gothic");
  });

  it("detects 80s synthwave from genres", () => {
    expect(detectVisualTheme(["Synthwave", "Electronic"], [])).toBe("synthwave-80s");
  });

  it("detects jazz/classical", () => {
    expect(detectVisualTheme(["Jazz", "Classical"], [])).toBe("jazz-classical");
  });

  it("detects indie/acoustic", () => {
    expect(detectVisualTheme(["Indie Folk", "Acoustic"], [])).toBe("indie-acoustic");
  });

  it("detects bright pop", () => {
    expect(detectVisualTheme(["Dance Pop"], [])).toBe("pop-bright");
  });

  it("uses song titles as signal when genres are empty", () => {
    expect(detectVisualTheme([], ["Judas Priest - Painkiller"])).toBe("metal-gothic");
  });

  it("falls back to ambient-default when nothing matches", () => {
    expect(detectVisualTheme(["Ambient"], ["Untitled track 1"])).toBe("ambient-default");
  });

  it("every catalog theme has a complete visual spec", () => {
    for (const spec of Object.values(THEME_CATALOG)) {
      expect(spec.palette.primary).toMatch(/^#/);
      expect(spec.palette.accent).toMatch(/^#/);
      expect(spec.palette.background).toMatch(/^#/);
      expect(spec.palette.text).toMatch(/^#/);
      expect(spec.aura.length).toBeGreaterThan(0);
      expect(spec.artworkPrompt.length).toBeGreaterThan(0);
    }
  });
});

describe("deterministicPoeticAnalysis", () => {
  it("produces a complete, renderable analysis", () => {
    const { profile, songs } = ctx();
    const analysis = deterministicPoeticAnalysis(profile, songs);

    expect(analysis.source).toBe("deterministic");
    expect(analysis.manifesto.length).toBeGreaterThan(0);
    expect(analysis.songInsights).toHaveLength(8);
    expect(analysis.emotionalCurve).toHaveLength(8);
    for (const point of analysis.emotionalCurve) {
      expect(point.intensity).toBeGreaterThanOrEqual(0);
      expect(point.intensity).toBeLessThanOrEqual(1);
    }

    const covered = analysis.chapters.flatMap((c) => c.songIndexes).sort((a, b) => a - b);
    expect(covered).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    expect(analysis.visual.themeId).toBe(detectVisualTheme(profile.recommendedGenres, songs));
    expect(analysis.coreDuality.left).not.toBe(analysis.coreDuality.right);
  });

  it("is deterministic — identical inputs give identical output", () => {
    const { profile, songs } = ctx();
    expect(deterministicPoeticAnalysis(profile, songs)).toEqual(
      deterministicPoeticAnalysis(profile, songs),
    );
  });
});

describe("buildPoeticAnalyzerPrompt", () => {
  it("embeds all songs, the detected theme, and the JSON contract", () => {
    const { profile, songs } = ctx();
    const prompt = buildPoeticAnalyzerPrompt({ profile, songs });

    for (const song of songs) expect(prompt).toContain(song);
    expect(prompt).toContain("metal-gothic");
    expect(prompt).toContain(THEME_CATALOG["metal-gothic"].palette.primary);
    expect(prompt).toContain('"manifesto"');
    expect(prompt).toContain('"chapters"');
    expect(prompt).toContain('"emotionalCurve"');
    expect(prompt).toContain('"coreDuality"');
    expect(prompt).toContain("STRICT JSON");
    expect(prompt).toContain("KEŞİF & BÜYÜLENME");
  });

  it("keeps the biography grounding rule", () => {
    const { profile, songs } = ctx();
    const prompt = buildPoeticAnalyzerPrompt({ profile, songs });
    expect(prompt).toContain("the user's biography is not");
    expect(prompt).toContain("Do not invent facts about the user's real life");
  });

  it("includes memory notes when supplied", () => {
    const { profile, songs } = ctx();
    const memories = SONGS.map(() => null as string | null);
    memories[0] = "my brother's basement, summer of 99";
    const prompt = buildPoeticAnalyzerPrompt({ profile, songs, memories });
    expect(prompt).toContain('memory note: "my brother\'s basement, summer of 99"');
  });
});

describe("deterministicEntryInsight", () => {
  it("weaves the user's own note into the line", () => {
    const insight = deterministicEntryInsight({ songTitle: "Nightcall", note: "gece sürüşü" });
    expect(insight).toContain("Nightcall");
    expect(insight).toContain("gece sürüşü");
  });

  it("is stable and poetic without a note", () => {
    const a = deterministicEntryInsight({ songTitle: "Painkiller" });
    expect(a).toBe(deterministicEntryInsight({ songTitle: "Painkiller" }));
    expect(a).toContain("Painkiller");
    expect(a.length).toBeGreaterThan(10);
  });

  it("falls back gracefully for an empty title", () => {
    const insight = deterministicEntryInsight({ songTitle: "   " });
    expect(insight).toContain("This song");
  });
});

describe("extractJsonObject", () => {
  it("parses plain JSON", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses fenced JSON", () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("parses JSON surrounded by commentary", () => {
    expect(extractJsonObject('Here you go: {"a":1} hope it helps')).toEqual({ a: 1 });
  });

  it("returns null for garbage", () => {
    expect(extractJsonObject("not json at all")).toBeNull();
    expect(extractJsonObject("{broken")).toBeNull();
  });
});

describe("parsePoeticAnalysis", () => {
  it("parses a complete valid Gemini response", () => {
    const analysis = parsePoeticAnalysis(JSON.stringify(validGeminiPayload()), ctx());
    expect(analysis).not.toBeNull();
    const a = analysis as PoeticAnalysis;
    expect(a.source).toBe("gemini");
    expect(a.manifesto).toBe("You were forged, not born — and every scar hums in tune.");
    expect(a.chapters).toHaveLength(3);
    expect(a.chapters[0].title).toBe("KEŞİF & BÜYÜLENME");
    expect(a.chapters[1].songIndexes).toEqual([3, 4, 5]);
    expect(a.songInsights).toHaveLength(8);
    expect(a.emotionalCurve).toHaveLength(8);
    expect(a.coreDuality.axis).toBe("Steel / Rain");
    expect(a.visual.palette.primary).toBe("#a7b0c0");
    expect(a.visual.palette.accent).toBe("#b3122e");
    expect(a.visual.aura).toEqual(["iron", "ember"]);
    expect(a.visual.themeId).toBe("metal-gothic");
  });

  it("parses fenced JSON from a chatty model", () => {
    const raw = `Sure! Here is the analysis:\n\`\`\`json\n${JSON.stringify(validGeminiPayload())}\n\`\`\``;
    const analysis = parsePoeticAnalysis(raw, ctx());
    expect(analysis?.source).toBe("gemini");
    expect(analysis?.chapters).toHaveLength(3);
  });

  it("accepts an already-decoded object", () => {
    const analysis = parsePoeticAnalysis(validGeminiPayload(), ctx());
    expect(analysis?.source).toBe("gemini");
  });

  it("returns null when no JSON object can be recovered", () => {
    expect(parsePoeticAnalysis("total garbage", ctx())).toBeNull();
    expect(parsePoeticAnalysis(42, ctx())).toBeNull();
    expect(parsePoeticAnalysis(null, ctx())).toBeNull();
  });

  it("falls back per-field when the payload is partial", () => {
    const analysis = parsePoeticAnalysis(JSON.stringify({ manifesto: "Only this." }), ctx());
    expect(analysis).not.toBeNull();
    const a = analysis as PoeticAnalysis;
    expect(a.manifesto).toBe("Only this.");
    expect(a.chapters).toEqual(deterministicPoeticAnalysis(ctx().profile, ctx().songs).chapters);
    expect(a.songInsights).toHaveLength(8);
    expect(a.emotionalCurve).toHaveLength(8);
  });

  it("drops chapters with out-of-range or empty song indexes", () => {
    const payload = validGeminiPayload();
    payload.chapters = [
      { id: "bad", title: "BROKEN", songIndexes: [9, 42], narrative: "x", mood: "x" },
      { id: "ok", title: "VALID", songIndexes: [1, 8], narrative: "y", mood: "y" },
    ];
    const analysis = parsePoeticAnalysis(JSON.stringify(payload), ctx());
    expect(analysis?.chapters).toHaveLength(1);
    expect(analysis?.chapters[0].title).toBe("VALID");
  });

  it("rejects invalid hex colors and keeps the theme palette", () => {
    const payload = validGeminiPayload();
    (payload.visual as Record<string, unknown>).palette = {
      primary: "not-a-color",
      accent: "#12345", // invalid length
    };
    const analysis = parsePoeticAnalysis(JSON.stringify(payload), ctx());
    const theme = THEME_CATALOG["metal-gothic"];
    expect(analysis?.visual.palette.primary).toBe(theme.palette.primary);
    expect(analysis?.visual.palette.accent).toBe(theme.palette.accent);
  });

  it("clamps emotional curve intensities and requires one point per song", () => {
    const payload = validGeminiPayload();
    payload.emotionalCurve = SONGS.map(() => ({ label: "X", intensity: 7 }));
    const analysis = parsePoeticAnalysis(JSON.stringify(payload), ctx());
    expect(analysis?.emotionalCurve).toHaveLength(8);
    expect(analysis?.emotionalCurve.every((p) => p.intensity <= 1)).toBe(true);

    const short = validGeminiPayload();
    short.emotionalCurve = [{ label: "X", intensity: 0.5 }];
    const withShort = parsePoeticAnalysis(JSON.stringify(short), ctx());
    expect(withShort?.emotionalCurve).toHaveLength(8);
    expect(withShort?.emotionalCurve[0].label).toBe(
      deterministicPoeticAnalysis(ctx().profile, ctx().songs).emotionalCurve[0].label,
    );
  });

  it("merges partial song insights over the deterministic ones", () => {
    const payload = validGeminiPayload();
    payload.songInsights = [{ index: 4, title: SONGS[3], insight: "A bespoke insight." }];
    const analysis = parsePoeticAnalysis(JSON.stringify(payload), ctx());
    expect(analysis?.songInsights).toHaveLength(8);
    expect(analysis?.songInsights[3].insight).toBe("A bespoke insight.");
    expect(analysis?.songInsights[0].insight).toContain(SONGS[0]);
  });
});
