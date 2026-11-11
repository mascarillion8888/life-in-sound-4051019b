/**
 * FAZ 3 / 3.2 — VisualResolver + decade-aware backdrop registry contract tests
 * (deterministic, no I/O). Kanonik karar (STATE KARARLAR): mood+genre+decade
 * interactive; eksik eksen deterministik fallback'e iner; uydurma yok.
 *
 * Fallback sırası (bkz. backdropRegistry.resolveBackdrop):
 *   (a) exact genre+mood+decade  (b) genre+decade→nearest mood
 *   (c) genre+mood→nearest decade (ties→later)  (d) genre→nearest decade  (e) default
 * Tüm fallback testleri TABLO güdümlüdür (Sonar kopya oranı düşük kalsın).
 */
import { existsSync } from "fs";
import { resolve as resolvePath } from "path";
import { describe, expect, it } from "vitest";

import { ALL_GENRES, GENRE_ALIASES, normalizeGenre } from "./assetRegistry";
import {
  BACKDROP_REGISTRY,
  DECADES,
  decadeForYear,
  normalizeDecade,
  resolveBackdrop,
  type BackdropEntry,
} from "./backdropRegistry";
import { resolveSceneVisualSpec } from "./visualResolver";

/** Sentetik kayıt kurucu — test tablolarını kısa tutar (kopya azaltır). */
function reg(genre: string, mood: string, decade: string): BackdropEntry {
  return {
    genre,
    mood,
    decade: decade as BackdropEntry["decade"],
    assetRef: `${genre}/${mood}-${decade}.webp`,
  };
}

describe("resolveSceneVisualSpec — interactive Song{mood, genre, decade}", () => {
  it("same mood + different decade → differentiatable via eraStyle/eraTheme (not identical visuals)", () => {
    const seventies = resolveSceneVisualSpec({
      mood: "Energetic",
      genre: "Rock",
      releaseYear: 1975,
    });
    const eighties = resolveSceneVisualSpec({
      mood: "Energetic",
      genre: "Rock",
      releaseYear: 1985,
    });

    // Yalnız eski (1980s) dosyalar varken backdrop AYNI dosyaya inebilir; ama
    // çözüm dönemi raporlar ve exact=false olur → görsel kimlik farklılaşır.
    expect(seventies.backdropUrl).toBeDefined();
    expect(eighties.backdropUrl).toBeDefined();
    expect(seventies.matchedDecade).toBe("1980s");
    expect(seventies.backdropExact).toBe(false);
    expect(eighties.backdropExact).toBe(true);
    expect(seventies.eraStyle?.decade).not.toBe(eighties.eraStyle?.decade);
    expect(seventies.eraTheme).not.toBe(eighties.eraTheme);
    expect(seventies.eraStyle ?? eighties.eraStyle).toBeDefined();
  });

  it("same mood + different genre → differentiatable via sceneThemeId/palette", () => {
    const goth = resolveSceneVisualSpec({ mood: "Dark", genre: "Doom Metal", releaseYear: 1990 });
    const grunge = resolveSceneVisualSpec({ mood: "Dark", genre: "Grunge", releaseYear: 1990 });

    expect(goth.sceneThemeId).not.toBe(grunge.sceneThemeId);
    expect(goth.backdropUrl).not.toBe(grunge.backdropUrl);
  });

  it("missing mood → NO backdrop fallback (backdropUrl undefined), genre/decade still work", () => {
    const { backdropUrl, sceneThemeId, matchedDecade } = resolveSceneVisualSpec({
      mood: null,
      genre: "Jazz",
      releaseYear: 1972,
    });
    expect(backdropUrl).toBeUndefined();
    expect(matchedDecade).toBeUndefined();
    expect(sceneThemeId).toBe("jazz");
  });

  it("missing genre → neutral gothic regardless of releaseYear (year no longer guesses a genre)", () => {
    const seventies = resolveSceneVisualSpec({ mood: null, genre: null, releaseYear: 1975 });
    const eighties = resolveSceneVisualSpec({ mood: null, genre: null, releaseYear: 1986 });
    expect(seventies.sceneThemeId).toBe("gothic");
    expect(eighties.sceneThemeId).toBe("gothic");
  });

  it("missing genre + missing releaseYear → gothic", () => {
    const { sceneThemeId } = resolveSceneVisualSpec({ mood: null, genre: null, decade: null });
    expect(sceneThemeId).toBe("gothic");
  });

  it("releaseYear missing → eraStyle/eraTheme empty", () => {
    const res = resolveSceneVisualSpec({ mood: "Dreamy", genre: "Soul", decade: null });
    expect(res.eraStyle).toBeUndefined();
    expect(res.eraTheme).toBeUndefined();
    expect(res.sceneThemeId).toBe("soul");
  });

  it("all three axes missing → nötr: gothic theme + no backdrop (no fabrication)", () => {
    const res = resolveSceneVisualSpec({});
    expect(res.sceneThemeId).toBe("gothic");
    expect(res.backdropUrl).toBeUndefined();
    expect(res.eraStyle).toBeUndefined();
    expect(res.eraTheme).toBeUndefined();
  });

  it("fallbackTrace is deterministic and ordered", () => {
    const res = resolveSceneVisualSpec({});
    const res2 = resolveSceneVisualSpec({});
    expect(res.fallbackTrace).toEqual(res2.fallbackTrace);
    expect(res.fallbackTrace.join("|")).toContain("backdrop:missing-mood->none");
    expect(res.fallbackTrace.join("|")).toContain("theme:missing-genre->decade-ladder");
    expect(res.fallbackTrace.join("|")).toContain("theme:decade-ladder->gothic-default");
    expect(res.fallbackTrace.join("|")).toContain("era:missing-year->eraStyle/eraTheme-empty");
  });

  it("never fabricates a missing axis — no invented genre/decade/mood values", () => {
    const res = resolveSceneVisualSpec({ mood: null, genre: null, releaseYear: null });
    expect(res.backdropUrl).toBeUndefined();
    expect(res.sceneThemeId).toBe("gothic");
    expect(res.eraStyle).toBeUndefined();
    expect(res.fallbackTrace.some((t) => /source=provider/.test(t) && /genre/.test(t))).toBe(false);
  });

  it("preserves existing moodBackdropUrl behavior — valid mood resolves backdrop URL", () => {
    const res = resolveSceneVisualSpec({ mood: "Dark", genre: "Metal", releaseYear: 2010 });
    expect(res.backdropUrl).toBeDefined();
    expect(res.backdropUrl).toContain("mood-backdrop-dark");
    expect(res.sceneThemeId).toBe("gothic");
    expect(res.eraTheme).toBeDefined();
  });

  it("returns matched decade + exact flag so a later PR can add an era layer", () => {
    const res = resolveSceneVisualSpec({ mood: "Energetic", genre: "pop", releaseYear: 1985 });
    expect(res.matchedDecade).toBe("1980s");
    expect(res.backdropExact).toBe(true);
    expect(res.backdropStrategy).toBe("exact");
    expect(res.fallbackTrace.join("|")).toContain("backdrop-match:exact:");
  });
});

