/**
 * Resolve the listener's age when they encountered a song.
 *
 * The 8-question journey asks about each life stage ("what did you listen to in
 * childhood…"), so the user's stage choice IS the encounter age: the card's
 * life-stage band is the primary source and its midpoint is the resolved age.
 * The song's release year never overrides that choice — it only marks a
 * "discovered later" case, when an older song was met years after its release.
 *
 * When the listener has picked a life period for the song (see
 * `listenerPeriod.ts`), that period replaces the band: `value` becomes the
 * period's midpoint (or the current age for "now") and the "discovered later"
 * threshold uses the period's start year instead of the band's.
 */
import { PERIOD_INFO, periodStartYear, type Period } from "./listenerPeriod";

export type EncounterAgeInput = {
  /** Human label such as "Ages 18-24", "40+", or "Now". */
  ageRange: string;
  birthYear?: number | null;
  releaseYear?: number | null;
  /** Listener-chosen life period — overrides the band when present. */
  period?: Period | null;
  /** Current year, injected so "now" stays deterministic. Defaults to the clock. */
  currentYear?: number;
};

export type EncounterAge = {
  /** The stage band's midpoint (or the chosen period's midpoint), or null. */
  value: number | null;
  /** Always false: the age comes from the stage band, never a derived year. */
  derived: boolean;
  /** releaseYear - birthYear when both are known and within a lifetime, else null. */
  releasedAtAge: number | null;
  /** True when an older song was met well after its release (see threshold). */
  discoveredLater: boolean;
};

/** A derived age outside this lifetime range is rejected. */
const AGE_MIN = 0;
const AGE_MAX = 100;

/**
 * How many years before the stage band begins a song must have been released
 * for the encounter to count as "discovered later" (an older song met later).
 */
const DISCOVERED_LATER_YEARS = 8;

function numbersIn(ageRange: string): number[] {
  return ageRange.match(/\d+/g)?.map(Number) ?? [];
}

function bandMidpoint(ageRange: string): number | null {
  const nums = numbersIn(ageRange);
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function bandLowerBound(ageRange: string): number | null {
  const nums = numbersIn(ageRange);
  return nums.length === 0 ? null : Math.min(...nums);
}

export function resolveEncounterAge({
  ageRange,
  birthYear,
  releaseYear,
  period,
  currentYear,
}: EncounterAgeInput): EncounterAge {
  const hasBirthYear = typeof birthYear === "number" && Number.isFinite(birthYear);
  const hasReleaseYear = typeof releaseYear === "number" && Number.isFinite(releaseYear);
  const year = currentYear ?? new Date().getFullYear();

  let value: number | null;
  if (period) {
    // A chosen period wins: its midpoint is the age, and "now" resolves to the
    // current age when the birth year is known (null otherwise).
    const midpoint = PERIOD_INFO[period].midpoint;
    value = midpoint ?? (hasBirthYear ? year - (birthYear as number) : null);
  } else {
    value = bandMidpoint(ageRange);
  }

  let releasedAtAge: number | null = null;
  if (hasBirthYear && hasReleaseYear) {
    const age = (releaseYear as number) - (birthYear as number);
    if (age >= AGE_MIN && age <= AGE_MAX) releasedAtAge = age;
  }

  let discoveredLater = false;
  if (hasBirthYear && hasReleaseYear) {
    const lower = bandLowerBound(ageRange);
    const startYear = period
      ? periodStartYear(period, birthYear as number, year)
      : lower !== null
        ? (birthYear as number) + lower
        : null;
    if ((releaseYear as number) < (birthYear as number)) {
      discoveredLater = true;
    } else if (
      startYear !== null &&
      (releaseYear as number) <= startYear - DISCOVERED_LATER_YEARS
    ) {
      discoveredLater = true;
    }
  }

  return { value, derived: false, releasedAtAge, discoveredLater };
}
