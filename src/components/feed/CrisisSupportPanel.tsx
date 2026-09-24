import { HeartHandshake } from "lucide-react";

import { useLanguage } from "@/lib/i18n/LanguageContext";

/**
 * CrisisSupportPanel — calm, humane, non-clinical support surface shown when
 * the CrisisGuard trips on a user's own free-text note.
 *
 * Renders translated copy + three plain-language help routes. It deliberately
 * does NOT continue the storytelling flow: the triggering note is never
 * persisted and never sent to the LLM. Country-agnostic by design — a local
 * emergency number is named generically (not hardcoded per country) and the
 * international findahelpline.com directory is offered as a selectable source
 * so users in any country can find their own local helpline.
 *
 * Layout/visual change is isolated to this panel; the surrounding page flow is
 * unchanged until the user dismisses.
 */
export function CrisisSupportPanel({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useLanguage();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.crisis.title}
      className="rounded-[2rem] border border-amber-200/30 bg-[#1f1a15]/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
    >
      <div className="flex items-start gap-3">
        <HeartHandshake className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" aria-hidden="true" />
        <div>
          <h3 className="text-lg font-semibold text-amber-100">{t.crisis.title}</h3>
          <p className="mt-2 text-base leading-relaxed text-amber-50/90">{t.crisis.body}</p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-border/50 bg-black/20 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-200/80">
          {t.crisis.supportHeading}
        </p>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-amber-50/90">
          <li>{t.crisis.trustedPerson}</li>
          <li>{t.crisis.emergency}</li>
          <li>
            {t.crisis.helplineDir}{" "}
            <a
              href="https://findahelpline.com"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2 text-amber-300 hover:text-amber-200"
            >
              findahelpline.com
            </a>
          </li>
        </ul>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="mt-5 w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground/5"
      >
        {t.crisis.dismiss}
      </button>
    </div>
  );
}
