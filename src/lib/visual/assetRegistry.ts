/**
 * FAZ 3.1 — Exact-Match Asset Registry (manuel üretilmiş kombinasyon kaydı).
 *
 * Kanonik karar (18 Eylül): görsel karar girdisi `Song {mood, genre, decade}`
 * bileşimidir; bu kayıt, kullanıcının MANUEL ÜRETTİĞİ kombinasyonları exact-match
 * olarak tanımlar. Runtime AI / GPT Image ÜRETİMİ YOKTUR (ANA_YASA §9,
 * §3 "runtime'da görsel üretilmez" — bu dosya sadece kayıt/seçimdir).
 *
 * Kayıt, GenreId × MOOD_SET çarpımından TÜRETİLİR (2026-10-10): 23 tür × 9 mood =
 * 207 satır, hepsi DÖNEMSİZ (decade yok → tüm yıllarda geçerli). `assetRef`
 * `<folder>/mood-backdrop-<mood>.jpg` biçimindedir; klasör adı GenreId ile aynıdır,
 * tek istisna `hiphop` → `hip-hop/` (klasör adı birleşik değil). Liste elle
 * bakımı yapılmaz — yeni tür eklemek için GenreId + GENRE_ALIASES yeterlidir.
 *
 * Bir kombinasyon burada kayıtlıysa ve girilen eksenlerle tam eşleşiyorsa,
 * `resolveExactAsset` onu döndürür → `SceneVisualResolution.exactAssetRef`
 * dolar ve `fallbackTrace`'e `exact-match:<genre>-<decade>-<mood>` izi düşer.
 * Bu ŞEFFAFLIK içindir; görsel davranışı değiştirmez (backdrop yine aynı mood
 * dosyasını gösterir).
 */
import type { Mood } from "@/lib/ai/moodInference";

/** Kanonik tür kimlikleri (küçük harf, normalleştirilmiş) — 23 tür. */
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
  | "acoustic"
  | "classical"
  | "country"
  | "folk"
  | "gospel"
  | "latin"
  | "rnb"
  | "soundtrack"
  | "timeless-opera"
  | "world";

/** 9 kapalı mood — MOOD_SET ile birebir. Registry satırları bu listeden türer. */
const REGISTRY_MOODS: readonly Mood[] = [
  "Energetic",
  "Euphoric",
  "Playful",
  "Romantic",
  "Melancholic",
  "Dreamy",
  "Nostalgic",
  "Dark",
  "World",
];

/** Kayıtlı 23 tür. assetRef bu listeden GenreId × REGISTRY_MOODS çarpımıyla üretilir. */
export const ALL_GENRES: readonly GenreId[] = [
  "pop",
  "punk",
  "metal",
  "rock",
  "hiphop",
  "jazz",
  "reggae",
  "soul",
  "funk",
  "new age",
  "synth",
  "gothic",
  "grunge",
  "acoustic",
  "classical",
  "country",
  "folk",
  "gospel",
  "latin",
  "rnb",
  "soundtrack",
  "timeless-opera",
  "world",
];

/** Klasör adı ≠ GenreId olan tek tür (asset dosyasının gerçek klasörü). */
const GENRE_FOLDER: Partial<Record<GenreId, string>> = {
  hiphop: "hip-hop",
  // diğer tüm GenreId'ler klasör adlarıyla aynıdır ("new age" boşluğu dahil).
};

/**
 * Genre etiketlerini kanonik `GenreId`'ye indirger (recorded provider'lar tek
 * isim üzerinde anlaşmaz: iTunes "R&B/Soul", "rhythm and blues" verirken
 * registry anahtarı "rnb"/"soul"dur). Bu normalizasyon exact-match'in gerçek
 * provider genre'sini kanonik kimlikle eşleyebilmesi içindir — yeni veri
 * UYDURMAZ, bilinen eşanlamlıları tek kimliğe götürür (ANA_YASA §0).
 *
 * 2026-10-10: 23 türün tamamı artık kendi klasörüne sahip. "R&B/Soul" gibi
 * hibritler soul'a, "neo soul"/"r&b" rnb'ye, "heavy metal" metal'e, "classical"
 * classical'a, "opera" timeless-opera'ya vb. gider (kullanıcı onaylı harita).
 *
 * Bilinmeyen/boş girdi aynen döner (küçük harf) — hiçbir değer uydurulmaz.
 */
