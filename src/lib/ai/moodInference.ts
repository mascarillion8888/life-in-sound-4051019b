/**
 * moodInference — LLM tabanlı mood çıkarımı (P1, metadata enrichment).
 *
 * KONTRAT:
 * - Deterministik: aynı girdi → aynı çıktı (server tarafında temperature 0).
 * - Çıktı, MOOD_SET'teki 9 kapalı mood'den BİRİ veya `null` olabilir — asla
 *   serbest metin üretmez.
 * - `null` = şarkı bilinmiyor / mood güvenilir şekilde çıkarılamıyor. LLM
 *   bilmiyorsa uydurmaz, null döner (ANA_YASA §0: uydurma yasak).
 * - Girdi, şarkının gerçek kimliğidir (title + artist + genre) — çıktı bu
 *   girdiden türetilir, sabit/rastgele değil.
 *
 * Bu modül client-safe'tir: gerçek LLM çağrısı `moodInference.server.ts`'teki
 * server fonksiyonunda yapılır (API key sızdırma yasağı, ANA_YASA §0) — burada
 * yalnızca ince bir sarmalayıcıdır (generatePoeticAnalysis deseni).
 *
 * STATE.md → KARARLAR (13 Eylül): Song'a mood değeri HER ZAMAN bu katmandan
 * gelir, UI'dan veya başka bir yerden doğrudan yazılmaz.
 */
import type { Song } from "@/lib/song/types";
import { inferMoodServer } from "./moodInference.server";

/** ANA_YASA §5.1'deki 9 kapalı mood seti. inferMood yalnızca bu kümeden döner. */
export const MOOD_SET = [
  "Energetic",
  "Euphoric",
  "Playful",
  "Romantic",
  "Melancholic",
  "Dreamy",
  "Nostalgic",
  "Dark",
  "World",
] as const;

export type Mood = (typeof MOOD_SET)[number];

/**
 * Bir şarkının mood'unu çıkarır.
 *
 * @param song - Şarkının gerçek kimliği (title + artist + genre).
 * @returns MOOD_SET'ten biri veya null (şarkı bilinmiyorsa / güvenilir çıkarım
 *   yoksa / LLM erişilemezse). Deterministik: aynı girdi her zaman aynı çıktıyı
 *   üretir.
 */
export async function inferMood(
  song: Pick<Song, "title" | "artist" | "genre">,
): Promise<string | null> {
  const result = await inferMoodServer({ data: song });
  return result?.mood ?? null;
}