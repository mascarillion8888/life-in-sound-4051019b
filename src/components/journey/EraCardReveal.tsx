/**
 * EraCardReveal — the step-by-step era card moment of the journey.
 *
 * Shown immediately after the user commits a song for an era: the dynamic
 * MTG-style Era Card (organic era-adaptive artwork, English narrative on the
 * card face) fades in and the 30-second preview starts automatically.
 * "Next Era / Continue" unmounts the card — the audio singleton fades out —
 * and hands control back to the journey to advance (or, after the eighth
 * card, to open the Master Poster).
 *
 * English-only by design: the card copy comes from the caller's English
 * LifeCard set (the full-English experience requirement).
 */
import { ChevronRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { QuizCard } from "@/components/results/QuizCard";
import { LIFE_CARD_COUNT, type LifeCard } from "@/lib/soundmap/lifeCards";
import type { Song } from "@/lib/song/types";

export function EraCardReveal({
  card,
  song,
  isLast,
  onContinue,
}: {
  card: LifeCard;
  /** The song just committed for this era — artwork + preview come only from here. */
  song: Song | null;
  isLast: boolean;
  /** Advance to the next era (or the Master Poster when isLast). */
  onContinue: () => void;
}) {
  return (
    <div
      data-testid={`era-reveal-${card.songIndex}`}
      className="flex w-full flex-col items-center gap-6"
    >
      <div className="space-y-2 text-center">
        <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-primary">
          <Sparkles className="h-4 w-4" />
          Era {card.songIndex} of {LIFE_CARD_COUNT}
        </span>
        <h2 className="font-serif text-2xl font-bold uppercase tracking-wide text-foreground sm:text-3xl">
          {card.eraTitle}
        </h2>
        <p className="text-sm text-muted-foreground">{card.ageRange}</p>
      </div>

      <div className="w-full max-w-xs animate-in fade-in zoom-in-95 duration-500">
        <QuizCard card={card} song={song} autoPlayPreview />
      </div>

      <Button
        onClick={onContinue}
        className="h-12 rounded-full px-8 text-base font-semibold shadow-lg shadow-primary/20"
      >
        {isLast ? "See Your Master Poster" : "Next Era / Continue"}
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
