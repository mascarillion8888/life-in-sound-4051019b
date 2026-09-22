/**
 * FAZ 3.1 — Exact-Match Asset Registry (manuel üretilmiş kombinasyon kaydı).
 *
 * Kanonik karar (18 Eylül): görsel karar girdisi `Song {mood, genre, decade}`
 * bileşimidir; bu kayıt, kullanıcının MANUEL ÜRETTİĞİ kombinasyonları exact-match
 * olarak tanımlar. Runtime AI / GPT Image ÜRETİMİ YOKTUR (ANA_YASA §9,
 * §3 "runtime'da görsel üretilmez" — bu dosya sadece kayıt/seçimdir).
 *
 * İlk sürüm: `1980s × Pop × 9 mood` pilot universe'i için 9 satır. Mevcut
 * `mood-backdrop-*.png` dosyaları, bu kombinasyona özel exact-match asset'leri
 * olarak kaydedilir. Diğer tüm genre/decade kombinasyonları için kayıt BOŞTUR;
 * kullanıcı yeni kombinasyon ürettikçe bu listeye MANUEL eklenir.
 *
 * Bir kombinasyon burada kayıtlıysa ve girilen eksenlerle tam eşleşiyorsa,
 * `resolveExactAsset` onu döndürür → `SceneVisualResolution.exactAssetRef`
 * dolar ve `fallbackTrace`'e `exact-match:<genre>-<decade>-<mood>` izi düşer.
 * Bu ŞEFFAFLIK içindir; görsel davranışı değiştirmez (backdrop yine aynı mood
 * dosyasını gösterir).
 */
import type { Mood } from "@/lib/ai/moodInference";

/** Kanonik tür kimlikleri (küçük harf, normalleştirilmiş). */
export type GenreId =
  "pop" | "metal" | "rock" | "hiphop" | "jazz" | "reggae" | "soul" | "synth" | "gothic" | "grunge";

/** Manuel üretilmiş bir kombinasyonun kaydı. */
export interface SceneAssetEntry {
  genre: GenreId;
  /**
   * Decade etiketi, örn. "1980s". OPSİYONEL: yoksa kayıt dönemsizdir (tür+mood
   * tüm dönemlerde geçerli) — `resolveExactAsset` decade koşulunu yoksayar.
   * (pop-1980s pilotu gibi dönemsel kayıtlar belirtir; soul gibi dönemsiz
   * kayıtlar hiç yazmaz.)
   */
  decade?: string;
  mood: Mood;
  /** Görsel dosya referansı — src/assets altındaki dosya adı, örn. "mood-backdrop-energetic.png". */
  assetRef: string;
}

/**
 * Kayıtlı (üretilmiş) kombinasyonlar.
 * Pilot `1980s × Pop × 9 mood` (dönemsel) + dönemsiz `Soul × 9 mood` (tüm
 * dönemlerde geçerli — `decade` opsiyonel olduğundan atlanır). Boş kalan
 * eksenlerde `resolveExactAsset` eşleşme bulamaz → mevcut FAZ 3 davranışı
 * aynen korunur.
 */
export const SCENE_ASSET_REGISTRY: SceneAssetEntry[] = [
  { genre: "pop", decade: "1980s", mood: "Energetic", assetRef: "mood-backdrop-energetic.png" },
  { genre: "pop", decade: "1980s", mood: "Euphoric", assetRef: "mood-backdrop-euphoric.png" },
  { genre: "pop", decade: "1980s", mood: "Playful", assetRef: "mood-backdrop-playful.png" },
  { genre: "pop", decade: "1980s", mood: "Romantic", assetRef: "mood-backdrop-romantic.png" },
  { genre: "pop", decade: "1980s", mood: "Melancholic", assetRef: "mood-backdrop-melancholic.png" },
  { genre: "pop", decade: "1980s", mood: "Dreamy", assetRef: "mood-backdrop-dreamy.png" },
  { genre: "pop", decade: "1980s", mood: "Nostalgic", assetRef: "mood-backdrop-nostalgic.png" },
  { genre: "pop", decade: "1980s", mood: "Dark", assetRef: "mood-backdrop-dark.png" },
  { genre: "pop", decade: "1980s", mood: "World", assetRef: "mood-backdrop-world.png" },
  { genre: "soul", mood: "Energetic", assetRef: "backdrop-soul-energetic.png" },
  { genre: "soul", mood: "Euphoric", assetRef: "backdrop-soul-euphoric.png" },
  { genre: "soul", mood: "Playful", assetRef: "backdrop-soul-playful.png" },
  { genre: "soul", mood: "Romantic", assetRef: "backdrop-soul-romantic.png" },
  { genre: "soul", mood: "Melancholic", assetRef: "backdrop-soul-melancholic.png" },
  { genre: "soul", mood: "Dreamy", assetRef: "backdrop-soul-dreamy.png" },
  { genre: "soul", mood: "Nostalgic", assetRef: "backdrop-soul-nostalgic.png" },
  { genre: "soul", mood: "Dark", assetRef: "backdrop-soul-dark.png" },
  { genre: "soul", mood: "World", assetRef: "backdrop-soul-world.png" },
];
