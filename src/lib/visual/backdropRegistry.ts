/**
 * FAZ 3.2 — Decade-aware backdrop registry (DOSYADAN türetilir, elle liste YOK).
 *
 * Sorun (2026-11-11): kayıt yalnızca (genre, mood) eksenini çözüyordu ve tüm
 * mevcut dosyalar dönemsizdi → 1960s/70s/90s şarkılar da 1980s backdrop'ı
 * gösteriyordu. Çözüm: kayıt artık `src/assets` altındaki GERÇEK dosyalardan
 * (`import.meta.glob`) türetilir ve her satır bir DÖNEM taşır.
 *
 * Dosya adı sözleşmesi (docs/ASSETS.md):
 *   - Eski (dönemsiz) dosyalar: `<klasör>/mood-backdrop-<mood>.jpg` → **1980s** sayılır.
 *   - Yeni dönemli dosyalar:    `{genre}-{mood}-{decade}.{jpg,webp}` (örn.
 *     `rock-melancholic-1970s.webp`). Dosya `src/assets/<klasör>/` içine ya da
 *     doğrudan `src/assets/` köküne konabilir.
 *
 * Runtime AI / görsel üretimi YOKTUR (ANA_YASA §9); bu modül yalnızca seçimdir.
 * Saf çözüm fonksiyonu (`resolveBackdrop`) enjekte edilebilir kayıt alır → birim
 * testte sentetik kayıtla deterministik doğrulanır; kayıt BOŞ olsa bile ASLA
 * throw etmez, her zaman bir varsayılana iner.
 */
import { ALL_GENRES, REGISTRY_MOODS, genreFolder, genreFromFolder } from "./assetRegistry";

/** Desteklenen dönemler (artan sıra). Bu aralığın dışı en yakına kelepçelenir. */
export const DECADES = ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"] as const;

export type Decade = (typeof DECADES)[number];

/** Dönemsiz (eski) dosyaların sayıldığı varsayılan dönem. */
export const LEGACY_DECADE: Decade = "1980s";

/** Kayıtlı bir backdrop kombinasyonu. `assetRef` src/assets'e GÖRELİ yoldur. */
export interface BackdropEntry {
  genre: string;
  mood: string;
  decade: Decade;
  assetRef: string;
}

/** Çözüm stratejisi (fallback sırası). `none` yalnız kayıt boşken görülür. */
export type BackdropStrategy = "exact" | "mood" | "decade" | "genre-decade" | "default";

export interface BackdropResolution {
  /** Seçilen dosyanın src/assets'e göreli yolu (varsayılan dahil her zaman dolu). */
  assetRef?: string;
  genre?: string;
  mood?: string;
  /** Eşleşen kaydın dönemi. */
  matchedDecade?: Decade;
  /**
   * Eşleşen dönem, İSTENEN döneme tam eşit mi? false ise bir sonraki PR bir
   * dönem renk/grain katmanı uygulayabilir (bu PR katmanı UYGULAMAZ).
   */
  exact: boolean;
  strategy: BackdropStrategy;
}

const DECADE_INDEX: Record<Decade, number> = Object.fromEntries(
  DECADES.map((d, i) => [d, i]),
) as Record<Decade, number>;

const MOOD_INDEX: Record<string, number> = Object.fromEntries(
  REGISTRY_MOODS.map((m, i) => [m.toLowerCase(), i]),
);

/** Yıl → dönem, aralık dışı en yakına kelepçelenir (1955→1960s, 2035→2020s). */
export function decadeForYear(year: number): Decade {
  if (!Number.isFinite(year)) return LEGACY_DECADE;
  const base = Math.floor(year / 10) * 10;
  if (base <= 1960) return "1960s";
  if (base >= 2020) return "2020s";
  return `${base}s` as Decade;
}

/** "1970s" | "1970" | 1970 → Decade; çözülemezse null (uydurma yok). */
export function normalizeDecade(input: string | number | null | undefined): Decade | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? decadeForYear(input) : null;
  const match = /^(\d{4})s?$/.exec(input.trim().toLowerCase());
  return match ? decadeForYear(Number(match[1])) : null;
}

/** İstenen dönem: önce decade etiketi, yoksa releaseYear, yoksa null. */
export function decadeOf(
  decade: string | null | undefined,
  releaseYear: number | null | undefined,
): Decade | null {
  const fromLabel = normalizeDecade(decade);
  if (fromLabel) return fromLabel;
  return typeof releaseYear === "number" && Number.isFinite(releaseYear)
    ? decadeForYear(releaseYear)
    : null;
}

