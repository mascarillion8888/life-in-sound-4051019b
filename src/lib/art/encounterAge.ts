/**
 * Resolve the listener's age when they encountered a song.
 *
 * The card's `ageRange` is the fallback: a coarse life-stage band. When both the
 * listener's birth year and the song's release year are known, the real age
 * (releaseYear - birthYear) is more truthful — but only when it plausibly fits
 * the card's band (±2 years). Outside that window the song is simply not from
 * that life stage, so the band's midpoint is kept.
 */
export type EncounterAgeInput = {
  /** Human label such as "Ages 18-24", "40+", or "Now". */
  ageRange: string;
  birthYear?: number | null;
  releaseYear?: number | null;
};

/** Allowed lifetime bounds — a resolved age is never negative or over 100. */
const AGE_MIN = 0;
const AGE_MAX = 100;
/** Tolerance around the card's band before the derived age is rejected. */
const WINDOW = 2;

function numbersIn(ageRange: string): number[] {
  return ageRange.match(/\d+/g)?.map(Number) ?? [];
}

function bandBounds(ageRange: string): { min: number; max: number } | null {
  const nums = numbersIn(ageRange);
  if (nums.length === 0) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
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
}: EncounterAgeInput): number | null {
  const bounds = bandBounds(ageRange);

  if (bounds && typeof birthYear === "number" && typeof releaseYear === "number") {
    const derived = releaseYear - birthYear;
    const withinBand = derived >= bounds.min - WINDOW && derived <= bounds.max + WINDOW;
    const withinLife = derived >= AGE_MIN && derived <= AGE_MAX;
    if (withinBand && withinLife) return derived;
  }

  return bandMidpoint(ageRange);
}
