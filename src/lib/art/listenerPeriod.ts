/**
 * Listener period — the life period the LISTENER assigns to a song.
 *
 * The journey's 8 questions are themes (first love, a hard time, …), not
 * literal age buckets; the person who lived the memory decides which period a
 * song belongs to. Each card's default comes from its journey band (see
 * `lifeCards.ts` ageRanges) so nothing changes until the listener picks a
 * period, and the chosen period then drives the encounter age used by the lore.
 *
 * Pure and I/O-free: the current year is injected (never read from the clock)
 * so `now` and every derived value stay deterministic under test.
 */
import { stageLabelForAge } from "./lifeStageLabel";

/** The seven listener-chosen life periods, in chronological order. */
export const PERIODS = [
  "childhood",
  "teen",
  "youth",
  "youngAdult",
  "adulthood",
  "laterLife",
  "now",
] as const;

export type Period = (typeof PERIODS)[number];

export type PeriodInfo = {
  /** English label — the existing stage strings plus "Now". */
  label: string;
  /** Representative age range (empty for "now", whose age depends on birth year). */
  ageRange: string;
  /** Representative age, or null for "now" (resolved from the current year). */
  midpoint: number | null;
};

/**
 * Each period's representative band and midpoint, consistent with the
 * `stageLabelForAge` thresholds (<=12, <=17, <=24, <=39, <=59, 60+). The
 * midpoints double as the encounter age for a chosen period; "now" has no fixed
 * midpoint — it resolves to the current age (currentYear - birthYear).
 */
export const PERIOD_INFO: Record<Period, PeriodInfo> = {
  childhood: { label: "Childhood", ageRange: "Ages 5-12", midpoint: 9 },
  teen: { label: "Teen years", ageRange: "Ages 13-17", midpoint: 15 },
  youth: { label: "Youth", ageRange: "Ages 18-24", midpoint: 21 },
  youngAdult: { label: "Young adult", ageRange: "Ages 25-39", midpoint: 32 },
  adulthood: { label: "Adulthood", ageRange: "Ages 40-59", midpoint: 50 },
  laterLife: { label: "Later life", ageRange: "Ages 60+", midpoint: 70 },
  now: { label: "Now", ageRange: "Now", midpoint: null },
};

/** True when the value is one of the seven known periods. */
export function isPeriod(value: unknown): value is Period {
  return typeof value === "string" && (PERIODS as readonly string[]).includes(value);
}

/** English label for a period ("teen" → "Teen years"). */
export function periodLabel(period: Period): string {
  return PERIOD_INFO[period].label;
}

/** Midpoint of a period's representative band, or null for "now". */
export function periodMidpoint(period: Period): number | null {
  return PERIOD_INFO[period].midpoint;
}

/**
 * Map a card's default band (a `lifeCards.ts` ageRange string) to a period by
 * its midpoint, using the same thresholds as `stageLabelForAge`. A band without
 * a number ("Now") maps to "now"; an unparseable band also falls back to "now".
 */
export function periodForBand(ageRange: string): Period {
  const nums = ageRange.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length === 0) return "now";
  const midpoint = Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  switch (stageLabelForAge(midpoint)) {
    case "Childhood":
      return "childhood";
    case "Teen years":
      return "teen";
    case "Youth":
      return "youth";
    case "Young adult":
      return "youngAdult";
    case "Adulthood":
      return "adulthood";
    default:
      return "laterLife";
  }
}

/**
 * The year a period starts for a given listener — used by the "discovered
 * later" check. "now" starts at the current year; the numbered periods start
 * at birthYear + their band's lower bound.
 */
export function periodStartYear(period: Period, birthYear: number, currentYear: number): number {
  if (period === "now") return currentYear;
  const start = Number((PERIOD_INFO[period].ageRange.match(/\d+/) ?? [])[0] ?? 0);
  return birthYear + start;
}
