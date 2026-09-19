/**
 * FAZ 3 — Visual Resolver (interactive mood+genre+decade → SceneVisualResolution).
 *
 * Kanonik karar (STATE KARARLAR, 18 Eylül): mood+genre+decade üçü birlikte ve etkileşimli olarak
 * nihai görsel kimliği belirler. Bu modül O KARARI deterministik, saf (I/O'suz, LLM'siz, görsel
 * üretimsiz) fonksiyonlara çevirir; mevcut onaylı parçaları yeniden kullanır:
 *   - backdrop:   `moodBackdropUrl` (9 mood-backdrop glob)
 *   - scene theme: `SCENE_KEYWORDS` + `keywordIn` (genre keyword matrisi) → decade ladder → gothic
 *   - eraStyle:   `eraStyleFor` (releaseYear → mount/palette/grading)
 *   - eraTheme:   `eraThemeForYear` (eraThemes)
 *
 * Yeni eşleme uydurulmaz; eksik eksen deterministik fallback'e iner ve `fallbackTrace`'e yazılır
 * (ANA_YASA §0 — uydurma YOK).
 *
 * FAZ 4 entegrasyonu: SceneRoom bu çıktıyı tüketecek. Bu dosya YALNIZCA çözüm fonksiyonudur.
 */
import type { SceneThemeId } from "@/components/scene/scenePalettes";
import { SCENE_PALETTES } from "@/components/scene/scenePalettes";
import { moodBackdropUrl } from "@/components/scene/moodBackdrop";
import { SCENE_KEYWORDS, keywordIn } from "@/lib/art/sceneTheme";
import { eraStyleFor } from "@/lib/soundmap/eraStyle";
import { eraThemeForYear } from "@/lib/visual/eraThemes";
import type { Mood } from "@/lib/ai/moodInference";
import type {
  SceneVisualResolution,
  SceneVisualSpecInput,
  SceneVisualSpec,
} from "@/types/visualSpec";
import { SCENE_ASSET_REGISTRY, type SceneAssetEntry } from "./assetRegistry";

/**
 * Scene theme'ini genre keyword eşleşmesiyle bul. Mevcut SCENE_KEYWORDS matrisini kullanır —
 * yeni eşleme üretmez. Sıra: gothic, hiphop, grunge, soul, jazz, reggae, synth (SCENE_KEYWORDS
 * tanım sırası). Eşleşme yoksa undefined (çağırıcı decade ladder'a geçer).
 */
function themeFromGenreKeyword(genre: string | null): SceneThemeId | undefined {
  if (!genre) return undefined;
  const haystack = genre.toLowerCase();
  for (const { id, keywords } of SCENE_KEYWORDS) {
    if (keywords.some((k) => keywordIn(haystack, k))) return id;
  }
  return undefined;
}

/**
 * ReleaseYear yoksa (veya eksik sapma cümlesi) kullanılacak decade ladder — kullanıcının
 * FAZ 3'te belirttiği sıra: <=1969 jazz, <=1979 soul, <=1989 synth, <=1999 grunge, <=2010 hiphop,
 * aksi gothic. `decade` string'i "1980s" ise sayıya çevirilir; ne string ne sayı → gothic.
 */
export function decadeTheme(
  releaseYear: number | null | undefined,
  decade: string | null | undefined,
): SceneThemeId {
  let year = releaseYear;
  if (year === undefined || year === null) {
    if (typeof decade === "string" && /^\d{4}s$/.test(decade)) {
      year = Number(decade.slice(0, 4));
    }
  }
  if (year === undefined || year === null || Number.isNaN(year)) return "gothic";
  if (year <= 1969) return "jazz";
  if (year <= 1979) return "soul";
  if (year <= 1989) return "synth";
  if (year <= 1999) return "grunge";
  if (year <= 2010) return "hiphop";
  return "gothic";
}

/**
 * Exact-match asset araması (FAZ 3.1). Registry'de `{genre, decade, mood}`
 * üçlüsüne TAM eşleşen bir kayıt varsa onu döndürür, yoksa undefined.
 * - genre: küçük harf normalleştirilir.
 * - decade: string "1980s" olarak; yoksa releaseYear'den türetilir (1985 → "1980s").
 * - mood: MOOD_SET değeriyle (case-insensitive) karşılaştırılır.
 * Eşleşme yoksa mevcut FAZ 3 çözümü aynen devreye girer — hiçbir davranış değişmez.
 */
export function resolveExactAsset(
  mood: Mood | string | null | undefined,
  genre: string | null | undefined,
  decade: string | null | undefined,
  releaseYear?: number | null,
): SceneAssetEntry | undefined {
  if (!mood || !genre) return undefined;
  const moodKey = mood.trim();
  const genreKey = genre.trim().toLowerCase();

  let decKey = decade?.trim().toLowerCase() ?? "";
  if (!decKey && typeof releaseYear === "number" && Number.isFinite(releaseYear)) {
    decKey = `${Math.floor(releaseYear / 10) * 10}s`;
  }
  if (!decKey) return undefined;

  for (const entry of SCENE_ASSET_REGISTRY) {
    if (
      entry.genre.toLowerCase() === genreKey &&
      entry.decade.toLowerCase() === decKey &&
      entry.mood.toLowerCase() === moodKey.toLowerCase()
    ) {
      return entry;
    }
  }
  return undefined;
}

