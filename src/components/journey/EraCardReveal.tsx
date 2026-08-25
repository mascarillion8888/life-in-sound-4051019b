/**
 * EraCardReveal — the step-by-step era card moment of the journey.
 *
 * Shown immediately after the user commits a song for an era: the card
 * stands on the desk of the global library room (`SceneRoom`), themed to
 * the song's scene family, while the 30-second preview starts automatically.
 * "Next Era / Continue" unmounts the card — the audio singleton fades out —
 * and hands control back to the journey to advance (or, after the eighth
 * card, to open the Master Poster).
 *
 * English-only by design: the card copy is generated per-track in English
 * (the full-English experience requirement).
 */
import { ChevronRight, Sparkles } from "lucide-react";

import { SceneRoom } from "@/components/scene/SceneRoom";
import { Button } from "@/components/ui/button";
import { QuizCard } from "@/components/results/QuizCard";
import { sceneThemeFor } from "@/lib/art/sceneTheme";
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
  const themeId = sceneThemeFor(song);
  return (
    <div
      data-testid={`era-reveal-${card.songIndex}`}
      data-scene={themeId}
      className="relative -mx-5 -my-10 flex min-h-[calc(100vh-8rem)] w-[calc(100%+2.5rem)] flex-col items-center justify-center gap-6 px-5 py-10 sm:-mx-6 sm:w-[calc(100%+3rem)]"
    >
      {/* The fixed global room — shelves, desk, lamp — themed to the music. */}
      <SceneRoom themeId={themeId} />

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="space-y-2 text-center">
          <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="h-4 w-4" />
            Era {card.songIndex} of {LIFE_CARD_COUNT}
          </span>
          <h2 className="text-2xl font-bold uppercase tracking-wide text-foreground sm:text-3xl">
            {card.eraTitle}
          </h2>
          <p className="text-sm uppercase tracking-wider text-muted-foreground">{card.ageRange}</p>
        </div>

        {/* The card stands on the desk. */}
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
    </div>
  );
}
