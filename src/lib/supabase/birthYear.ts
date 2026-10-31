/**
 * Birth-year parsing shared by the prompt and the profile hook. Only a plain
 * four-digit year is accepted; anything else is rejected rather than guessed.
 */
export const MIN_BIRTH_YEAR = 1900;

export function parseBirthYear(raw: string, now: Date = new Date()): number | null {
  const text = raw.trim();
  if (!/^\d{4}$/.test(text)) return null;
  const year = Number(text);
  const max = now.getFullYear();
  return year >= MIN_BIRTH_YEAR && year <= max ? year : null;
}
