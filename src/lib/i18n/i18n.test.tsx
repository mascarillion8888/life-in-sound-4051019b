import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { dictionaries, type Dictionary } from "./dictionaries";
import { DEFAULT_LANGUAGE, LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from "./languages";
import { LanguageProvider, useLanguage } from "./LanguageContext";

/** Recursively collect the key paths of a dictionary (functions count as leaves). */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("i18n dictionaries", () => {
  it("every supported language mirrors the English key structure", () => {
    const source = keyPaths(dictionaries[DEFAULT_LANGUAGE]).sort();
    for (const lang of SUPPORTED_LANGUAGES) {
      if (lang === DEFAULT_LANGUAGE) continue;
      expect(keyPaths(dictionaries[lang]).sort(), `dictionary "${lang}" key parity`).toEqual(
        source,
      );
    }
  });

  it("phase roadmap labels exist for all four deterministic chapters in every language", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const dict: Dictionary = dictionaries[lang];
      for (const id of ["chapter-i", "chapter-ii", "chapter-iii", "chapter-iv"]) {
        expect(dict.poster.phaseTitles[id], `${lang} ${id} title`).toBeTruthy();
        expect(dict.poster.phaseAgeRanges[id], `${lang} ${id} ageRange`).toBeTruthy();
      }
    }
  });

  it("footer quotes are translated (non-English locales differ from English)", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      if (lang === DEFAULT_LANGUAGE) continue;
      expect(dictionaries[lang].poster.footerQuote1).not.toBe(dictionaries.en.poster.footerQuote1);
      expect(dictionaries[lang].poster.footerQuote2).not.toBe(dictionaries.en.poster.footerQuote2);
    }
  });

  it("every language has a native display name", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(LANGUAGE_NAMES[lang]).toBeTruthy();
    }
  });
});

function Probe() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <span data-testid="label">{t.poster.lifePhaseRoadmap}</span>
      <button onClick={() => setLanguage("tr")}>switch-tr</button>
    </div>
  );
}

describe("LanguageContext", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to English when nothing is stored", () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(screen.getByTestId("label").textContent).toBe("Life Phase Roadmap");
  });

  it("switching language updates labels instantly and persists to localStorage", () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByText("switch-tr"));
    expect(screen.getByTestId("lang").textContent).toBe("tr");
    expect(screen.getByTestId("label").textContent).toBe("Yaşam Evresi Yol Haritası");
    expect(window.localStorage.getItem("soundmap:language")).toBe("tr");
    expect(document.documentElement.lang).toBe("tr");
  });

  it("restores the persisted language on mount", () => {
    window.localStorage.setItem("soundmap:language", "de");
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("lang").textContent).toBe("de");
    expect(screen.getByTestId("label").textContent).toBe("Lebensphasen-Roadmap");
  });

  it("ignores an invalid persisted value", () => {
    window.localStorage.setItem("soundmap:language", "xx");
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("lang").textContent).toBe("en");
  });

  it("useLanguage works without a provider (English fallback)", () => {
    render(<Probe />);
    expect(screen.getByTestId("lang").textContent).toBe("en");
    expect(screen.getByTestId("label").textContent).toBe("Life Phase Roadmap");
  });
});