export const GENRE_ALIASES: Record<string, GenreId> = {
  // rnb ailesi → rnb klasörü (2026-10-10; önceden soul'a iniyordu)
  "contemporary r&b": "rnb",
  "neo soul": "rnb",
  "quiet storm": "rnb",
  "r&b": "rnb",
  rb: "rnb",
  "rhythm & blues": "rnb",
  "rhythm and blues": "rnb",
  // soul ailesi → soul klasörü (hibritler soul kaynağı; rnb'ye DEĞİL)
  "funk/soul": "soul",
  "r&b/soul": "soul",
  "soul/funk": "soul",
  "soul/r&b": "soul",
  motown: "soul",
  stax: "soul",
  // hiphop ailesi → hiphop klasörü (hip-hop/)
  "hip-hop": "hiphop",
  "hip hop": "hiphop",
  "hip-hop/rap": "hiphop",
  "hip hop/rap": "hiphop",
  rap: "hiphop",
  trap: "hiphop",
  "gangsta rap": "hiphop",
  "conscious hip-hop": "hiphop",
  "old school rap": "hiphop",
  // synth ailesi → synth klasörü
  "synth-pop": "synth",
  "synth pop": "synth",
  "new wave": "synth",
  dance: "synth",
  disco: "synth",
  eurodance: "synth",
  trance: "synth",
  dubstep: "synth",
  "drum & bass": "synth",
  downtempo: "synth",
  "post-disco": "synth",
  "industrial dance": "synth",
  anime: "synth",
  "video game music": "synth",
  "fitness & workout": "synth",
  // latin ailesi → latin klasörü (2026-10-10; önceden synth'e iniyordu)
  latin: "latin",
  "urbano latino": "latin",
  "música mexicana": "latin",
  "regional mexican": "latin",
  salsa: "latin",
  bachata: "latin",
  merengue: "latin",
  cumbia: "latin",
  vallenato: "latin",
  tango: "latin",
  flamenco: "latin",
  brazilian: "latin",
  "bossa nova": "latin",
  samba: "latin",
  // metal ailesi → metal klasörü (2026-10-10; önceden rock'a iniyordu)
  metal: "metal",
  "heavy metal": "metal",
  "hard rock & metal": "metal",
  "hard rock and metal": "metal",
  "thrash metal": "metal",
  "death metal": "metal",
  "black metal": "metal",
  "progressive metal": "metal",
  "alternative metal": "metal",
  "nu metal": "metal",
  // rock ailesi → rock klasörü (hard rock dahil — metal değil)
  "hard rock": "rock",
  "classic rock": "rock",
  "rock & roll": "rock",
  "rock and roll": "rock",
  "arena rock": "rock",
  rockabilly: "rock",
  "german rock": "rock",
  "indie rock": "rock",
  "country rock": "rock",
  "folk rock": "rock",
  // punk ailesi → punk klasörü
  "pop punk": "punk",
  "hardcore punk": "punk",
  "post-punk": "punk",
  // gothic ailesi → gothic klasörü
  "gothic rock": "gothic",
  industrial: "gothic",
  // grunge
  alternative: "grunge",
  // funk ailesi → funk klasörü
  "p-funk": "funk",
  // jazz ailesi → jazz klasörü
  "smooth jazz": "jazz",
  "acid jazz": "jazz",
  "jazz fusion": "jazz",
  bebop: "jazz",
  swing: "jazz",
  "latin jazz": "jazz",
  "vocal jazz": "jazz",
  "big band": "jazz",
  "avant-garde jazz": "jazz",
  blues: "jazz",
  // reggae ailesi → reggae klasörü
  "dancehall": "reggae",
  ska: "reggae",
  reggaeton: "reggae",
  "roots reggae": "reggae",
  // new age ailesi → "new age" klasörü
  newage: "new age",
  "new-age": "new age",
  ambient: "new age",
  instrumental: "new age",
  meditation: "new age",
  holiday: "new age",
  // classical → kendi klasörü (2026-10-10; önceden "new age"'e iniyordu)
  classical: "classical",
  // opera → timeless-opera klasörü (2026-10-10)
  opera: "timeless-opera",
  // country ailesi → country klasörü (2026-10-10; önceden acoustic'e iniyordu)
  country: "country",
  americana: "country",
  bluegrass: "country",
  // folk ailesi → folk klasörü (2026-10-10; önceden acoustic'e iniyordu)
  folk: "folk",
  "contemporary folk": "folk",
  "traditional folk": "folk",
  celtic: "folk",
  "singer/songwriter": "acoustic",
  // world ailesi → world klasörü (2026-10-10; önceden acoustic'e iniyordu)
  world: "world",
  worldwide: "world",
  african: "world",
  afrobeat: "world",
  highlife: "world",
  juju: "world",
  rai: "world",
  indian: "world",
  bollywood: "world",
  // soundtrack ailesi → soundtrack klasörü (2026-10-10; önceden acoustic'e iniyordu)
  soundtrack: "soundtrack",
  score: "soundtrack",
  "musical theatre": "soundtrack",
  // gospel → kendi klasörü (2026-10-10; önceden soul'a iniyordu)
  gospel: "gospel",
  "christian & gospel": "gospel",
  // k-pop / j-pop / c-pop → pop
  "k-pop": "pop",
  "j-pop": "pop",
  "c-pop": "pop",
  "children's music": "pop",
  kids: "pop",
  // nötr / müzik-dışı → acoustic (güvenli varsayılan, kendi türü olmayan içerik)
  comedy: "acoustic",
  "spoken word": "acoustic",
  audiobook: "acoustic",
  poetry: "acoustic",
  education: "acoustic",
  religious: "acoustic",
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
   * (pop-1980s pilotu gibi dönemsel kayıtlar belirtir; mevcut 207 satırın
   * hiçbiri dönemsel değildir — hepsi tüm yıllarda geçerli.)
   */
  decade?: string;
  mood: Mood;
  /** Görsel dosya referansı — src/assets altındaki dosya yolu, örn. "pop/mood-backdrop-energetic.jpg". */
  assetRef: string;
}

/**
 * Kayıtlı kombinasyonlar — 23 genre × 9 mood = 207 satır, hepsi DÖNEMSİZ
 * (`decade` opsiyonel olduğundan atlanır → tüm yıllarda geçerli). `assetRef`
 * genre klasörü içindeki gerçek dosyayı gösterir:
 * `<folder>/mood-backdrop-<mood>.jpg` (klasör = GenreId, tek istisna
 * `hiphop` → `hip-hop/`). Tüm dosyalar src/assets altında 832×1248 (2:3).
 * Liste elle bakımı yapılmaz — GenreId × REGISTRY_MOODS çarpımından türer.
 */
export const SCENE_ASSET_REGISTRY: readonly SceneAssetEntry[] = ALL_GENRES.flatMap((genre) =>
  REGISTRY_MOODS.map((mood) => ({
    genre,
    mood,
    assetRef: `${GENRE_FOLDER[genre] ?? genre}/mood-backdrop-${mood.toLowerCase()}.jpg`,
  })),
);