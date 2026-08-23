import { Check, Globe } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from "@/lib/i18n/languages";

/**
 * Compact globe + locale-code switcher for the header/navigation area.
 * Selecting a language updates the LanguageContext, which instantly
 * re-renders every dictionary-driven label in the app.
 */
export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t.nav.switchLanguage}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground backdrop-blur-md transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Globe className="h-4 w-4" />
        {language}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onSelect={() => setLanguage(lang)}
            className="flex items-center justify-between gap-3"
          >
            <span>{LANGUAGE_NAMES[lang]}</span>
            {lang === language ? <Check className="h-4 w-4 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