function moodIndex(mood: string | null | undefined): number {
  if (!mood) return -1;
  const i = MOOD_INDEX[mood.trim().toLowerCase()];
  return i === undefined ? -1 : i;
}

/** Dosya-adı genre token'ını kanonik GenreId'ye indirger; bilinmeyen → null. */
function genreTokenToId(token: string): string | null {
  const lower = token.trim().toLowerCase();
  if (!lower) return null;
  const candidates = [lower, lower.replace(/-/g, " "), lower.replace(/ /g, "-")];
  for (const c of candidates) {
    const byId = ALL_GENRES.find((g) => g === c);
    if (byId) return byId;
    const byFolder = ALL_GENRES.find((g) => genreFolder(g) === c);
    if (byFolder) return byFolder;
  }
  return null;
}

/**
 * Bir glob anahtarını (`../../assets/...`) kayıt satırına çevirir. Tanınmayan
 * dosya adı → null (uydurma kayıt yok).
 */
export function parseBackdropFile(moduleKey: string): BackdropEntry | null {
  const marker = "assets/";
  const idx = moduleKey.indexOf(marker);
  if (idx < 0) return null;
  const assetRef = moduleKey.slice(idx + marker.length);
  const slash = assetRef.lastIndexOf("/");
  const folder = slash >= 0 ? assetRef.slice(0, slash) : "";
  const filename = (slash >= 0 ? assetRef.slice(slash + 1) : assetRef).replace(/\.[^.]+$/, "");

  // Eski biçim: mood-backdrop-<mood> (klasör = genre, dönem = 1980s).
  const legacy = /^mood-backdrop-(.+)$/.exec(filename);
  if (legacy) {
    const mood = REGISTRY_MOODS.find((m) => m.toLowerCase() === legacy[1].toLowerCase());
    const genre = genreFromFolder(folder);
    if (!mood || !folder || !ALL_GENRES.includes(genre as (typeof ALL_GENRES)[number])) return null;
    return { genre, mood, decade: LEGACY_DECADE, assetRef };
  }

  // Yeni biçim: {genre}-{mood}-{decade} (veya {genre}-{mood} → 1980s).
  const parts = filename.split("-");
  const last = parts[parts.length - 1]?.toLowerCase();
  const decade = DECADES.includes(last as Decade) ? (last as Decade) : null;
  if (decade) parts.pop();
  const moodSlug = parts[parts.length - 1]?.toLowerCase();
  const mood = REGISTRY_MOODS.find((m) => m.toLowerCase() === moodSlug);
  if (!mood) return null;
  parts.pop();
  const genre = genreTokenToId(parts.join("-"));
  if (!genre) return null;
  return { genre, mood, decade: decade ?? LEGACY_DECADE, assetRef };
}

/**
 * Vite build-time glob — dosyalar VARSA kayıt dolar (yoksa build hatası YOK).
 * Hem eski (`<klasör>/mood-backdrop-*`) hem dönemli (`*-*-*`) adlar taranır;
 * dosya klasör içinde ya da assets kökünde olabilir.
 */
const BACKDROP_URLS: Record<string, string> = import.meta.glob<string>(
  [
    "../../assets/*/mood-backdrop-*.{jpg,jpeg,png,webp}",
    "../../assets/*/*-*-*.{jpg,jpeg,png,webp}",
    "../../assets/*-*-*.{jpg,jpeg,png,webp}",
  ],
  { eager: true, import: "default", query: "?url" },
);

/** Dosyadan türetilen kayıt (deterministik sıra: genre → decade → mood). */
export const BACKDROP_REGISTRY: readonly BackdropEntry[] = Object.keys(BACKDROP_URLS)
  .map(parseBackdropFile)
  .filter((e): e is BackdropEntry => e !== null)
  .sort(
    (a, b) =>
      a.genre.localeCompare(b.genre) ||
      DECADE_INDEX[a.decade] - DECADE_INDEX[b.decade] ||
      MOOD_INDEX[a.mood.toLowerCase()] - MOOD_INDEX[b.mood.toLowerCase()],
  );

/** assetRef → çözülmüş URL (glob). Yeni dönemli dosyalar buradan çözülür. */
export function backdropUrlByRef(
  assetRef: string | null | undefined,
  map: Record<string, string> = BACKDROP_URLS,
): string | undefined {
  if (!assetRef) return undefined;
  return Object.entries(map).find(([key]) => key.endsWith(assetRef))?.[1];
}

