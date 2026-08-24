/**
 * MTG-style Dynamic Life Cards — deterministic card model builder.
 *
 * Eight cards, one per journey question. The card copy is English-first
 * ("9 YEARS OLD — FIRST SPARK", "Legendary Life Era") with dictionary
 * overrides for other locales. Pure and I/O-free: no song data is invented
 * here — each card only carries a 1-based `songIndex`; the caller resolves
 * the actual Song/artwork, and a missing song stays missing.
 */

/** Localized card copy (defaults = English, dictionaries override). */
export type LifeCardStrings = {
  /** 8 uppercase era titles, journey order. */
  eraTitles: string[];
  /** 8 age-range labels, journey order. */
  ageRanges: string[];
  /** MTG-style type line, e.g. "Legendary Life Era". */
  typeLine: string;
  /** 8 gothic narrative snippets, journey order. */
  narratives: string[];
};

export const DEFAULT_LIFE_CARD_STRINGS: LifeCardStrings = {
  eraTitles: [
    "FIRST SPARK",
    "FIRST SIGNATURE",
    "REBELLION",
    "INQUIRY",
    "STEEL",
    "DARKNESS",
    "LONGING",
    "ACCEPTANCE",
  ],
  ageRanges: [
    "Ages 5–9",
    "Ages 9–12",
    "Ages 13–17",
    "Ages 18–22",
    "Ages 18–28",
    "Ages 23–30",
    "Ages 28+",
    "Now",
  ],
  typeLine: "Legendary Life Era",
  narratives: [
    "The years when the world was still vast and soft.",
    "The first threshold where taste became a mirror.",
    "The era when volume ran higher than feeling.",
    "Years that gathered more questions than answers.",
    "The tempering: fragility wrought into armor.",
    "The place where sound arrived before light.",
    "The moment loss became portable through music.",
    "Where inquiry and peace meet in a single melody.",
  ],
};

/** Per-era stats mirroring the journey eras (intensity, tag, tone). */
const ERA_STATS = [
  { tag: "Innocence", tone: "silver", intensity: 0.35 },
  { tag: "First Identity", tone: "silver", intensity: 0.45 },
  { tag: "Rebellion", tone: "violet", intensity: 0.78 },
  { tag: "Inquiry", tone: "violet", intensity: 0.6 },
  { tag: "Strength", tone: "gold", intensity: 0.85 },
  { tag: "Darkness", tone: "violet", intensity: 0.25 },
  { tag: "Longing", tone: "gold", intensity: 0.5 },
  { tag: "Acceptance", tone: "gold", intensity: 0.68 },
] as const;

export const LIFE_CARD_COUNT = 8;

/** Frame accent per tone — shared by the DOM card and the canvas export. */
export const LIFE_CARD_TONE_COLORS: Record<LifeCard["tone"], string> = {
  violet: "#8b5cf6",
  gold: "#d4b06a",
  silver: "#a7b0c0",
};

/** The full copy set for a locale (Turkish built-in, English otherwise). */
export function lifeCardStringsFor(locale: string): LifeCardStrings {
  return resolveStrings({ locale });
}

export type LifeCard = {
  /** 0-based card position. */
  index: number;
  /** 1-based song position in the journey order. */
  songIndex: number;
  /** Uppercase era title, e.g. "FIRST SPARK". */
  eraTitle: string;
  /** Age-range label, e.g. "Ages 5–9". */
  ageRange: string;
  /** MTG-style type line. */
  typeLine: string;
  /** Theme tag for the stat row. */
  tag: string;
  /** Tailwind-safe token name for the frame accent. */
  tone: "violet" | "gold" | "silver";
  /** Emotional intensity 0..1 (stat). */
  intensity: number;
  /** Gothic narrative snippet for the text box. */
  narrative: string;
};

export type BuildLifeCardsOptions = {
  /**
   * Locale tag (e.g. "tr"). When the locale is Turkish and no explicit
   * `t` override is given, the built-in Turkish copy is used; every other
   * locale falls back to English (dictionaries can override per-key).
   */
  locale?: string;
  /** Full copy override (usually from the active dictionary). */
  t?: Partial<LifeCardStrings>;
};

/** Built-in Turkish copy — kept here so the poster canvas (no React context)
 * can localize without threading dictionaries through the render tree. */
export const TR_LIFE_CARD_STRINGS: LifeCardStrings = {
  eraTitles: [
    "İLK KIVILCIM",
    "İLK İMZA",
    "İSYAN",
    "SORGULAMA",
    "ÇELİK",
    "KARANLIK",
    "ÖZLEM",
    "KABULLENİŞ",
  ],
  ageRanges: [
    "5–9 Yaş",
    "9–12 Yaş",
    "13–17 Yaş",
    "18–22 Yaş",
    "18–28 Yaş",
    "23–30 Yaş",
    "28+ Yaş",
    "Şimdi",
  ],
  typeLine: "Efsanevi Hayat Dönemi",
  narratives: [
    "Dünyanın hâlâ büyük ve yumuşak olduğu yıllar.",
    "Zevkin bir aynaya dönüştüğü ilk eşik.",
    "Ses seviyesinin duygudan yüksek olduğu dönem.",
    "Cevaplardan çok soruların biriktiği yıllar.",
    "Çelikleşme: kırılganlığın zırha dönüşmesi.",
    "Sesin ışıktan önce geldiği yer.",
    "Kaybın müzikle taşınabilir hâle geldiği an.",
    "Sorguyla barışın aynı melodide buluşması.",
  ],
};

function resolveStrings(opts: BuildLifeCardsOptions): LifeCardStrings {
  const base = opts.locale === "tr" ? TR_LIFE_CARD_STRINGS : DEFAULT_LIFE_CARD_STRINGS;
  if (!opts.t) return base;
  return {
    eraTitles: opts.t.eraTitles?.length === LIFE_CARD_COUNT ? opts.t.eraTitles : base.eraTitles,
    ageRanges: opts.t.ageRanges?.length === LIFE_CARD_COUNT ? opts.t.ageRanges : base.ageRanges,
    typeLine: opts.t.typeLine ?? base.typeLine,
    narratives: opts.t.narratives?.length === LIFE_CARD_COUNT ? opts.t.narratives : base.narratives,
  };
}

/**
 * Build the 8 life cards. Always returns exactly 8 cards — a missing song is
 * the caller's rendering concern (the card simply has no artwork), never a
 * fabricated track.
 */
export function buildLifeCards(opts: BuildLifeCardsOptions = {}): LifeCard[] {
  const strings = resolveStrings(opts);
  return Array.from({ length: LIFE_CARD_COUNT }, (_, i) => ({
    index: i,
    songIndex: i + 1,
    eraTitle: strings.eraTitles[i],
    ageRange: strings.ageRanges[i],
    typeLine: strings.typeLine,
    tag: ERA_STATS[i].tag,
    tone: ERA_STATS[i].tone,
    intensity: ERA_STATS[i].intensity,
    narrative: strings.narratives[i],
  }));
}