describe("decadeForYear / normalizeDecade — clamping (no fabrication)", () => {
  const cases: [number, string][] = [
    [1955, "1960s"],
    [1960, "1960s"],
    [1969, "1960s"],
    [1975, "1970s"],
    [1985, "1980s"],
    [1994, "1990s"],
    [2001, "2000s"],
    [2015, "2010s"],
    [2020, "2020s"],
    [2035, "2020s"],
  ];
  it.each(cases)("decadeForYear(%i) → %s", (year, expected) => {
    expect(decadeForYear(year)).toBe(expected);
  });

  it("normalizeDecade parses labels/years and returns null for junk", () => {
    expect(normalizeDecade("1970s")).toBe("1970s");
    expect(normalizeDecade("1970")).toBe("1970s");
    expect(normalizeDecade(1999)).toBe("1990s");
    expect(normalizeDecade("  80s ")).toBeNull();
    expect(normalizeDecade("abc")).toBeNull();
    expect(normalizeDecade(null)).toBeNull();
    expect(normalizeDecade(undefined)).toBeNull();
  });

  it("DECADES is the canonical ascending list (1960s..2020s)", () => {
    expect([...DECADES]).toEqual(["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"]);
  });
});

describe("resolveBackdrop — deterministic fallback order (table-driven)", () => {
  const REG: BackdropEntry[] = [
    reg("rock", "Melancholic", "1970s"),
    reg("rock", "Melancholic", "1990s"),
    reg("rock", "Energetic", "1970s"),
    reg("rock", "Dreamy", "1970s"),
    reg("pop", "Melancholic", "1980s"),
    reg("pop", "Dreamy", "1980s"),
  ];

  const cases: {
    name: string;
    input: Parameters<typeof resolveBackdrop>[0];
    ref: string;
    strategy: string;
    decade?: string;
    exact?: boolean;
  }[] = [
    {
      name: "(a) exact genre+mood+decade",
      input: { mood: "Melancholic", genre: "rock", decade: "1970s" },
      ref: "rock/Melancholic-1970s.webp",
      strategy: "exact",
      decade: "1970s",
      exact: true,
    },
    {
      name: "(b) same genre+decade, nearest mood (requested mood absent)",
      input: { mood: "Euphoric", genre: "rock", decade: "1970s" },
      ref: "rock/Energetic-1970s.webp",
      strategy: "mood",
      decade: "1970s",
      // decade TAM eşleşti (yalnız mood düştü) → era katmanı gerekmez:
      exact: true,
    },
    {
      name: "(c) same genre+mood, nearest decade (ties prefer the LATER decade)",
      input: { mood: "Melancholic", genre: "rock", decade: "1980s" },
      ref: "rock/Melancholic-1990s.webp",
      strategy: "decade",
      decade: "1990s",
      exact: false,
    },
    {
      name: "(d) same genre, nearest decade, any mood",
      input: { mood: "Dark", genre: "rock", decade: "2000s" },
      ref: "rock/Melancholic-1990s.webp",
      strategy: "genre-decade",
      decade: "1990s",
      exact: false,
    },
    {
      name: "(e) unknown genre → global default (pop mood wall)",
      input: { mood: "Melancholic", genre: "polka", decade: "1970s" },
      ref: "pop/Melancholic-1980s.webp",
      strategy: "default",
      decade: "1980s",
      exact: false,
    },
    {
      name: "(e) unknown genre + unknown mood → neutral dreamy default",
      input: { mood: "Dark", genre: "polka", decade: "1970s" },
      ref: "pop/Dreamy-1980s.webp",
      strategy: "default",
      decade: "1980s",
      exact: false,
    },
    {
      name: "no decade (releaseYear absent) → 1980s target, ties prefer LATER decade",
      input: { mood: "Melancholic", genre: "rock" },
      ref: "rock/Melancholic-1990s.webp",
      strategy: "decade",
      decade: "1990s",
      exact: false,
    },
  ];

  it.each(cases)("$name", ({ input, ref, strategy, decade, exact }) => {
    const res = resolveBackdrop(input, REG);
    expect(res.assetRef).toBe(ref);
    expect(res.strategy).toBe(strategy);
    if (decade) expect(res.matchedDecade).toBe(decade);
    if (exact !== undefined) expect(res.exact).toBe(exact);
  });

  it("(b) ties in mood distance resolve deterministically (stable across calls)", () => {
    const a = resolveBackdrop({ mood: "Dark", genre: "rock", decade: "1970s" }, REG);
    const b = resolveBackdrop({ mood: "Dark", genre: "rock", decade: "1970s" }, REG);
    expect(a.assetRef).toBe(b.assetRef);
  });

  it("empty registry → never throws, returns the neutral default", () => {
    const res = resolveBackdrop({ mood: "Melancholic", genre: "rock", decade: "1970s" }, []);
    expect(res.assetRef).toBe("pop/mood-backdrop-dreamy.jpg");
    expect(res.strategy).toBe("default");
    expect(res.exact).toBe(false);
  });

  it("empty registry + no axes → never throws", () => {
    expect(() => resolveBackdrop({}, [])).not.toThrow();
    expect(resolveBackdrop({}, []).strategy).toBe("default");
  });
});

