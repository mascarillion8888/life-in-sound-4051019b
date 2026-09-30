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
    // İki kayıtsız genre (registry'de asset klasörü YOK): Doom Metal (→ gothic
    // keyword) ile Grunge (→ grunge theme). İkisi de nötr mood-wall fallback'ine
    // düşer, ama sceneThemeId ile ayrışırlar.
    const goth = resolveSceneVisualSpec({ mood: "Dark", genre: "Doom Metal", releaseYear: 1990 });
    const grunge = resolveSceneVisualSpec({ mood: "Dark", genre: "Grunge", releaseYear: 1990 });

    expect(goth.sceneThemeId).not.toBe(grunge.sceneThemeId);
    // mood ekseni etkilenmez (aynı mood + kayıtsız genre → aynı nötr backdrop):
    expect(goth.backdropUrl).toBe(grunge.backdropUrl);
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
  it("pop + Energetic → exactAssetRef dolu + fallbackTrace'te iz (dönemsiz)", () => {
    const res = resolveSceneVisualSpec({ mood: "Energetic", genre: "pop", releaseYear: 1985 });
    expect(res.exactAssetRef).toBe("pop/mood-backdrop-energetic.jpg");
    expect(res.fallbackTrace.join("|")).toContain("exact-match:pop-energetic");
    // görsel davranış değişmez — backdrop aynı mood dosyasının folder URL'sini gösterir:
    expect(res.backdropUrl).toBeDefined();
    expect(res.backdropUrl).toContain("mood-backdrop-energetic");
  });

  it("genre eşleşmezse (Grunge-1985, klasörsüz/registry'siz) → exactAssetRef undefined, exact-match izi yok", () => {
    const res = resolveSceneVisualSpec({ mood: "Energetic", genre: "Grunge", releaseYear: 1985 });
    expect(res.exactAssetRef).toBeUndefined();
    expect(res.fallbackTrace.join("|")).not.toContain("exact-match:");
    });

  it("pop artık dönemsiz — 1990s'te de exact match eder", () => {
    const res = resolveSceneVisualSpec({ mood: "Energetic", genre: "pop", releaseYear: 1992 });
    expect(res.exactAssetRef).toBe("pop/mood-backdrop-energetic.jpg");
    expect(res.fallbackTrace.join("|")).toContain("exact-match:pop-energetic");
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
    expect(seventies.exactAssetRef).toBe("soul/mood-backdrop-energetic.jpg");
    expect(nineties.exactAssetRef).toBe("soul/mood-backdrop-energetic.jpg");
    // dönemsiz kayıt trace'i genre-mood şeklindedir (decade yok).
    expect(seventies.fallbackTrace.join("|")).toContain("exact-match:soul-energetic");
    // backdrop, soul dosyasının gerçek URL'sini gösterir (glob'da çözülür).
    expect(seventies.backdropUrl).toContain("mood-backdrop-energetic");
  });

  it("soul'un yeni decade-free kayıtları (Dark gibi) her yılda exact-match eder", () => {
    const seventies = resolveSceneVisualSpec({ mood: "Dark", genre: "soul", releaseYear: 1972 });
    const nineties = resolveSceneVisualSpec({ mood: "Dark", genre: "soul", releaseYear: 1998 });
    expect(seventies.exactAssetRef).toBe("soul/mood-backdrop-dark.jpg");
    expect(nineties.exactAssetRef).toBe("soul/mood-backdrop-dark.jpg");
    // dönemsiz kayıt trace'i genre-mood şeklindedir (decade yok).
    expect(seventies.fallbackTrace.join("|")).toContain("exact-match:soul-dark");
    // backdrop, soul dosyasının gerçek URL'sini gösterir (glob'da çözülür).
    expect(seventies.backdropUrl).toContain("mood-backdrop-dark");
  });

  it("yeni genre klasörleri exact-match eder — jazz/hiphop/funk/new-age/reggae (2026-09-30)", () => {
    const cases: [string, string, string][] = [
      // [genre, mood, expected assetRef]
      ["Jazz", "Dark", "jazz/mood-backdrop-dark.jpg"],
      ["Hip-Hop", "Energetic", "hip-hop/mood-backdrop-energetic.jpg"],
      ["Funk", "Playful", "funk/mood-backdrop-playful.jpg"],
      ["New Age", "Dreamy", "new age/mood-backdrop-dreamy.jpg"],
      ["Reggae", "World", "reggae/mood-backdrop-world.jpg"],
    ];
    for (const [genre, mood, expectedRef] of cases) {
      const res = resolveSceneVisualSpec({ mood, genre, releaseYear: 1990 });
      expect(res.exactAssetRef).toBe(expectedRef);
      expect(res.fallbackTrace.join("|")).toContain("exact-match:");
      expect(res.backdropUrl).toBeDefined();
      expect(res.backdropUrl).toContain("mood-backdrop");
    }
  });

  it("regresyon: pop dönemsiz — 1980s ve 1990s ikisi de exact match eder", () => {
    const eighties = resolveSceneVisualSpec({ mood: "Energetic", genre: "pop", releaseYear: 1985 });
    const nineties = resolveSceneVisualSpec({ mood: "Energetic", genre: "pop", releaseYear: 1995 });
    expect(eighties.exactAssetRef).toBe("pop/mood-backdrop-energetic.jpg");
    expect(nineties.exactAssetRef).toBe("pop/mood-backdrop-energetic.jpg");
    expect(eighties.fallbackTrace.join("|")).toContain("exact-match:pop-energetic");
  });

  it("kayıtlı dokuz genre kapalı — set dışı genre'de (grunge) exact asset seçilmez", () => {
    // pop/punk/rock/soul/funk/hiphop/jazz/new-age/reggae'nin 9 mood'unun tamamı registry'de.
    // grunge klasörsüz/registry'siz (GenreId var ama asset yok):
    const res = resolveSceneVisualSpec({ mood: "Dark", genre: "grunge", releaseYear: 2002 });
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
    expect(itunesRnb.exactAssetRef).toBe("soul/mood-backdrop-romantic.jpg");
    expect(itunesRnb.fallbackTrace.join("|")).toContain("exact-match:soul-romantic");
    // backdrop, soul dosyasının gerçek URL'sini gösterir (glob'da çözülür).
    expect(itunesRnb.backdropUrl).toContain("mood-backdrop-romantic");
  });

  it("normalizeGenre — bilinen eşanlamlılar tek kimliğe iner, bilinmeyen aynen kalır", () => {
    const cases: [string, string][] = [
      ["R&B/Soul", "soul"],
      ["rhythm and blues", "soul"],
      ["soul/funk", "soul"],
      ["R&B", "soul"],
      ["Hip-Hop", "hiphop"],
      ["New Wave", "synth"],
      ["Pop", "pop"], // eşanlamlı yok → kimlik döner (klasör pop/)
      ["Rock", "rock"], // klasör rock/
      ["Punk", "punk"], // klasör punk/
      // rock/metal ailesi → rock klasörü (2026-09-29 alias eklendi)
      ["Hard Rock", "rock"],
      ["Heavy Metal", "rock"],
      ["Metal", "rock"],
      ["Hard Rock & Metal", "rock"],
      ["Hard Rock and Metal", "rock"],
      ["Classic Rock", "rock"],
      ["Rock & Roll", "rock"],
      ["German Rock", "rock"],
      ["Arena Rock", "rock"],
      ["Rockabilly", "rock"],
      ["Doom Metal", "doom metal"], // alias'ta yok → küçük-harfli orijinal (eşleşmez)
      // 2026-09-30 yeni genre aileleri → ilgili klasör
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
      // hibritler soul'a iner (soul kaynağı), funk klasörüne DEĞİL:
      ["Soul/Funk", "soul"],
      ["Funk/Soul", "soul"],
    ];
    for (const [input, expected] of cases) {
      expect(normalizeGenre(input)).toBe(expected);
    }
    expect(normalizeGenre(null)).toBeNull();
    expect(normalizeGenre("  ")).toBeNull();
  });
});
