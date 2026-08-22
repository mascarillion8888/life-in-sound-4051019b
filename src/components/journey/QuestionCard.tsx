import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ghostCompletion,
  onGhostAccept,
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
  /** Full iTunes suggestion that extends the current draft (ghost-text completion). */
  ghostCompletion?: string | null;
  /** Called when the user accepts the ghost completion (Tab / ArrowRight). */
  onGhostAccept?: () => void;
  /** Current text in the primary free-text box (owned by the parent). */
  draft: string;
  /** Update the primary free-text box. */
  onDraftChange: (text: string) => void;
  onChoose: (song: Song) => void;
}) {
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
          Question {number}
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
              if ((e.key === "Tab" || e.key === "ArrowRight") && ghostCompletion) {
                e.preventDefault();
                onGhostAccept?.();
                return;
              }
              if (e.key === "Enter" && canConfirm) {
                e.preventDefault();
                onChoose(manualSong(draft.trim()));
              }
            }}
            placeholder="örn. Bad - Michael Jackson"
            aria-label="Şarkı ve sanatçı adını yaz"
            className="h-14 w-full rounded-2xl border-border/50 bg-background/60 pr-11 text-base sm:h-16"
          />
          {ghostCompletion ? (
            <>
              {/* Invisible full-width text sets the exact overlay position. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex h-14 items-center truncate rounded-2xl px-3 py-1 pr-11 text-base opacity-0 sm:h-16"
              >
                {ghostCompletion}
              </span>
              {/* Visible, high-contrast silver suffix aligned right after the typed text. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex h-14 items-center truncate rounded-2xl px-3 py-1 pr-11 text-base opacity-100 sm:h-16"
                style={{ color: "#a1a1aa" }}
              >
                <span className="invisible">{draft}</span>
                {ghostCompletion.slice(draft.length)}
              </span>
            </>
          ) : null}
          {verified ? (
            <Check
              aria-label="tanındı"
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
          Ritüele Ekle
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
