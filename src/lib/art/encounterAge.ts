/**
 * Resolve the listener's age when they encountered a song.
 *
 * The 8-question journey asks about each life stage ("what did you listen to in
 * childhood…"), so the user's stage choice IS the encounter age: the card's
 * life-stage band is the primary source and its midpoint is the resolved age.
 * The song's release year never overrides that choice — it only marks a
 * "discovered later" case, when an older song was met years after its release.
 */
export type EncounterAgeInput = {
  /** Human label such as "Ages 18-24", "40+", or "Now". */
  ageRange: string;
  birthYear?: number | null;
  releaseYear?: number | null;
};

export type EncounterAge = {
  /** The stage band's midpoint, or null when the band carries no number. */
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
}: EncounterAgeInput): EncounterAge {
  const value = bandMidpoint(ageRange);

  const hasBirthYear = typeof birthYear === "number" && Number.isFinite(birthYear);
  const hasReleaseYear = typeof releaseYear === "number" && Number.isFinite(releaseYear);

  let releasedAtAge: number | null = null;
  if (hasBirthYear && hasReleaseYear) {
    const age = releaseYear - birthYear;
    if (age >= AGE_MIN && age <= AGE_MAX) releasedAtAge = age;
  }

  let discoveredLater = false;
  if (hasBirthYear && hasReleaseYear) {
    const lower = bandLowerBound(ageRange);
    if (releaseYear < birthYear) {
      discoveredLater = true;
    } else if (lower !== null && releaseYear <= birthYear + lower - DISCOVERED_LATER_YEARS) {
      discoveredLater = true;
    }
  }

  return { value, derived: false, releasedAtAge, discoveredLater };
}
