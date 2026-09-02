import { Check, Music } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Song } from "@/lib/song/types";

// Build a manual Song (provider: "manual") from free text. The typed string
// becomes the title; no artist/album/artwork is inferred. This is the ONLY
// song-entry path — the old MusicBrainz search dialog was removed from the UI
// (2026-08-19). Manual entries are enriched in the background by the
// server-side iTunes verification (`searchSong.server.ts`); the typed text
// itself is never rewritten.
function manualSong(text: string): Song {
  return {
    provider: "manual",
    providerId: crypto.randomUUID(),
    title: text,
    artist: "",
    album: null,
    artworkUrl: null,
    previewUrl: null,
    releaseYear: null,
    genre: null,
    mood: null,
    isrc: null,
  };
}

export function QuestionCard({
  number,
  title,
  description,
  answer,
  selected,
  verified,
  suggestions,
  onSelectSuggestion,
  draft,
  onDraftChange,
  onChoose,
}: {
  number: number;
  title: string;
  description: string;
  /** Title string shown while no structured selection is present (restore case). */
  answer?: string;
  /** Structured Song chosen for this question, when available. */
  selected?: Song | null;
  /** True only when iTunes verification matched this entry — renders the green check. */
  verified?: boolean;
  /** Live suggestion list (Spotify primary, iTunes fallback) shown as a dropdown. */
  suggestions?: Song[];
  /** Called when the user picks a suggestion from the dropdown. */
  onSelectSuggestion?: (song: Song) => void;
  /** Current text in the primary free-text box (owned by the parent). */
  draft: string;
  /** Update the primary free-text box. */
  onDraftChange: (text: string) => void;
  onChoose: (song: Song) => void;
}) {
  const { t } = useLanguage();
  const displayName = selected
    ? selected.artist
      ? `${selected.title} — ${selected.artist}`
      : selected.title
    : answer;
  const canConfirm = draft.trim().length > 0;

  return (
    <div className="w-full rounded-[2rem] border border-border/50 bg-card/60 p-6 backdrop-blur-xl sm:p-8 md:p-12">
      <div className="space-y-4">
        <span className="text-sm font-semibold uppercase tracking-widest text-primary">
          {t.journey.questionLabel} {number}
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
          {title}
        </h2>
        <p className="text-base leading-relaxed text-foreground/80 sm:text-lg">{description}</p>
      </div>

      {/* The ONLY song-entry path: free-text input + Ritüele Ekle. No search UI.
          The iTunes suggestion appears as translucent ghost text inside the
          input and is accepted with Tab / ArrowRight — never typed over. */}
      <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:items-stretch">
        <div className="relative flex-1">
          <Input
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canConfirm) {
                e.preventDefault();
                onChoose(manualSong(draft.trim()));
              }
            }}
            placeholder={t.questionCard.placeholder}
            aria-label={t.questionCard.inputAria}
            className="h-14 w-full rounded-2xl border-border/50 bg-background/60 pr-11 text-base sm:h-16"
          />
          {suggestions && suggestions.length > 0 ? (
            <ul
              role="listbox"
              aria-label={t.questionCard.suggestionsAria}
              className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-border/50 bg-card/95 shadow-xl backdrop-blur-xl"
            >
              {suggestions.map((song) => (
                <li key={song.providerId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/10"
                    onClick={() => onSelectSuggestion?.(song)}
                  >
                    {song.artworkUrl ? (
                      <img
                        src={song.artworkUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-md object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Music className="h-5 w-5" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {song.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {song.artist}
                        {song.releaseYear ? ` · ${song.releaseYear}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {verified ? (
            <Check
              aria-label={t.questionCard.recognizedAria}
              className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-500"
            />
          ) : null}
        </div>
        <Button
          onClick={() => onChoose(manualSong(draft.trim()))}
          disabled={!canConfirm}
          className="h-14 gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 active:scale-[0.98] sm:h-16 sm:w-auto"
        >
          <Check className="h-5 w-5" />
          {t.questionCard.addToRitual}
        </Button>
      </div>

      {displayName ? (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-primary">
          <Check className={`h-4 w-4 ${verified ? "text-emerald-500" : ""}`} />
          {displayName}
        </p>
      ) : null}
    </div>
  );
}
