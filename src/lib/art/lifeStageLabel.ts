/**
 * Life-stage chip label for a listener age — the SINGLE source of the life
 * period thresholds. Every other module derives from these cut-offs:
 * `listenerPeriod.ts` reads them through `stageLabelForAge`, so an age maps to
 * exactly one label here and one period there.
 *
 * Nine life periods exist in total: eight age bands (childhood … later life)
 * plus "now" (met it recently/today), which has no age band and therefore no
 * label here — "now" is a listener choice, never an age.
 *
 * Bands: childhood ≤9, pre-teen 10–12, teen 13–17, youth 18–22, young adult
 * 23–29, adulthood 30–39, midlife 40–59, later life 60+.
 */
export function stageLabelForAge(age: number): string {
  if (age <= 9) return "Childhood";
  if (age <= 12) return "Pre-teen";
  if (age <= 17) return "Teen years";
  if (age <= 22) return "Youth";
  if (age <= 29) return "Young adult";
  if (age <= 39) return "Adulthood";
  if (age <= 59) return "Midlife";
  return "Later life";
}
