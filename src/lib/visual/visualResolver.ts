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
import { sceneThemeForGenre } from "@/lib/art/sceneTheme";
import { eraStyleFor } from "@/lib/soundmap/eraStyle";
import { eraThemeForYear } from "@/lib/visual/eraThemes";
import type { Mood } from "@/lib/ai/moodInference";
import type {
  SceneVisualResolution,
  SceneVisualSpecInput,
  SceneVisualSpec,
} from "@/types/visualSpec";
import { normalizeGenre } from "./assetRegistry";
import {
  resolveBackdrop,
  backdropUrlByRef,
  type BackdropStrategy,
  type Decade,
} from "./backdropRegistry";

/**
 * Scene theme'ini genre keyword eşleşmesiyle bul. Mevcut SCENE_KEYWORDS matrisini kullanır —
 * yeni eşleme üretmez. Sıra: gothic, hiphop, grunge, soul, jazz, reggae, synth (SCENE_KEYWORDS
 * tanım sırası). Eşleşme yoksa undefined (çağırıcı decade ladder'a geçer).
 */
function themeFromGenreKeyword(genre: string | null): SceneThemeId | undefined {
  // Same explicit override map + SCENE_KEYWORDS as sceneThemeFor (render source), so
  // resolver.sceneThemeId and the rendered room theme never diverge.
  return sceneThemeForGenre(genre);
}

/**
 * Nötr fallback teması. Eski "yıldan tür tahmini" merdiveni (≤1969 jazz, ≤1979 soul,
 * ≤1989 synth, ≤1999 grunge, ≤2010 hiphop, aksi gothic) CALDIRILDI — bir yıl bir tür
 * tahmin edemez (1960s'ta country/rock/soul hepsi var; 2010+ "sadece gothic" değil).
 * Genre keyword eşleşmesi olmadığında her yıl için aynı nötr default'a (gothic) inilir.
 * Not: AYNI kırık mantık `sceneThemeFor`'un fallback'i `eraThemeFor`'da (sceneTheme.ts)
 * yaşıyor ve O render edilen kaynak (FAZ 4c KARAR B) — o ayrı, taksonomi işiyle birlikte
 * ele alınacak (bkz. HANDOFF). Parametreler çağrı uyumu için korunur.
 */
export function decadeTheme(
  _releaseYear: number | null | undefined,
  _decade: string | null | undefined,
): SceneThemeId {
  return "gothic";
}

/**
 * Dönem-farkında backdrop çözümü (FAZ 3.2). Kayıt artık `src/assets` altındaki
 * GERÇEK dosyalardan türetilir (bkz. backdropRegistry); dönem bir boyuttur.
 * `resolveBackdrop`'un ince sarmalayıcısıdır: provider genre'sini kanonik
 * kimliğe indirir ve her zaman bir çözüm döner (asla undefined değil, çünkü
 * global bir varsayılan vardır).
 */
export function resolveBackdropAsset(
  mood: Mood | string | null | undefined,
  genre: string | null | undefined,
  decade: string | null | undefined,
  releaseYear?: number | null,
) {
  return resolveBackdrop({
    mood: mood ?? null,
    genre: normalizeGenre(genre),
    decade: decade ?? null,
    releaseYear: releaseYear ?? null,
  });
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

  /* --- 0. Dönem-farkında backdrop kaydı (dosyadan türetilir) — FAZ 3.2 --- */
  const backdropMatch = input.mood?.trim()
    ? resolveBackdropAsset(input.mood, input.genre, input.decade, input.releaseYear)
    : null;
  if (backdropMatch?.assetRef) {
    trace.push(
      `backdrop-match:${backdropMatch.strategy}:${backdropMatch.assetRef}` +
        (backdropMatch.matchedDecade
          ? `:${backdropMatch.matchedDecade}${backdropMatch.exact ? ":exact" : ":approx"}`
          : ""),
    );
  }

  /* --- 1. Backdrop URL: dosyadan gelen çözüm → nötr mood-only yedek --- */
  let backdropUrl: string | undefined;
  if (input.mood?.trim()) {
    const matchedUrl = backdropUrlByRef(backdropMatch?.assetRef);
    if (matchedUrl) {
      backdropUrl = matchedUrl;
      trace.push(`backdrop:matched=${backdropMatch?.assetRef}`);
    } else {
      backdropUrl = moodBackdropUrl(input.mood, input.genre, input.decade);
      trace.push(`backdrop:mood=${input.mood.trim()}`);
    }
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
  const palette = SCENE_PALETTES[sceneThemeId];

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
    exactAssetRef: backdropMatch?.assetRef,
    matchedDecade: backdropMatch?.matchedDecade,
    backdropExact: backdropMatch?.exact,
    backdropStrategy: backdropMatch?.strategy,
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