/**
 * Kanonik deterministik VisualResolver. Girdi eksenlerini tek bir çözüme indirir.
 * Hiçbir eksen uydurulmaz; eksik eksen düşüşü `fallbackTrace`'e yazılır.
 *
 * Exposure not (ponytail): bu sürüm, SceneRoom'un tek sahne kararına hizmet eder ve
 * per-song kullanımda `eraStyleFor` için cardIndex=0 varsayılır. Card-kontekstli çağrı
 * (EraCardReveal) gerektiğinde cardIndex parametresi ayrıca eklenmeli; bu FAZ 4.
 */
export function resolveSceneVisualSpec(input: SceneVisualSpecInput): SceneVisualResolution {
  const trace: string[] = [];
  const sources = input.sources ?? {};

  /* --- 0. Exact-match asset (manuel üretilmiş kombinasyon kaydı) — FAZ 3.1 --- */
  const exactAsset = resolveExactAsset(input.mood, input.genre, input.decade, input.releaseYear);
  if (exactAsset) {
    trace.push(
      `exact-match:${exactAsset.genre.toLowerCase()}-${exactAsset.decade.toLowerCase()}-${exactAsset.mood.toLowerCase()}`,
    );
  }

  /* --- 1. Backdrop: mood-only (genre/decade backdrop seçmez) --- */
  let backdropUrl: string | undefined;
  if (input.mood?.trim()) {
    backdropUrl = moodBackdropUrl(input.mood);
    trace.push(`backdrop:mood=${input.mood.trim()}`);
    if (sources.mood) trace.push(`backdrop.source=${sources.mood}`);
  } else {
    trace.push("backdrop:missing-mood->none");
  }

  /* --- 2. Scene theme: genre keyword → decade ladder → gothic --- */
  let sceneThemeId: SceneThemeId;
  const genreMatch = themeFromGenreKeyword(input.genre ?? null);
  if (genreMatch) {
    sceneThemeId = genreMatch;
    trace.push(`theme:genre=${input.genre?.trim()}->${sceneThemeId}`);
    if (sources.genre) trace.push(`theme.genre.source=${sources.genre}`);
  } else {
    sceneThemeId = decadeTheme(input.releaseYear, input.decade);
    trace.push(
      input.genre === undefined || input.genre === null
        ? "theme:missing-genre->decade-ladder"
        : `theme:genre-no-match->decade-ladder`,
    );
    if (sceneThemeId === "gothic") {
      trace.push("theme:decade-ladder->gothic-default");
    } else if (sources.decade) {
      trace.push(`theme.decade.source=${sources.decade}`);
    }
  }

  /* --- 3. Era: releaseYear varsa eraStyle + eraTheme --- */
  const year =
    input.releaseYear !== undefined && input.releaseYear !== null
      ? input.releaseYear
      : typeof input.decade === "string" && /^\d{4}s$/.test(input.decade)
        ? Number(input.decade.slice(0, 4))
        : null;

  let eraStyleId;
  let eraTheme;
  let palette = SCENE_PALETTES[sceneThemeId];

  if (year !== null && Number.isFinite(year)) {
    // ponytail: eraStyleFor cardIndex=0 — SceneRoom tek sahne kararı. Card-kontekstli
    // çağrı gelince (FAZ 4) cardIndex ayrıca parametre olarak eklenmeli. providerId boş:
    // eraStyle yalnız releaseYear+genre okur; title/artist/provider uydurulmaz.
    eraStyleId = eraStyleFor(
      {
        provider: "manual",
        providerId: "",
        title: "",
        artist: "",
        album: null,
        artworkUrl: null,
        isrc: null,
        genre: input.genre ?? null,
        releaseYear: year,
      },
      0,
    );
    eraTheme = eraThemeForYear(year).id;
    trace.push(`era:year=${year}->eraStyle+eraTheme`);
  } else {
    trace.push("era:missing-year->eraStyle/eraTheme-empty");
  }

  return {
    backdropUrl,
    sceneThemeId,
    palette,
    eraStyle: eraStyleId,
    eraTheme,
    exactAssetRef: exactAsset?.assetRef,
    fallbackTrace: trace,
  };
}

/** FAZ 4 öncesi tüketici için hazır nihai spec (fallbackTrace'siz). */
export function toSceneVisualSpec(resolution: SceneVisualResolution): SceneVisualSpec {
  return {
    backdropUrl: resolution.backdropUrl,
    sceneThemeId: resolution.sceneThemeId,
    palette: resolution.palette,
    eraStyle: resolution.eraStyle,
    eraTheme: resolution.eraTheme,
  };
}
