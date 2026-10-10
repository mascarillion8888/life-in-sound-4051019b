/**
 * FAZ 3 — VisualResolver contract tests (deterministic, no I/O).
 *
 * Kanonik karar (STATE KARARLAR): mood+genre+decade interactive; eksik eksen deterministik
 * fallback'e iner; uydurma yok. Mevcut `moodBackdropUrl` davranışı korunur.
 */
import { existsSync } from "fs";
import { resolve as resolvePath } from "path";
import { describe, expect, it } from "vitest";

import {
  ALL_GENRES,
  GENRE_ALIASES,
  normalizeGenre,
  SCENE_ASSET_REGISTRY,
} from "./assetRegistry";
import { resolveSceneVisualSpec } from "./visualResolver";

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
    // Doom Metal (registry'de yok → nötr pop mood-wall + gothic theme) ile
    // Grunge (artık KAYITLI — kendi grunge/ klasöründen backdrop alır).
    // Arkaplan artık farklıdır (grunge kendi folder'ından), tema da farklıdır.
    const goth = resolveSceneVisualSpec({ mood: "Dark", genre: "Doom Metal", releaseYear: 1990 });
    const grunge = resolveSceneVisualSpec({ mood: "Dark", genre: "Grunge", releaseYear: 1990 });

    expect(goth.sceneThemeId).not.toBe(grunge.sceneThemeId);
    // grunge artık kendi asset'ine sahip → backdrop'lar farklılaşır
    // (Doom Metal nötr pop wall'a iner, Grunge grunge/ klasörüne):
    expect(goth.backdropUrl).not.toBe(grunge.backdropUrl);
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

  it("genre eşleşmezse (Doom Metal — registry dışı) → exactAssetRef undefined, exact-match izi yok", () => {
    // Doom Metal bir GenreId DEĞİL ve GENRE_ALIASES'te yok → küçük-harfli orijinal
    // kalır, hiçbir registry satırıyla eşleşmez.
    const res = resolveSceneVisualSpec({ mood: "Energetic", genre: "Doom Metal", releaseYear: 1985 });
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

  it("kayıtlı 23 genre kapalı — registry dışı genre'de (doom metal) exact asset seçilmez", () => {
    // 23 türün 9 mood'unun tamamı registry'de. doom metal aliased değil/GenreId değil
    // → küçük-harfli orijinal kalır, hiçbir satırla eşleşmez.
    const res = resolveSceneVisualSpec({ mood: "Dark", genre: "doom metal", releaseYear: 2002 });
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
      ["rhythm and blues", "rnb"],
      ["soul/funk", "soul"],
      ["R&B", "rnb"],
      ["Hip-Hop", "hiphop"],
      ["New Wave", "synth"],
      ["Pop", "pop"], // eşanlamlı yok → kimlik döner (klasör pop/)
      ["Rock", "rock"], // klasör rock/
      ["Punk", "punk"], // klasör punk/
      // rock ailesi → rock; metal ailesi → metal (2026-10-10 ayrıştı)
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

describe("registry integritesi — 23 genre × 9 mood = 207 yol (2026-10-10)", () => {
  const FOLDER_OVERRIDE: Record<string, string> = { hiphop: "hip-hop" };

  it("207 satır: 23 genre × 9 mood, hepsi kendi klasöründe (kalıbında)", () => {
    expect(ALL_GENRES).toHaveLength(23);
    expect(SCENE_ASSET_REGISTRY).toHaveLength(23 * 9);
    // her satır gerçek GenreId kullanır (uydurma yok), metadata ilk öğeden türetilir
    const genreIds = new Set(ALL_GENRES);
    const refs = SCENE_ASSET_REGISTRY.map((e) => e.assetRef);
    expect(new Set(refs)).toHaveLength(refs.length); // kopya yok
    for (const e of SCENE_ASSET_REGISTRY) {
      expect(genreIds.has(e.genre)).toBe(true);
      const folder = FOLDER_OVERRIDE[e.genre] ?? e.genre;
      expect(e.assetRef.startsWith(`${folder}/`)).toBe(true);
      expect(e.assetRef.endsWith(`mood-backdrop-${e.mood.toLowerCase()}.jpg`)).toBe(true);
    }
  });

  it("her assetRef diske karşılık gelir (src/assets/<folder>/mood-backdrop-<mood>.jpg)", () => {
    // Dosya SİSTEMİNDE varlığı gerçekten doğrulanır (uydurulmuş ref yok). Test
    // çalışma dizini = repo kökü (vitest); assets/ köke göre src/assets/'tir.
    const assetsDir = resolvePath(process.cwd(), "src", "assets");
    for (const e of SCENE_ASSET_REGISTRY) {
      const local = resolvePath(assetsDir, e.assetRef);
      expect({ assetRef: e.assetRef, exists: existsSync(local) }).toHaveProperty("exists", true);
    }
  });

  it("her GENRE_ALIASES hedefi geçerli bir GenreId'dir (belirlenmiş 23 küme içinde)", () => {
    const genreIds: Set<string> = new Set(ALL_GENRES);
    for (const [alias, target] of Object.entries(GENRE_ALIASES)) {
      expect({ alias, target }).toSatisfy((x: { target: string }) => genreIds.has(x.target));
    }
  });
});