/** Kayıt boş/kimse eşleşmezse düşülecek nötr varsayılan (pop mood duvarı). */
function defaultEntry(
  mood: string | null | undefined,
  registry: readonly BackdropEntry[],
): BackdropEntry {
  const wanted = mood?.trim().toLowerCase();
  const neutral =
    registry.find((e) => e.genre === "pop" && e.mood.toLowerCase() === wanted) ??
    registry.find((e) => e.genre === "pop" && e.mood.toLowerCase() === "dreamy") ??
    registry[0];
  return (
    neutral ?? {
      genre: "pop",
      mood: "Dreamy",
      decade: LEGACY_DECADE,
      assetRef: "pop/mood-backdrop-dreamy.jpg",
    }
  );
}

function laterDecadeFirst(a: BackdropEntry, b: BackdropEntry): number {
  return (
    DECADE_INDEX[b.decade] - DECADE_INDEX[a.decade] ||
    MOOD_INDEX[a.mood.toLowerCase()] - MOOD_INDEX[b.mood.toLowerCase()]
  );
}

/**
 * Deterministik backdrop çözümü. Sıra:
 *   (a) tam genre+mood+decade
 *   (b) aynı genre+decade, en yakın mood
 *   (c) aynı genre+mood, en yakın dönem (eşitlikte SONRAKİ dönem)
 *   (d) aynı genre, en yakın dönem, herhangi mood
 *   (e) mevcut global varsayılan (nötr pop mood duvarı)
 * İstenen dönem yoksa (releaseYear yok) 1980s'e göre eşlenir ve `exact=false`
 * kalır. Kayıt boş olsa bile throw ETMEZ — sentetik varsayılana iner.
 */
export function resolveBackdrop(
  input: {
    mood?: string | null;
    genre?: string | null;
    decade?: string | null;
    releaseYear?: number | null;
  },
  registry: readonly BackdropEntry[] = BACKDROP_REGISTRY,
): BackdropResolution {
  const moodIdx = moodIndex(input.mood);
  const requested = decadeOf(input.decade, input.releaseYear);
  const matchDecade = requested ?? LEGACY_DECADE;
  const genre = input.genre?.trim().toLowerCase() ?? "";
  const mood = moodIdx >= 0 ? REGISTRY_MOODS[moodIdx] : null;

  const inGenre = registry.filter((e) => e.genre === genre);
  const inGenreMood = mood ? inGenre.filter((e) => e.mood === mood) : [];

  // (a) tam eşleşme
  const exact = inGenreMood.find((e) => e.decade === matchDecade);
  if (exact) return resolution(exact, requested, "exact");

  // (b) aynı genre+decade, en yakın mood
  if (moodIdx >= 0) {
    const sameDecade = inGenre.filter((e) => e.decade === matchDecade);
    if (sameDecade.length > 0) {
      const best = sameDecade.reduce((a, b) =>
        Math.abs(moodIndex(b.mood) - moodIdx) < Math.abs(moodIndex(a.mood) - moodIdx) ? b : a,
      );
      return resolution(best, requested, "mood");
    }
  }

  // (c) aynı genre+mood, en yakın dönem (eşitlikte sonraki dönem)
  if (inGenreMood.length > 0) {
    const target = DECADE_INDEX[matchDecade];
    const best = inGenreMood.reduce((a, b) => {
      const da = Math.abs(DECADE_INDEX[a.decade] - target);
      const db = Math.abs(DECADE_INDEX[b.decade] - target);
      if (db !== da) return db < da ? b : a;
      return DECADE_INDEX[b.decade] > DECADE_INDEX[a.decade] ? b : a; // tie → later
    });
    return resolution(best, requested, "decade");
  }

  // (d) aynı genre, en yakın dönem, herhangi mood
  if (inGenre.length > 0) {
    const target = DECADE_INDEX[matchDecade];
    const nearest = Math.min(...inGenre.map((e) => Math.abs(DECADE_INDEX[e.decade] - target)));
    const tied = inGenre
      .filter((e) => Math.abs(DECADE_INDEX[e.decade] - target) === nearest)
      .sort(laterDecadeFirst);
    return resolution(tied[0], requested, "genre-decade");
  }

  // (e) global varsayılan
  return resolution(defaultEntry(input.mood, registry), requested, "default");
}

function resolution(
  entry: BackdropEntry,
  requested: Decade | null,
  strategy: BackdropStrategy,
): BackdropResolution {
  return {
    assetRef: entry.assetRef,
    genre: entry.genre,
    mood: entry.mood,
    matchedDecade: entry.decade,
    exact: requested !== null && entry.decade === requested,
    strategy,
  };
}
