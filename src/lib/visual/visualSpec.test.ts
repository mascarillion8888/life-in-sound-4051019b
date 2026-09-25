/**
 * FAZ 3 — VisualResolver contract tests (deterministic, no I/O).
 *
 * Kanonik karar (STATE KARARLAR): mood+genre+decade interactive; eksik eksen deterministik
 * fallback'e iner; uydurma yok. Mevcut `moodBackdropUrl` davranışı korunur.
 */
import { describe, expect, it } from "vitest";

import { resolveSceneVisualSpec } from "./visualResolver";
import { normalizeGenre } from "./assetRegistry";

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

    // backdrop aynı kalabilir (etkileşim yalnız mood'e bağlı), ama görsel kimlik farklılaşmalı:
    expect(seventies.backdropUrl).toBeDefined();
    expect(eighties.backdropUrl).toBeDefined();
    expect(seventies.eraStyle?.decade).not.toBe(eighties.eraStyle?.decade);
    expect(seventies.eraTheme).not.toBe(eighties.eraTheme);
    // ikisi de scene palette'te aynıysa bile bileşik kimlikte en az farklı eralar olmalı:
    expect(seventies.eraStyle ?? eighties.eraStyle).toBeDefined();
  });

  it("same mood + different genre → differentiatable via sceneThemeId/palette", () => {
    const goth = resolveSceneVisualSpec({ mood: "Dark", genre: "Doom Metal", releaseYear: 1990 });
    const jazz = resolveSceneVisualSpec({ mood: "Dark", genre: "Jazz", releaseYear: 1990 });

    expect(goth.sceneThemeId).not.toBe(jazz.sceneThemeId);
    // mood ekseni etkilenmez (aynı mood → aynı backdrop):
    expect(goth.backdropUrl).toBe(jazz.backdropUrl);
  });

  it("missing mood → NO backdrop fallback (backdropUrl undefined), genre/decade still work", () => {
    const { backdropUrl, sceneThemeId } = resolveSceneVisualSpec({
      mood: null,
      genre: "Jazz",
      releaseYear: 1972,
    });
    expect(backdropUrl).toBeUndefined();
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
    // genre hâlâ theme belirler:
    expect(res.sceneThemeId).toBe("soul");
  });

  it("all three axes missing → nötr: gothic theme + dreamy-free backdrop (no fabrication)", () => {
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
    expect(res.backdropUrl).toBeUndefined(); // mood uydurulmadı
    expect(res.sceneThemeId).toBe("gothic"); // genre/decade uydurulup tema dayatılmadı
    expect(res.eraStyle).toBeUndefined(); // year yok → eraStyle yok
    // fallbackTrace'te uydurulmuş eksen ispatı yok:
    expect(res.fallbackTrace.some((t) => /source=provider/.test(t) && /genre/.test(t))).toBe(false);
  });

  it("preserves existing moodBackdropUrl behavior — valid mood resolves backdrop URL", () => {
    const res = resolveSceneVisualSpec({ mood: "Dark", genre: "Metal", releaseYear: 2010 });
    expect(res.backdropUrl).toBeDefined();
    expect(res.backdropUrl).toContain("mood-backdrop-dark");
    expect(res.sceneThemeId).toBe("gothic"); // metal → gothic keyword
    expect(res.eraTheme).toBeDefined();
  });
});

