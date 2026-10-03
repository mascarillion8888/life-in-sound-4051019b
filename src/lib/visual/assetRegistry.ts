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
  | "funk"
  | "new age"
  | "synth"
  | "gothic"
  | "grunge"
  | "acoustic";

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
  "funk/soul": "soul",
  motown: "soul",
  stax: "soul",
  "hip-hop": "hiphop",
    "hip hop": "hiphop",
    "hip-hop/rap": "hiphop",
    "hip hop/rap": "hiphop",
    rap: "hiphop",
    "synth-pop": "synth",
      "synth pop": "synth",
      "new wave": "synth",
      "dance": "synth",
      "disco": "synth",
      "eurodance": "synth",
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
  // funk ailesi → funk klasörü (2026-09-30)
  // Not: "soul/funk" ve "funk/soul" hibritleri soul'a iner (her ikisi de soul
  // kaynağıdır) — burada funk'a çevirme. Doğrudan "funk" kimliği zaten musicDNA
  // normalizasyonundan gelir.
  "p-funk": "funk",
  // new age ailesi → new age klasörü (2026-09-30)
  "newage": "new age",
  "new-age": "new age",
  "ambient": "new age",
  // jazz ailesi → jazz klasörü (2026-09-30)
  "smooth jazz": "jazz",
  "acid jazz": "jazz",
  "jazz fusion": "jazz",
  "bebop": "jazz",
  "swing": "jazz",
  // reggae ailesi → reggae klasörü (2026-09-30)
    "dancehall": "reggae",
    "ska": "reggae",
    "reggaeton": "reggae",
    "roots reggae": "reggae",
    // country/folk/acoustic ailesi → acoustic (registry'de acoustic klasörü YOK; fallback acoustic theme/keyword)
    "country": "acoustic",
    "folk": "acoustic",
    "americana": "acoustic",
    "bluegrass": "acoustic",
    "singer/songwriter": "acoustic",
    "contemporary folk": "acoustic",
    "traditional folk": "acoustic",
    "celtic": "acoustic",
    // classical/instrumental/new age ailesi → new age (registry'de new age klasörü VAR)
    "classical": "new age",
    "opera": "new age",
    "instrumental": "new age",
    "meditation": "new age",
    "holiday": "new age",
    // latin ailesi → synth (registry'de latin klasörü YOK; synth fallback - latin pop/dance synth keyword'lere uygun)
    "latin": "synth",
    "urbano latino": "synth",
    "música mexicana": "synth",
    "regional mexican": "synth",
    "salsa": "synth",
    "bachata": "synth",
    "merengue": "synth",
    "cumbia": "synth",
    "vallenato": "synth",
    "tango": "synth",
    "flamenco": "synth",
    "brazilian": "synth",
    "bossa nova": "synth",
    "samba": "synth",
    // world/wide ailesi → acoustic (registry'de world klasörü YOK; acoustic fallback)
    "world": "acoustic",
    "worldwide": "acoustic",
    "african": "acoustic",
    "afrobeat": "acoustic",
    "highlife": "acoustic",
    "juju": "acoustic",
    "rai": "acoustic",
    "indian": "acoustic",
    "bollywood": "acoustic",
    // k-pop / j-pop / c-pop → pop (registry'de pop klasörü VAR)
    "k-pop": "pop",
    "j-pop": "pop",
    "c-pop": "pop",
    // soundtrack/score/musical theatre → acoustic (context'e göre değişir, güvenli varsayılan)
    "soundtrack": "acoustic",
    "score": "acoustic",
    "musical theatre": "acoustic",
    // electronic sub-genres → synth (registry'de synth klasörü YOK; synth keyword fallback)
    "trance": "synth",
    "dubstep": "synth",
    "drum & bass": "synth",
    "downtempo": "synth",
    "post-disco": "synth",
    "industrial dance": "synth",
    // rock/metal alt türleri → rock (registry'de rock klasörü VAR)
    "thrash metal": "rock",
    "death metal": "rock",
    "black metal": "rock",
    "progressive metal": "rock",
    "alternative metal": "rock",
    "nu metal": "rock",
    "pop punk": "punk",
    "hardcore punk": "punk",
    "post-punk": "punk",
    "indie rock": "rock",
    "gothic rock": "gothic",
    "industrial": "gothic",
    // hip-hop alt türleri → hiphop
    "trap": "hiphop",
    "gangsta rap": "hiphop",
    "conscious hip-hop": "hiphop",
    "old school rap": "hiphop",
    // jazz alt türleri → jazz
    "latin jazz": "jazz",
    "vocal jazz": "jazz",
    "big band": "jazz",
    "avant-garde jazz": "jazz",
    // r&b/soul alt türleri → soul
        "neo soul": "soul",
        "contemporary r&b": "soul",
        "quiet storm": "soul",
        // alternative → grunge (SCENE_KEYWORDS grunge keywords include "alternative")
        "alternative": "grunge",
        // blues → jazz (blues keyword jazz'de; soul'da da var ama jazz önce gelsin - SCENE_KEYWORDS sırası düzeltilecek)
    "blues": "jazz",
    // country/folk rock → rock
    "country rock": "rock",
    "folk rock": "rock",
    // other / special → acoustic fallback
    "comedy": "acoustic",
    "spoken word": "acoustic",
    "audiobook": "acoustic",
    "poetry": "acoustic",
    "children's music": "pop",
    "kids": "pop",
    "education": "acoustic",
    "religious": "acoustic",
    "christian & gospel": "acoustic",
    "gospel": "soul",
    "anime": "synth",
    "video game music": "synth",
    "fitness & workout": "synth",
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
 * Dokuz genre (pop, punk, rock, soul, funk, hiphop, jazz, "new age", reggae) ×
 * 9 mood = 81 satır — hepsi DÖNEMSİZ (`decade` opsiyonel olduğundan atlanır →
 * tüm yıllarda geçerli). `assetRef` artık genre klasörü içindeki gerçek dosyayı
 * gösterir: `<genre>/mood-backdrop-<mood>.jpg` (2026-09-29 restructure;
 * hiphop/new-age klasör adı sırasıyla `hip-hop/` ve `new age/`).
 * Bu dokuz genre dışındaki (metal/synth/gothic/grunge/…) kayıt YOKTUR —
 * `resolveExactAsset` eşleşme bulamaz → moodBackdropUrl'nin nötr fallback'i
 * devreye girer (pop klasörü, ANA_YASA §0 — hiçbir görsel uydurulmaz, yalnız
 * gerçek asset geri kullanılır). Not: metal/rock ailesi GENRE_ALIASES ile
 * "rock"a iner, dolayısıyla metal etiketleri de rock klasörünü kullanır.
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
  // funk × 9 (dönemsiz; klasör funk/)
  { genre: "funk", mood: "Energetic", assetRef: "funk/mood-backdrop-energetic.jpg" },
  { genre: "funk", mood: "Euphoric", assetRef: "funk/mood-backdrop-euphoric.jpg" },
  { genre: "funk", mood: "Playful", assetRef: "funk/mood-backdrop-playful.jpg" },
  { genre: "funk", mood: "Romantic", assetRef: "funk/mood-backdrop-romantic.jpg" },
  { genre: "funk", mood: "Melancholic", assetRef: "funk/mood-backdrop-melancholic.jpg" },
  { genre: "funk", mood: "Dreamy", assetRef: "funk/mood-backdrop-dreamy.jpg" },
  { genre: "funk", mood: "Nostalgic", assetRef: "funk/mood-backdrop-nostalgic.jpg" },
  { genre: "funk", mood: "Dark", assetRef: "funk/mood-backdrop-dark.jpg" },
  { genre: "funk", mood: "World", assetRef: "funk/mood-backdrop-world.jpg" },
  // hiphop × 9 (dönemsiz; klasör hip-hop/)
  { genre: "hiphop", mood: "Energetic", assetRef: "hip-hop/mood-backdrop-energetic.jpg" },
  { genre: "hiphop", mood: "Euphoric", assetRef: "hip-hop/mood-backdrop-euphoric.jpg" },
  { genre: "hiphop", mood: "Playful", assetRef: "hip-hop/mood-backdrop-playful.jpg" },
  { genre: "hiphop", mood: "Romantic", assetRef: "hip-hop/mood-backdrop-romantic.jpg" },
  { genre: "hiphop", mood: "Melancholic", assetRef: "hip-hop/mood-backdrop-melancholic.jpg" },
  { genre: "hiphop", mood: "Dreamy", assetRef: "hip-hop/mood-backdrop-dreamy.jpg" },
  { genre: "hiphop", mood: "Nostalgic", assetRef: "hip-hop/mood-backdrop-nostalgic.jpg" },
  { genre: "hiphop", mood: "Dark", assetRef: "hip-hop/mood-backdrop-dark.jpg" },
  { genre: "hiphop", mood: "World", assetRef: "hip-hop/mood-backdrop-world.jpg" },
  // jazz × 9 (dönemsiz; klasör jazz/)
  { genre: "jazz", mood: "Energetic", assetRef: "jazz/mood-backdrop-energetic.jpg" },
  { genre: "jazz", mood: "Euphoric", assetRef: "jazz/mood-backdrop-euphoric.jpg" },
  { genre: "jazz", mood: "Playful", assetRef: "jazz/mood-backdrop-playful.jpg" },
  { genre: "jazz", mood: "Romantic", assetRef: "jazz/mood-backdrop-romantic.jpg" },
  { genre: "jazz", mood: "Melancholic", assetRef: "jazz/mood-backdrop-melancholic.jpg" },
  { genre: "jazz", mood: "Dreamy", assetRef: "jazz/mood-backdrop-dreamy.jpg" },
  { genre: "jazz", mood: "Nostalgic", assetRef: "jazz/mood-backdrop-nostalgic.jpg" },
  { genre: "jazz", mood: "Dark", assetRef: "jazz/mood-backdrop-dark.jpg" },
  { genre: "jazz", mood: "World", assetRef: "jazz/mood-backdrop-world.jpg" },
  // new age × 9 (dönemsiz; klasör new age/)
  { genre: "new age", mood: "Energetic", assetRef: "new age/mood-backdrop-energetic.jpg" },
  { genre: "new age", mood: "Euphoric", assetRef: "new age/mood-backdrop-euphoric.jpg" },
  { genre: "new age", mood: "Playful", assetRef: "new age/mood-backdrop-playful.jpg" },
  { genre: "new age", mood: "Romantic", assetRef: "new age/mood-backdrop-romantic.jpg" },
  { genre: "new age", mood: "Melancholic", assetRef: "new age/mood-backdrop-melancholic.jpg" },
  { genre: "new age", mood: "Dreamy", assetRef: "new age/mood-backdrop-dreamy.jpg" },
  { genre: "new age", mood: "Nostalgic", assetRef: "new age/mood-backdrop-nostalgic.jpg" },
  { genre: "new age", mood: "Dark", assetRef: "new age/mood-backdrop-dark.jpg" },
  { genre: "new age", mood: "World", assetRef: "new age/mood-backdrop-world.jpg" },
  // reggae × 9 (dönemsiz; klasör reggae/)
  { genre: "reggae", mood: "Energetic", assetRef: "reggae/mood-backdrop-energetic.jpg" },
  { genre: "reggae", mood: "Euphoric", assetRef: "reggae/mood-backdrop-euphoric.jpg" },
  { genre: "reggae", mood: "Playful", assetRef: "reggae/mood-backdrop-playful.jpg" },
  { genre: "reggae", mood: "Romantic", assetRef: "reggae/mood-backdrop-romantic.jpg" },
  { genre: "reggae", mood: "Melancholic", assetRef: "reggae/mood-backdrop-melancholic.jpg" },
  { genre: "reggae", mood: "Dreamy", assetRef: "reggae/mood-backdrop-dreamy.jpg" },
  { genre: "reggae", mood: "Nostalgic", assetRef: "reggae/mood-backdrop-nostalgic.jpg" },
  { genre: "reggae", mood: "Dark", assetRef: "reggae/mood-backdrop-dark.jpg" },
  { genre: "reggae", mood: "World", assetRef: "reggae/mood-backdrop-world.jpg" },
];
