/**
 * FAZ 3.1 — Asset taxonomy (GenreId kümesi + genre eşanlamlı normalizasyonu).
 *
 * Kanonik karar (18 Eylül): görsel karar girdisi `Song {mood, genre, decade}`
 * bileşimidir. Bu dosya YALNIZCA taksonomiyi tutar: 23 `GenreId`, `GENRE_ALIASES`
 * (provider etiketlerini kanonik kimliğe indirger), klasör eşlemesi
 * (`hiphop` → `hip-hop/`) ve `normalizeGenre`. Runtime AI / görsel üretimi
 * YOKTUR (ANA_YASA §9).
 *
 * Backdrop KAYDI artık burada DEĞİL: `src/assets` altındaki GERÇEK dosyalardan
 * türetilir ve DÖNEM boyutunu taşır (FAZ 3.2, 2026-11-11) → bkz.
 * `./backdropRegistry` (`BACKDROP_REGISTRY`, `resolveBackdrop`). Eski elle
 * türetilmiş dönemsiz `SCENE_ASSET_REGISTRY` KALDIRILDI; tek kaynak dosyalardır
 * (docs/ASSETS.md).
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

/**
 * 9 kapalı mood — MOOD_SET ile birebir (aynı değer/sıra). Mood "yakınlığı"
 * (bkz. backdropRegistry) bu kanonik sırayı kullanır. Değeri `moodInference`'dan
 * İMPORT ETMEYİZ: o modül `moodInference.server`'ı çeker; burada saf bir kopya
 * tutmak client bundle'ına server fonksiyonu sokmaz.
 */
export const REGISTRY_MOODS: readonly Mood[] = [
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
export const GENRE_FOLDER: Partial<Record<GenreId, string>> = {
  hiphop: "hip-hop",
  // diğer tüm GenreId'ler klasör adlarıyla aynıdır ("new age" boşluğu dahil).
};

/** GenreId → asset klasör adı (GENRE_FOLDER override'ı uygulanmış). */
export function genreFolder(genre: string): string {
  return GENRE_FOLDER[genre as GenreId] ?? genre;
}

/** Asset klasör adı → kanonik GenreId (GENRE_FOLDER'ın tersi). Bilinmeyen aynen döner. */
const FOLDER_TO_GENRE: Record<string, string> = Object.fromEntries(
  ALL_GENRES.map((g) => [genreFolder(g), g]),
);

export function genreFromFolder(folder: string): string {
  return FOLDER_TO_GENRE[folder] ?? folder;
}

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
  dancehall: "reggae",
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
