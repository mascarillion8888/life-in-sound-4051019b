/**
 * Resolve the listener's age when they met a song.
 *
 * A card's life moment is defined by WHEN THE LISTENER MET THE SONG, not by the
 * song's release year and not by a fixed age band tied to the journey question.
 * Two inputs can state the meeting: an exact `metAge` the listener typed, or a
 * `period` (their choice, or the card's smart default). `metAge` wins when set.
 *
 * `value` (the encounter age the lore receives) is:
 *   - `metAge` when a valid one is given,
 *   - otherwise the period's midpoint, clamped to the listener's current age,
 *     with "now" resolving to the current age,
 *   - otherwise null — never invented.
 *
 * `discoveredLater` marks an older song met well after its release: the release
 * is at least `DISCOVERED_LATER_YEARS` before the meeting year (birthYear +
 * metAge, or the period's start year, or the current year for "now"), or the
 * song came out before the listener was born. With no meeting stated there is
 * nothing to compare against, so the flag stays false.
 */
import { PERIOD_INFO, isMetAge, periodStartYear, type Period } from "./listenerPeriod";

export type EncounterAgeInput = {
  /** The exact age the listener typed when they met the song, if any. */
  metAge?: number | null;
  /** The listener's chosen (or defaulted) life period, if any. */
  period?: Period | null;
  birthYear?: number | null;
  releaseYear?: number | null;
  /** Current year, injected so "now" stays deterministic. Defaults to the clock. */
  currentYear?: number;
};

export type EncounterAge = {
  /** The meeting age the lore receives, or null when no meeting is known. */
  value: number | null;
  /** True when `value` came from a period's midpoint (not the listener's own age). */
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
 * How many years before the meeting a song must have been released for the
 * encounter to count as "discovered later" (an older song met later).
 */
const DISCOVERED_LATER_YEARS = 8;

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function resolveEncounterAge({
  metAge,
  period,
  birthYear,
  releaseYear,
  currentYear,
}: EncounterAgeInput): EncounterAge {
  const hasBirthYear = isFiniteNumber(birthYear);
  const hasReleaseYear = isFiniteNumber(releaseYear);
  const year = currentYear ?? new Date().getFullYear();
  const currentAge = hasBirthYear ? year - (birthYear as number) : null;
  const validMetAge = isMetAge(metAge) ? metAge : null;

  let value: number | null;
  if (validMetAge !== null) {
    value = validMetAge;
  } else if (period) {
    if (period === "now") {
      value = currentAge;
    } else {
      const midpoint = PERIOD_INFO[period].midpoint;
      value =
        currentAge !== null && midpoint !== null && midpoint > currentAge ? currentAge : midpoint;
    }
  } else {
    value = null;
  }

  let releasedAtAge: number | null = null;
  if (hasBirthYear && hasReleaseYear) {
    const age = (releaseYear as number) - (birthYear as number);
    if (age >= AGE_MIN && age <= AGE_MAX) releasedAtAge = age;
  }

  // The year the listener met the song, from the exact age first, else the
  // period's start year ("now" starts at the current year).
  let meetingYear: number | null = null;
  if (validMetAge !== null && hasBirthYear) {
    meetingYear = (birthYear as number) + validMetAge;
  } else if (period && hasBirthYear) {
    meetingYear = periodStartYear(period, birthYear as number, year);
  } else if (period === "now") {
    meetingYear = year;
  }

  let discoveredLater = false;
  if (hasReleaseYear && meetingYear !== null) {
    const release = releaseYear as number;
    if (hasBirthYear && release < (birthYear as number)) {
      discoveredLater = true;
    } else if (release <= meetingYear - DISCOVERED_LATER_YEARS) {
      discoveredLater = true;
    }
  }

  return { value, derived: validMetAge === null && period != null, releasedAtAge, discoveredLater };
}
