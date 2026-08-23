/**
 * Supported UI languages. "en" is the source/default locale — every other
 * dictionary must mirror its key structure exactly (enforced by tests).
 */
export const SUPPORTED_LANGUAGES = ["en", "tr", "es", "de", "fr"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "en";

/** Native display names, used by the switcher and by the LLM language rule. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  tr: "Türkçe",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}
