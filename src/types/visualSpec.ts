/**
 * FAZ 3 — VISUAL CONTRACT (canonical, 18 Eylül 2026).
 *
 * Üç katmanlı sözleşme: input (çözülecek) → resolution (çözülen) → spec (tüketici çıktısı).
 * Kanonik karara göre (STATE KARARLAR) mood+genre+decade üçü birlikte ve etkileşimli olarak
 * nihai görsel kimliği belirler. Bu dosya YALNIZCA tip/kontrattır; ıvır zıvır üretmez, LLM
 * çağırmaz, image üretmez. Çözüm mantığı `src/lib/visual/visualResolver.ts`'tedir.
 *
 * Uydurma yasağı (ANA_YASA §0): hiçbir eksen sentetik değerle doldurulmaz; eksik eksen
 * deterministik fallback'e iner ve `fallbackTrace`'e yazılır.
 */
import type { Mood } from "@/lib/ai/moodInference";
import type { ScenePalette, SceneThemeId } from "@/components/scene/scenePalettes";
import type { EraStyle } from "@/lib/soundmap/eraStyle";
import type { EraThemeId } from "@/lib/visual/eraThemes";

/**
 * Bir eksenin veri kaynağı/güveni. Mevcut repo tipleriyle uyumlu — yeni zırva alan üretmez,
 * yalnızca Resolver'ın deterministik karar amacıyla ekseni etiketler.
 */
export type VisualAxisSource = "provider" | "inferred" | "none";

/** Her eksenin varlık/kaynak bilgisi. */
export interface VisualAxisSourcing {
  mood: VisualAxisSource;
  genre: VisualAxisSource;
  decade: VisualAxisSource;
}

/** Resolver girdisi — çözülecek eksenler. Hepsi null-able (eksik eksen = deterministik düşüş). */
export interface SceneVisualSpecInput {
  /** Şarkının mood'u (Song.mood, moodInference). null → backdrop üretilmez. */
  mood?: Mood | string | null;
  /** Diagnostic genre — Song.genre VEYA MusicDNA.musicalIdentity.topGenres[0]. */
  genre?: string | null;
  /** Decade etiketi (ör. "1980s") — primaryEra veya releaseYear'den türetilmiş. */
  decade?: string | null;
  /** Sayısal çıkış yılı — eraStyle/eraTheme kararı için. */
  releaseYear?: number | null;
  /** Görsel karar için hangi ekseni nasıl kullandığımızı saklayan kaynak/güven. */
  sources?: Partial<VisualAxisSourcing>;
}

/**
 * Çözüm sonucu. `sceneThemeId` her zaman doludur (gothic fallback dahil); diğerleri
 * ilgili eksen verisi yoksa boştur. `fallbackTrace` deterministik sıradadır.
 */
export interface SceneVisualResolution {
  /** mood varsa backdrop (9 mood-backdrop glob), yoksa undefined. */
  backdropUrl?: string;
  /** Her zaman dolu: genre keyword → decade ladder → gothic. */
  sceneThemeId: SceneThemeId;
  /** scenePalettes[sceneThemeId] — mooddan bağımsız scene paleti. */
  palette?: ScenePalette;
  /** releaseYear varsa eraStyle (eraStyleFor), yoksa undefined. */
  eraStyle?: EraStyle;
  /** releaseYear varsa eraTheme (eraThemes), yoksa undefined. */
  eraTheme?: EraThemeId;
  /** Deterministik düşüş zinciri — debug/test için. */
  /** Manuel üretilmiş kombinasyondan gelen exact-match assetRef (eşleşme yoksa undefined). */
  exactAssetRef?: string;
  fallbackTrace: string[];
}

/**
 * Nihai tüketici çıktısı — SceneRoom/UI'ın kullanacağı sözleşme (FAZ 4 entegrasyon).
 * `visualSpec` için gerekli alanlar; fallbackTrace yalnızca karar düzeyindedir.
 */
export interface SceneVisualSpec {
  backdropUrl?: string;
  sceneThemeId: SceneThemeId;
  palette?: ScenePalette;
  eraStyle?: EraStyle;
  eraTheme?: EraThemeId;
}