describe("exact-match asset registry (FAZ 3.1)", () => {
  it("pop + 1980s + Energetic → exactAssetRef dolu + fallbackTrace'te iz", () => {
    const res = resolveSceneVisualSpec({ mood: "Energetic", genre: "pop", releaseYear: 1985 });
    expect(res.exactAssetRef).toBe("mood-backdrop-energetic.png");
    expect(res.fallbackTrace.join("|")).toContain("exact-match:pop-1980s-energetic");
    // görsel davranış değişmez — backdrop yine aynı mood dosyasını gösterir:
    expect(res.backdropUrl).toBeDefined();
    expect(res.backdropUrl).toContain("mood-backdrop-energetic");
  });

  it("genre eşleşmezse (Rock-1985) → exactAssetRef undefined, exact-match izi yok", () => {
    const res = resolveSceneVisualSpec({ mood: "Energetic", genre: "Rock", releaseYear: 1985 });
    expect(res.exactAssetRef).toBeUndefined();
    expect(res.fallbackTrace.join("|")).not.toContain("exact-match:");
  });

  it("decade eşleşmezse (pop-1990s) → exactAssetRef undefined", () => {
    const res = resolveSceneVisualSpec({ mood: "Energetic", genre: "pop", releaseYear: 1992 });
    expect(res.exactAssetRef).toBeUndefined();
    expect(res.fallbackTrace.join("|")).not.toContain("exact-match:");
  });

  it("soul (decade-free) herhangi bir yılda eşleşir — decade koşulu yoksayılır", () => {
    const seventies = resolveSceneVisualSpec({
      mood: "Energetic",
      genre: "soul",
      releaseYear: 1975,
    });
    const nineties = resolveSceneVisualSpec({
      mood: "Energetic",
      genre: "soul",
      releaseYear: 1994,
    });
    expect(seventies.exactAssetRef).toBe("backdrop-soul-energetic.png");
    expect(nineties.exactAssetRef).toBe("backdrop-soul-energetic.png");
    // dönemsiz kayıt trace'i genre-mood şeklindedir (decade yok).
    expect(seventies.fallbackTrace.join("|")).toContain("exact-match:soul-energetic");
    // backdrop, soul dosyasının gerçek URL'sini gösterir (glob'da çözülür).
    expect(seventies.backdropUrl).toContain("backdrop-soul-energetic");
  });

  it("soul'un yeni decade-free kayıtları (Dark gibi) her yılda exact-match eder", () => {
    const seventies = resolveSceneVisualSpec({ mood: "Dark", genre: "soul", releaseYear: 1972 });
    const nineties = resolveSceneVisualSpec({ mood: "Dark", genre: "soul", releaseYear: 1998 });
    expect(seventies.exactAssetRef).toBe("backdrop-soul-dark.png");
    expect(nineties.exactAssetRef).toBe("backdrop-soul-dark.png");
    // dönemsiz kayıt trace'i genre-mood şeklindedir (decade yok).
    expect(seventies.fallbackTrace.join("|")).toContain("exact-match:soul-dark");
    // backdrop, soul dosyasının gerçek URL'sini gösterir (glob'da çözülür).
    expect(seventies.backdropUrl).toContain("backdrop-soul-dark");
  });

  it("regresyon: pop-1980s dönemsel kayıt yine tam decade eşleşmesiyle seçilir", () => {
    // 1980s → pop kaydı; 1990s → pop kaydı yok (decade opsiyonel olsa da
    // pop kayıtlarının decade'i DOLU — free yok).
    const eighties = resolveSceneVisualSpec({ mood: "Energetic", genre: "pop", releaseYear: 1985 });
    const nineties = resolveSceneVisualSpec({ mood: "Energetic", genre: "pop", releaseYear: 1995 });
    expect(eighties.exactAssetRef).toBe("mood-backdrop-energetic.png");
    expect(nineties.exactAssetRef).toBeUndefined();
    expect(eighties.fallbackTrace.join("|")).toContain("exact-match:pop-1980s-energetic");
  });

  it("9'lu soul seti kapalı — set dışı genre'de exact asset seçilmez", () => {
    // soul'un 9 mood'unun tamamı registry'de; eşleşmeme senaryosu genre≠soul ile gösterilir.
    const res = resolveSceneVisualSpec({ mood: "Dark", genre: "rock", releaseYear: 1970 });
    expect(res.exactAssetRef).toBeUndefined();
    expect(res.fallbackTrace.join("|")).not.toContain("exact-match:");
  });

  it("provider genre'si normalize edilir — iTunes 'R&B/Soul' → soul exact asset", () => {
    // Gerçek provider değeri registry anahtarıyla birebir aynı değildir:
    // iTunes "R&B/Soul" verir, registry anahtarı "soul". normalizeGenre bunu eşler.
    const itunesRnb = resolveSceneVisualSpec({
      mood: "Romantic",
      genre: "R&B/Soul",
      releaseYear: 1967,
    });
    expect(itunesRnb.exactAssetRef).toBe("backdrop-soul-romantic.png");
    expect(itunesRnb.fallbackTrace.join("|")).toContain("exact-match:soul-romantic");
    // backdrop, soul dosyasının gerçek URL'sini gösterir (glob'da çözülür).
    expect(itunesRnb.backdropUrl).toContain("backdrop-soul-romantic");
  });

  it("normalizeGenre — bilinen eşanlamlılar tek kimliğe iner, bilinmeyen aynen kalır", () => {
    const cases: [string, string][] = [
      ["R&B/Soul", "soul"],
      ["rhythm and blues", "soul"],
      ["soul/funk", "soul"],
      ["R&B", "soul"],
      ["Hip-Hop", "hiphop"],
      ["New Wave", "synth"],
      ["Metal", "metal"], // eşleşme yok → küçük-harfli orijinal
    ];
    for (const [input, expected] of cases) {
      expect(normalizeGenre(input)).toBe(expected);
    }
    expect(normalizeGenre(null)).toBeNull();
    expect(normalizeGenre("  ")).toBeNull();
  });
});
