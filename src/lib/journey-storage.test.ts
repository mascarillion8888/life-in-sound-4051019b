import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  JOURNEY_STORAGE_KEY,
  clearJourney,
  hasJourneyProgress,
  loadJourney,
  mergeJourneys,
  saveJourney,
} from "./journey-storage";

describe("journey-storage localStorage layer", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips a journey through localStorage", () => {
    const progress = { current: 3, answers: { 1: "Song A", 2: "Song B" } };
    saveJourney(progress);
    expect(loadJourney()).toEqual(progress);
  });

  it("returns null when nothing is stored", () => {
    expect(loadJourney()).toBeNull();
  });

  it("drops invalid answers while keeping valid ones", () => {
    localStorage.setItem(
      JOURNEY_STORAGE_KEY,
      JSON.stringify({
        current: 2,
        answers: { 1: "Keep", bad: "Drop", 2: "" },
      }),
    );
    const loaded = loadJourney();
    expect(loaded).toEqual({ current: 2, answers: { 1: "Keep" } });
  });

  it("clamps a bad current value back to 1", () => {
    localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify({ current: -5, answers: {} }));
    expect(loadJourney()).toEqual({ current: 1, answers: {} });
  });

  it("clearJourney removes the stored entry", () => {
    saveJourney({ current: 4, answers: { 1: "x" } });
    expect(loadJourney()).not.toBeNull();
    clearJourney();
    expect(loadJourney()).toBeNull();
  });

  it("hasJourneyProgress detects meaningful progress", () => {
    expect(hasJourneyProgress(null)).toBe(false);
    expect(hasJourneyProgress({ current: 1, answers: {} })).toBe(false);
    expect(hasJourneyProgress({ current: 2, answers: {} })).toBe(true);
    expect(hasJourneyProgress({ current: 1, answers: { 1: "x" } })).toBe(true);
  });
});

describe("mergeJourneys reconciliation", () => {
  it("returns the non-null side when one is null", () => {
    const a = { current: 2, answers: { 1: "x" } };
    expect(mergeJourneys(a, null)).toEqual(a);
    expect(mergeJourneys(null, a)).toEqual(a);
    expect(mergeJourneys(null, null)).toBeNull();
  });

  it("prefers the snapshot with more answers", () => {
    const smaller = { current: 5, answers: { 1: "x" } };
    const bigger = { current: 1, answers: { 1: "x", 2: "y", 3: "z" } };
    expect(mergeJourneys(smaller, bigger)).toEqual(bigger);
  });

  it("breaks ties toward the higher current", () => {
    const low = { current: 2, answers: { 1: "x" } };
    const high = { current: 5, answers: { 1: "y" } };
    expect(mergeJourneys(low, high)).toEqual(high);
  });
});
