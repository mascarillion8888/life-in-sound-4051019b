/**
 * Tiny external store holding the listener's birth year so deep components
 * (QuizCard) can read it without prop drilling. The journey route writes it
 * from the profile; everything else only reads.
 */
import { useSyncExternalStore } from "react";

let current: number | null = null;
const listeners = new Set<() => void>();

export const birthYearStore = {
  get: (): number | null => current,
  set(year: number | null): void {
    if (year === current) return;
    current = year;
    listeners.forEach((listener) => listener());
  },
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useBirthYear(): number | null {
  return useSyncExternalStore(subscribe, birthYearStore.get, () => null);
}