describe("BACKDROP_REGISTRY — derived from files (no hand-written list)", () => {
  it("every entry is a real file under src/assets (no fabricated ref)", () => {
    const assetsDir = resolvePath(process.cwd(), "src", "assets");
    expect(BACKDROP_REGISTRY.length).toBeGreaterThan(0);
    for (const e of BACKDROP_REGISTRY) {
      const local = resolvePath(assetsDir, e.assetRef);
      expect({ assetRef: e.assetRef, exists: existsSync(local) }).toHaveProperty("exists", true);
    }
  });

  it("legacy (decade-less) files are treated as 1980s", () => {
    const legacy = BACKDROP_REGISTRY.filter((e) => e.assetRef.endsWith(".jpg"));
    expect(legacy.length).toBeGreaterThan(0);
    for (const e of legacy) expect(e.decade).toBe("1980s");
  });

  it("genre ids are canonical (folder 'hip-hop' → 'hiphop')", () => {
    const hiphop = BACKDROP_REGISTRY.filter((e) => e.assetRef.startsWith("hip-hop/"));
    expect(hiphop.length).toBeGreaterThan(0);
    for (const e of hiphop) expect(e.genre).toBe("hiphop");
  });

  it("resolution is deterministic across calls (sorted, stable)", () => {
    const a = resolveBackdrop({ mood: "Dark", genre: "metal", releaseYear: 1985 });
    const b = resolveBackdrop({ mood: "Dark", genre: "metal", releaseYear: 1985 });
    expect(a).toEqual(b);
  });
});

