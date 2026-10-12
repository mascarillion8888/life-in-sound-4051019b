/**
 * İş 3, Dilim 2 — poster "hero" line: a single emotional sentence that
 * describes THE SONG LIST (not the user), one per Mood. Pure/deterministic,
 * NO LLM, NO fabricated data (ANA_YASA §0).
 *
 * Only a REAL inferred mood (topMoods[0] from the grounded DNA, guaranteed to
 * be a MOOD_SET member or absent) produces a hero. "Unclassified", empty, or
 * an unmapped mood → null → the legacy deterministic poster renders unchanged.
 *
 * Localization follows the poster's own i18n pattern (RENDER_LABELS[locale],
 * tr|en) — NOT the 5-locale dictionaries, because a mood table there would
 * force es/de/fr translations (fabrication). UI languages today are tr/en.
 */
import type { Mood } from "@/lib/ai/moodInference";

export const HERO_BY_MOOD: Record<"tr" | "en", Record<Mood, string>> = {
  en: {
    Energetic: "This list is full of motion and energy.",
    Euphoric: "This list is riding a wave of euphoria.",
    Playful: "This list is full of joy and play.",
    Romantic: "This list carries the warmth of love.",
    Melancholic: "There is a soft, gentle sadness in this list.",
    Dreamy: "This list drifts between dream and waking.",
    Nostalgic: "This list reaches back to the past.",
    Dark: "There is a depth of shadow in this list.",
    World: "This list reaches across the world's rhythms.",
  },
  tr: {
    Energetic: "Bu liste hareketle ve enerjiyle dolu.",
    Euphoric: "Bu liste coşkunun doruğunda.",
    Playful: "Bu listede neşe ve oyun var.",
    Romantic: "Bu listede aşkın sıcaklığı var.",
    Melancholic: "Bu listede hüzün yumuşak bir ses.",
    Dreamy: "Bu liste hayalle uyanıklık arasında.",
    Nostalgic: "Bu liste geçmişe uzanan bir köprü.",
    Dark: "Bu listede gölgelerin derinliği var.",
    World: "Bu liste dünyanın ritimlerine uzanır.",
  },
};

/**
 * Hero for a REAL inferred mood. Null when the mood is not a known MOOD_SET
 * member — caller must NOT pass a fallback/fabricated mood here (N8).
 */
export function heroForMood(mood: Mood | null | undefined, locale: "tr" | "en"): string | null {
  if (!mood) return null;
  return HERO_BY_MOOD[locale][mood] ?? null;
}

/** Total hero length never exceeds the 90-char poster cap for any entry. */
export function maxHeroLength(): number {
  let max = 0;
  for (const locale of ["tr", "en"] as const) {
    for (const mood of Object.values(HERO_BY_MOOD[locale])) {
      max = Math.max(max, mood.length);
    }
  }
  return max;
}
