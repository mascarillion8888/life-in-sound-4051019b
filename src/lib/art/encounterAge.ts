/**
 * Resolve the listener's age when they encountered a song.
 *
 * When both the listener's birth year and the song's release year are known, the
 * real age (releaseYear - birthYear) is the truth — a listener can be any age, so
 * the card's life-stage band does NOT constrain it. The band is only a fallback:
 * when a year is missing, or the derived age falls outside a plausible lifetime
 * (0–100), the band's midpoint is used instead.
 */
export type EncounterAgeInput = {
  /** Human label such as "Ages 18-24", "40+", or "Now". */
  ageRange: string;
  birthYear?: number | null;
  releaseYear?: number | null;
};

export type EncounterAge = {
  /** The resolved age in years, or null when the band carries no number. */
  value: number | null;
  /** True when `value` came from releaseYear - birthYear rather than the band. */
  derived: boolean;
};

/** A derived age outside this lifetime range is rejected. */
const AGE_MIN = 0;
const AGE_MAX = 100;

function numbersIn(ageRange: string): number[] {
  return ageRange.match(/\d+/g)?.map(Number) ?? [];
}

function bandMidpoint(ageRange: string): number | null {
  const nums = numbersIn(ageRange);
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export function resolveEncounterAge({
  ageRange,
  birthYear,
  releaseYear,
}: EncounterAgeInput): EncounterAge {
  if (typeof birthYear === "number" && typeof releaseYear === "number") {
    const derived = releaseYear - birthYear;
    if (derived >= AGE_MIN && derived <= AGE_MAX) return { value: derived, derived: true };
  }
  return { value: bandMidpoint(ageRange), derived: false };
}
