/**
 * Onboarding clarity + first-value helpers (pure, session-safe).
 *
 * The 8-question Journey is the onboarding ("First Listen"). This module
 * encodes the onboarding completion contract and the first-value call-to-action
 * so routes can route a new user toward FIRST MEMORY CREATED without navigating
 * the whole product.
 *
 * Pure: no I/O except an injectable session-storage accessor (so it works in
 * tests without a DOM). Does NOT require a permanent account — anonymous users
 * can complete onboarding and reach the first-memory CTA.
 */
import { questions } from "@/lib/questions";

/** Total onboarding questions (the Journey length). */
export const ONBOARDING_TOTAL = questions.length;

/** Session-safe key marking that the user has seen the onboarding/results. */
const SEEN_KEY = "lias_onboarding_seen";

/** Session-safe key marking that the user has created their first memory. */
const FIRST_MEMORY_KEY = "lias_first_memory";

/**
 * Pure onboarding completion state derived from the journey answers.
 * Complete when every question has a non-empty answer. This mirrors the
 * Journey route's `canFinish` logic but lives here so it is testable without
 * the route component.
 */
export type OnboardingState = {
  answered: number;
  total: number;
  complete: boolean;
};

export function onboardingState(answers: Record<number, string>): OnboardingState {
  let answered = 0;
  for (const q of questions) {
    const v = answers[q.id];
    if (typeof v === "string" && v.trim().length > 0) answered++;
  }
  return { answered, total: ONBOARDING_TOTAL, complete: answered === ONBOARDING_TOTAL };
}

// --- session-safe flags -----------------------------------------------------

/**
 * Minimal storage accessor abstraction so the same logic runs in tests
 * (no DOM). Defaults to `sessionStorage` in the browser; tests inject a map.
 */
export type FlagStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function browserSessionStorage(): FlagStorage | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage;
}

/** Mark onboarding as seen (called when the user reaches Results). */
export function markOnboardingSeen(storage: FlagStorage | null = browserSessionStorage()): void {
  try {
    storage?.setItem(SEEN_KEY, "1");
  } catch {
    // storage may be unavailable (private mode); non-fatal.
  }
}

/** Has the user seen the onboarding? (session-safe; anonymous-compatible). */
export function hasSeenOnboarding(storage: FlagStorage | null = browserSessionStorage()): boolean {
  try {
    return storage?.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** Mark that the first memory was created (called after the first save). */
export function markFirstMemoryCreated(
  storage: FlagStorage | null = browserSessionStorage(),
): void {
  try {
    storage?.setItem(FIRST_MEMORY_KEY, "1");
  } catch {
    // non-fatal
  }
}

/** Has the user created their first memory? */
export function hasCreatedFirstMemory(
  storage: FlagStorage | null = browserSessionStorage(),
): boolean {
  try {
    return storage?.getItem(FIRST_MEMORY_KEY) === "1";
  } catch {
    return false;
  }
}

// --- first-value CTA --------------------------------------------------------

/**
 * The first-value call-to-action shown after onboarding. Routes the user to
 * the fastest path to FIRST MEMORY CREATED. Anonymous users can use it — no
 * permanent account required.
 */
export const FIRST_VALUE_CTA = {
  route: "/memory" as const,
  label: "Save your first memory",
  blurb:
    "Now capture a real moment — a song and the time it mattered. This is where your lifelong soundtrack begins.",
} as const;

/**
 * One-line product concept for the onboarding. Does not explain the
 * architecture.
 */
export const PRODUCT_CONCEPT = "Your life, remembered through the music that accompanied it.";

/**
 * What a new user should understand they can do, in a few moments. Short,
 * non-technical, no architecture.
 */
export const FIRST_MOMENTS_CAPABILITIES = [
  "Save a song and the moment it belonged to.",
  "Revisit it later.",
  "Discover patterns across your memories.",
  "Build life chapters over time.",
  "Talk with a Companion that remembers what you approved.",
] as const;
