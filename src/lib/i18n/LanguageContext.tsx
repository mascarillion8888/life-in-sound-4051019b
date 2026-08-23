/**
 * Global language state for the whole app.
 *
 * - Default locale: "en".
 * - The selection persists in localStorage and is restored on load.
 * - `useLanguage()` intentionally falls back to a static English context when
 *   no provider is present, so components (and their unit tests) can render
 *   standalone without wiring the provider.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { dictionaries, type Dictionary } from "./dictionaries";
import { DEFAULT_LANGUAGE, isLanguage, type Language } from "./languages";

const STORAGE_KEY = "soundmap:language";

export type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  /** Active dictionary — read UI strings from here. */
  t: Dictionary;
};

const DEFAULT_CONTEXT: LanguageContextValue = {
  language: DEFAULT_LANGUAGE,
  setLanguage: () => undefined,
  t: dictionaries[DEFAULT_LANGUAGE],
};

const LanguageContext = createContext<LanguageContextValue>(DEFAULT_CONTEXT);

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode etc.) — in-memory state still works.
    }
  };

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t: dictionaries[language] }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
