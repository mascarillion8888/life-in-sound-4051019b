/**
 * Listener period — WHEN THE LISTENER MET THE SONG.
 *
 * A card's life moment is defined by when the listener met the song, not by the
 * song's release year and not by fixed age bands tied to the journey question.
 * The listener says when they met each song; it is optional with a smart
 * default. The release year only drives the backdrop era and the year label.
 *
 * Nine periods exist, in life order: eight age bands (childhood … later life)
 * plus "now" (met it recently/today). The bands and their labels come from
 * `lifeStageLabel.ts` — the single source of the thresholds — so an age maps to
 * exactly one label there and one period here.
 *
 * Pure and I/O-free: the current year is injected (never read from the clock)
 * so `now` and every derived value stay deterministic under test.
 */
import { stageLabelForAge } from "./lifeStageLabel";

/** The nine listener life periods, in chronological (life) order. */
export const PERIODS = [
  "childhood",
  "preTeen",
  "teen",
  "youth",
  "youngAdult",
  "adulthood",
  "midlife",
  "laterLife",
  "now",
] as const;

export type Period = (typeof PERIODS)[number];

export type PeriodInfo = {
  /** English label — the eight stage strings plus "Now". */
  label: string;
  /** Representative age band (the exact band for "now"). */
  ageRange: string;
  /** First age of the band, or null for "now" (which has no fixed age). */
  startAge: number | null;
  /** Representative age, or null for "now" (resolved from the current year). */
  midpoint: number | null;
};

/** The English prompt shown on the chip until the listener states a meeting. */
export const MEETING_PROMPT = "When did you meet it?";

/**
 * Each period's band, start age and midpoint, consistent with the
 * `stageLabelForAge` thresholds (≤9, 10–12, 13–17, 18–22, 23–29, 30–39,
 * 40–59, 60+). The midpoints double as the encounter age for a chosen or
 * defaulted period; "now" has no fixed midpoint — it resolves to the current
 * age (currentYear - birthYear).
 */
export const PERIOD_INFO: Record<Period, PeriodInfo> = {
  childhood: { label: "Childhood", ageRange: "Ages 0-9", startAge: 0, midpoint: 5 },
  preTeen: { label: "Pre-teen", ageRange: "Ages 10-12", startAge: 10, midpoint: 11 },
  teen: { label: "Teen years", ageRange: "Ages 13-17", startAge: 13, midpoint: 15 },
  youth: { label: "Youth", ageRange: "Ages 18-22", startAge: 18, midpoint: 20 },
  youngAdult: { label: "Young adult", ageRange: "Ages 23-29", startAge: 23, midpoint: 26 },
  adulthood: { label: "Adulthood", ageRange: "Ages 30-39", startAge: 30, midpoint: 35 },
  midlife: { label: "Midlife", ageRange: "Ages 40-59", startAge: 40, midpoint: 50 },
  laterLife: { label: "Later life", ageRange: "Ages 60+", startAge: 60, midpoint: 70 },
  now: { label: "Now", ageRange: "Now", startAge: null, midpoint: null },
};

/** True when the value is one of the nine known periods. */
export function isPeriod(value: unknown): value is Period {
  return typeof value === "string" && (PERIODS as readonly string[]).includes(value);
}

/** Inclusive lifetime bounds for an exact meeting age. */
export const MET_AGE_MIN = 0;
export const MET_AGE_MAX = 100;

/**
 * True when the value is a valid exact meeting age: a whole number within the
 * 0–100 lifetime range. Rejects negatives, values over 100, non-integers, NaN
 * and non-numbers — an invalid age is treated as "no age given".
 */
export function isMetAge(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MET_AGE_MIN &&
    value <= MET_AGE_MAX
  );
}

/** English label for a period ("preTeen" → "Pre-teen"). */
export function periodLabel(period: Period): string {
  return PERIOD_INFO[period].label;
}

/** Midpoint of a period's representative band, or null for "now". */
export function periodMidpoint(period: Period): number | null {
  return PERIOD_INFO[period].midpoint;
}

/** First age of a period's band, or null for "now". */
export function periodStartAge(period: Period): number | null {
  return PERIOD_INFO[period].startAge;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** The listener's current age from their birth year, or null when unknown. */
export function currentAgeFor(
  birthYear: number | null | undefined,
  currentYear: number,
): number | null {
  return isFiniteNumber(birthYear) ? currentYear - birthYear : null;
}

/**
 * The period an age falls in, using the `stageLabelForAge` thresholds. The
 * inverse of `PERIOD_INFO[period].midpoint`: the midpoint of the returned
 * period always maps back to that period.
 */
export function periodForAge(age: number): Period {
  switch (stageLabelForAge(age)) {
    case "Childhood":
      return "childhood";
    case "Pre-teen":
      return "preTeen";
    case "Teen years":
      return "teen";
    case "Youth":
      return "youth";
    case "Young adult":
      return "youngAdult";
    case "Adulthood":
      return "adulthood";
    case "Midlife":
      return "midlife";
    default:
      return "laterLife";
  }
}

/**
 * Map a card's journey band (a `lifeCards.ts` ageRange string) to a period by
 * its midpoint, using the same thresholds as `stageLabelForAge`. A band without
 * a number ("Now") maps to "now"; an unparseable band also falls back to "now".
 */
export function periodForBand(ageRange: string): Period {
  const nums = ageRange.match(/\d+/g)?.map(Number) ?? [];
  if (nums.length === 0) return "now";
  const midpoint = Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
  return periodForAge(midpoint);
}

/**
 * The periods a listener may be offered: those whose START age is at or below
 * the listener's current age, plus "Now" always. With an unknown birth year
 * every period is offered. A persisted choice is kept by the caller even when
 * it is no longer in this list.
 */
export function availablePeriods(currentAge: number | null): Period[] {
  if (!isFiniteNumber(currentAge)) return [...PERIODS];
  return PERIODS.filter((period) => {
    const start = PERIOD_INFO[period].startAge;
    return start === null || start <= currentAge;
  });
}

/**
 * The smart default when the listener has not chosen yet: the period for
 * `releaseYear - birthYear` when both years are known and the age is a
 * plausible meeting (3 ≤ age ≤ the listener's current age). Otherwise null —
 * never invent an age (pre-birth song, song newer than the listener's life,
 * missing years, unknown birth year).
 */
export function suggestedPeriod(input: {
  birthYear?: number | null;
  releaseYear?: number | null;
  currentYear: number;
}): Period | null {
  const { birthYear, releaseYear, currentYear } = input;
  if (!isFiniteNumber(birthYear) || !isFiniteNumber(releaseYear)) return null;
  const suggestedAge = releaseYear - birthYear;
  const currentAge = currentYear - birthYear;
  if (suggestedAge < 3 || suggestedAge > currentAge) return null;
  return periodForAge(suggestedAge);
}

/**
 * The year a period starts for a given listener — used by the "discovered
 * later" check. "now" starts at the current year; the numbered periods start
 * at birthYear + their band's lower bound.
 */
export function periodStartYear(period: Period, birthYear: number, currentYear: number): number {
  if (period === "now") return currentYear;
  return birthYear + (PERIOD_INFO[period].startAge ?? 0);
}
