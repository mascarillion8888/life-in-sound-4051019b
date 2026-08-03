export const JOURNEY_STORAGE_KEY = "soundmap.journey.v1";

export type JourneyProgress = {
  current: number;
  answers: Record<number, string>;
};

export const emptyJourney: JourneyProgress = { current: 1, answers: {} };

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Read saved journey progress. Returns null when nothing valid is stored. */
export function loadJourney(): JourneyProgress | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(JOURNEY_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<JourneyProgress>;
    const current =
      typeof parsed.current === "number" && parsed.current >= 1
        ? Math.floor(parsed.current)
        : 1;

    const answers: Record<number, string> = {};
    if (parsed.answers && typeof parsed.answers === "object") {
      for (const [key, value] of Object.entries(parsed.answers)) {
        const id = Number(key);
        if (Number.isFinite(id) && typeof value === "string" && value.length > 0) {
          answers[id] = value;
        }
      }
    }

    return { current, answers };
  } catch {
    return null;
  }
}

/** Persist journey progress. Silently ignores quota/private-mode failures. */
export function saveJourney(progress: JourneyProgress): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable — progress simply isn't persisted */
  }
}

/** Remove all saved journey progress. */
export function clearJourney(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(JOURNEY_STORAGE_KEY);
  } catch {
    /* nothing to do */
  }
}

/** True when there is any meaningful saved progress. */
export function hasJourneyProgress(progress: JourneyProgress | null): boolean {
  if (!progress) return false;
  return progress.current > 1 || Object.keys(progress.answers).length > 0;
}
