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
  | "pop"
  | "punk"
  | "metal"
  | "rock"
  | "hiphop"
  | "jazz"
  | "reggae"
  | "soul"
  | "synth"
  | "gothic"
  | "grunge";

/**
 * Genre etiketlerini kanonik `GenreId`'ye indirger (recorded provider'lar tek
 * isim üzerinde anlaşmaz: iTunes "R&B/Soul", "rhythm and blues" verirken
 * registry anahtarı "soul"dur). Bu normalizasyon exact-match'in gerçek
 * provider genre'sini kanonik kimlikle eşleyebilmesi içindir — yeni veri
 * UYDURMAZ, bilinen eşanlamlıları tek kimliğe götürür (ANA_YASA §0).
 *
 * Bilinmeyen/boş girdi aynen döner (küçük harf) — hiçbir değer uydurulmaz.
 */
export const GENRE_ALIASES: Record<string, GenreId> = {
  "r&b": "soul",
  "r&b/soul": "soul",
  "soul/r&b": "soul",
  rb: "soul",
  "rhythm and blues": "soul",
  "rhythm & blues": "soul",
  "soul/funk": "soul",
  motown: "soul",
  stax: "soul",
  "hip-hop": "hiphop",
  "hip hop": "hiphop",
  rap: "hiphop",
  "synth-pop": "synth",
  "synth pop": "synth",
  "new wave": "synth",
  "hard rock": "rock",
  "heavy metal": "rock",
  metal: "rock",
  "hard rock & metal": "rock",
  "hard rock and metal": "rock",
  "classic rock": "rock",
  "rock & roll": "rock",
  "rock and roll": "rock",
  "arena rock": "rock",
  rockabilly: "rock",
  "german rock": "rock",
};

/** null/boş'a güvenli kanonik genre kimliği. Eşleşme yoksa küçük-harfli orijinal. */
export function normalizeGenre(genre: string | null | undefined): string | null {
  if (!genre || typeof genre !== "string") return null;
  const key = genre.trim().toLowerCase();
  if (key.length === 0) return null;
  return GENRE_ALIASES[key] ?? key;
}

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
 * Dört genre (pop, punk, rock, soul) × 9 mood = 36 satır — hepsi DÖNEMSİZ
 * (`decade` opsiyonel olduğundan atlanır → tüm yıllarda geçerli). `assetRef`
 * artık genre klasörü içindeki gerçek dosyayı gösterir:
 * `<genre>/mood-backdrop-<mood>.jpg` (2026-09-29 restructure).
 * Bu dört genre dışındaki (metal/jazz/hiphop/…) kayıt YOKTUR — `resolveExactAsset`
 * eşleşme bulamaz → moodBackdropUrl'nin nötr fallback'i devreye girer (pop klasörü,
 * ANA_YASA §0 — hiçbir görsel uydurulmaz, yalnız gerçek asset geri kullanılır).
 */
export const SCENE_ASSET_REGISTRY: SceneAssetEntry[] = [
  // pop × 9 (dönemsiz; klasör pop/)
  { genre: "pop", mood: "Energetic", assetRef: "pop/mood-backdrop-energetic.jpg" },
  { genre: "pop", mood: "Euphoric", assetRef: "pop/mood-backdrop-euphoric.jpg" },
  { genre: "pop", mood: "Playful", assetRef: "pop/mood-backdrop-playful.jpg" },
  { genre: "pop", mood: "Romantic", assetRef: "pop/mood-backdrop-romantic.jpg" },
  { genre: "pop", mood: "Melancholic", assetRef: "pop/mood-backdrop-melancholic.jpg" },
  { genre: "pop", mood: "Dreamy", assetRef: "pop/mood-backdrop-dreamy.jpg" },
  { genre: "pop", mood: "Nostalgic", assetRef: "pop/mood-backdrop-nostalgic.jpg" },
  { genre: "pop", mood: "Dark", assetRef: "pop/mood-backdrop-dark.jpg" },
  { genre: "pop", mood: "World", assetRef: "pop/mood-backdrop-world.jpg" },
  // punk × 9
  { genre: "punk", mood: "Energetic", assetRef: "punk/mood-backdrop-energetic.jpg" },
  { genre: "punk", mood: "Euphoric", assetRef: "punk/mood-backdrop-euphoric.jpg" },
  { genre: "punk", mood: "Playful", assetRef: "punk/mood-backdrop-playful.jpg" },
  { genre: "punk", mood: "Romantic", assetRef: "punk/mood-backdrop-romantic.jpg" },
  { genre: "punk", mood: "Melancholic", assetRef: "punk/mood-backdrop-melancholic.jpg" },
  { genre: "punk", mood: "Dreamy", assetRef: "punk/mood-backdrop-dreamy.jpg" },
  { genre: "punk", mood: "Nostalgic", assetRef: "punk/mood-backdrop-nostalgic.jpg" },
  { genre: "punk", mood: "Dark", assetRef: "punk/mood-backdrop-dark.jpg" },
  { genre: "punk", mood: "World", assetRef: "punk/mood-backdrop-world.jpg" },
  // rock × 9
  { genre: "rock", mood: "Energetic", assetRef: "rock/mood-backdrop-energetic.jpg" },
  { genre: "rock", mood: "Euphoric", assetRef: "rock/mood-backdrop-euphoric.jpg" },
  { genre: "rock", mood: "Playful", assetRef: "rock/mood-backdrop-playful.jpg" },
  { genre: "rock", mood: "Romantic", assetRef: "rock/mood-backdrop-romantic.jpg" },
  { genre: "rock", mood: "Melancholic", assetRef: "rock/mood-backdrop-melancholic.jpg" },
  { genre: "rock", mood: "Dreamy", assetRef: "rock/mood-backdrop-dreamy.jpg" },
  { genre: "rock", mood: "Nostalgic", assetRef: "rock/mood-backdrop-nostalgic.jpg" },
  { genre: "rock", mood: "Dark", assetRef: "rock/mood-backdrop-dark.jpg" },
  { genre: "rock", mood: "World", assetRef: "rock/mood-backdrop-world.jpg" },
  // soul × 9
  { genre: "soul", mood: "Energetic", assetRef: "soul/mood-backdrop-energetic.jpg" },
  { genre: "soul", mood: "Euphoric", assetRef: "soul/mood-backdrop-euphoric.jpg" },
  { genre: "soul", mood: "Playful", assetRef: "soul/mood-backdrop-playful.jpg" },
  { genre: "soul", mood: "Romantic", assetRef: "soul/mood-backdrop-romantic.jpg" },
  { genre: "soul", mood: "Melancholic", assetRef: "soul/mood-backdrop-melancholic.jpg" },
  { genre: "soul", mood: "Dreamy", assetRef: "soul/mood-backdrop-dreamy.jpg" },
  { genre: "soul", mood: "Nostalgic", assetRef: "soul/mood-backdrop-nostalgic.jpg" },
  { genre: "soul", mood: "Dark", assetRef: "soul/mood-backdrop-dark.jpg" },
  { genre: "soul", mood: "World", assetRef: "soul/mood-backdrop-world.jpg" },
];
