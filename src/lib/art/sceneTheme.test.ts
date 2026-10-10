import { describe, expect, it } from "vitest";
import { sceneThemeFor, sceneThemeForGenre } from "@/lib/art/sceneTheme";
import { resolveSceneVisualSpec } from "@/lib/visual/visualResolver";
import type { Song } from "@/lib/song/types";

function song(over: Partial<Song> = {}): Song {
  const base: Song = {
    provider: "manual", providerId: "x", title: "Neutral", artist: "A", album: null,
    artworkUrl: null, releaseYear: 1990, previewUrl: null, isrc: null,
    genre: null, mood: null,
  };
  return { ...base, ...over };
}

/**
 * 23 tür wiring sonrası beklenen tema (2026-10-10).
 * Kullanıcı kararı: latin→synth, gospel→soul, soundtrack→acoustic, world→acoustic,
 * timeless-opera→gothic — wiring öncesi temalara geri. Diğer 18 tür değişmez.
 * NOT: base KEYWORD fallback gothic DEĞİL — bu tablo "gothic"e sessiz düşüşü değil,
 * GERÇEK beklenen temayı sabitler (gerileme yakalansın diye).
 */
const EXPECT: Record<string, string> = {
  pop: "synth",
  punk: "gothic",
  metal: "gothic",
  rock: "gothic",
  hiphop: "hiphop",
  jazz: "jazz",
  reggae: "reggae",
  soul: "soul",
  funk: "soul",
  "new age": "gothic",
  synth: "synth",
  gothic: "gothic",
  grunge: "grunge",
  acoustic: "acoustic",
  classical: "acoustic",
  country: "acoustic",
  folk: "acoustic",
  gospel: "soul", // GERİLEME DÜZELMESİ: wiring öncesi soul
  latin: "synth", // GERİLEME DÜZELMESİ: wiring öncesi synth
  rnb: "soul",
  soundtrack: "acoustic", // GERİLEME DÜZELMESİ: wiring öncesi acoustic
  "timeless-opera": "gothic",
  world: "acoustic", // GERİLEME DÜZELMESİ: wiring öncesi acoustic
};

// Saf genre fonksiyonunun undefined döndüğü (gothic'e çağırıcı fallback yapar) genre'ler:
// bunlar gothic keyword'ünde EŞLEŞMEYEN'ler — "rock"/"new age" keyword yok,
// "gothic" string'i "goth" (kelime-sınırı regex'i) eşleşmez.
const PURE_FALLBACK = new Set(["rock", "new age", "gothic"]);

describe("sceneThemeFor — 23 tür beklentisi (gerileme koruması)", () => {
  it.each(Object.entries(EXPECT))("%s → %s", (genre, expected) => {
    const s = song({ genre });
    expect(sceneThemeFor(s)).toBe(expected);
    // Saf fonksiyon: gerçek keyword/eşleme olanlarda temayı, yoksa undefined döner.
    if (PURE_FALLBACK.has(genre)) {
      expect(sceneThemeForGenre(genre)).toBeUndefined();
    } else {
      expect(sceneThemeForGenre(genre)).toBe(expected);
    }
  });

  // title/artist/album fallback'i genre-dışı genel kelimelerle YANLIŞ tema üretmemeli.
  // keywordIn kelime-sınırı regex'i kullanır; ama bu sözcükler SCENE_KEYWORDS'a
  // eklenmediği için "Hello World"/"Latin Lover"/"Movie Score" başlıkları gothic'ta kalmalı.
  it("title/artist fallback, genel kelimelerden yanlış tema üretmez (gothic fallback)", () => {
    const cases = [
      song({ genre: null, title: "Hello World" }),
      song({ genre: null, title: "Latin Lover" }),
      song({ genre: null, title: "Movie Score", artist: "M" }),
      song({ genre: null, title: "Hymn 4", artist: "Gospel Choir" }),
    ];
    for (const s of cases) {
      expect(sceneThemeFor(s)).toBe("gothic");
    }
  });
});

describe("resolver ≡ sceneThemeFor — 23 tür eşitlik (iki kaynak aynı karar)", () => {
  it.each(Object.keys(EXPECT))("%s", (genre) => {
    const renderTheme = sceneThemeFor(song({ genre }));
    const resolverTheme = resolveSceneVisualSpec({ mood: "Dreamy", genre, releaseYear: 1990 }).sceneThemeId;
    expect(resolverTheme).toBe(renderTheme);
    expect(resolverTheme).toBe(EXPECT[genre]);
  });
});