describe("resolveSceneVisualSpec — decade-aware integration (real registry)", () => {
  it("1985 pop energetic is an EXACT 1980s match", () => {
    const res = resolveSceneVisualSpec({ mood: "Energetic", genre: "pop", releaseYear: 1985 });
    expect(res.exactAssetRef).toBe("pop/mood-backdrop-energetic.jpg");
    expect(res.matchedDecade).toBe("1980s");
    expect(res.backdropExact).toBe(true);
    expect(res.backdropStrategy).toBe("exact");
    expect(res.backdropUrl).toContain("mood-backdrop-energetic");
  });

  it("1975 pop energetic is APPROXIMATE (falls back to the 1980s file) — the bug this PR fixes", () => {
    const res = resolveSceneVisualSpec({ mood: "Energetic", genre: "pop", releaseYear: 1975 });
    expect(res.exactAssetRef).toBe("pop/mood-backdrop-energetic.jpg");
    expect(res.matchedDecade).toBe("1980s");
    expect(res.backdropExact).toBe(false);
    expect(res.fallbackTrace.join("|")).toContain("backdrop-match:");
    expect(res.fallbackTrace.join("|")).toContain(":approx");
  });

  it("unknown genre falls back to the neutral pop mood wall, reported as default", () => {
    const res = resolveSceneVisualSpec({ mood: "Dark", genre: "Doom Metal", releaseYear: 1990 });
    expect(res.backdropStrategy).toBe("default");
    expect(res.backdropUrl).toContain("pop/mood-backdrop-dark");
    expect(res.backdropExact).toBe(false);
  });

  it("provider genre is normalized — iTunes 'R&B/Soul' → soul asset", () => {
    const res = resolveSceneVisualSpec({ mood: "Romantic", genre: "R&B/Soul", releaseYear: 1985 });
    expect(res.exactAssetRef).toBe("soul/mood-backdrop-romantic.jpg");
    expect(res.matchedDecade).toBe("1980s");
    expect(res.backdropExact).toBe(true);
    expect(res.backdropUrl).toContain("mood-backdrop-romantic");
  });
});

describe("normalizeGenre — synonyms collapse, unknown preserved", () => {
  const cases: [string, string][] = [
    ["R&B/Soul", "soul"],
    ["rhythm and blues", "rnb"],
    ["soul/funk", "soul"],
    ["R&B", "rnb"],
    ["Hip-Hop", "hiphop"],
    ["New Wave", "synth"],
    ["Pop", "pop"],
    ["Rock", "rock"],
    ["Punk", "punk"],
    ["Hard Rock", "rock"],
    ["Heavy Metal", "metal"],
    ["Metal", "metal"],
    ["Hard Rock & Metal", "metal"],
    ["Hard Rock and Metal", "metal"],
    ["Classic Rock", "rock"],
    ["Rock & Roll", "rock"],
    ["German Rock", "rock"],
    ["Arena Rock", "rock"],
    ["Rockabilly", "rock"],
    ["Doom Metal", "doom metal"],
    ["Funk", "funk"],
    ["P-Funk", "funk"],
    ["Smooth Jazz", "jazz"],
    ["Acid Jazz", "jazz"],
    ["Bebop", "jazz"],
    ["Swing", "jazz"],
    ["New Age", "new age"],
    ["Newage", "new age"],
    ["Ambient", "new age"],
    ["Dancehall", "reggae"],
    ["Ska", "reggae"],
    ["Reggaeton", "reggae"],
    ["Roots Reggae", "reggae"],
    ["Soul/Funk", "soul"],
    ["Funk/Soul", "soul"],
  ];
  it.each(cases)("normalizeGenre(%s) → %s", (input, expected) => {
    expect(normalizeGenre(input)).toBe(expected);
  });

  it("null/blank → null (no fabrication)", () => {
    expect(normalizeGenre(null)).toBeNull();
    expect(normalizeGenre("  ")).toBeNull();
  });
});

describe("taxonomy integrity — 23 genres, aliases target canonical ids", () => {
  it("ALL_GENRES is the closed 23-genre set", () => {
    expect(ALL_GENRES).toHaveLength(23);
    expect(new Set(ALL_GENRES).size).toBe(23);
  });

  it("every GENRE_ALIASES target is a valid GenreId", () => {
    const genreIds: Set<string> = new Set(ALL_GENRES);
    for (const [alias, target] of Object.entries(GENRE_ALIASES)) {
      expect({ alias, target }).toSatisfy((x: { target: string }) => genreIds.has(x.target));
    }
  });
});
