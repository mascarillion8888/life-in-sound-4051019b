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
import { ChevronRight } from "lucide-react";

import { SceneRoom } from "@/components/scene/SceneRoom";
import { Button } from "@/components/ui/button";
import { QuizCard } from "@/components/results/QuizCard";
import { sceneThemeFor } from "@/lib/art/sceneTheme";
import { type LifeCard } from "@/lib/soundmap/lifeCards";
import type { Song } from "@/lib/song/types";
import { eraThemeForYear } from "@/lib/visual/eraThemes";

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
  const eraTheme = eraThemeForYear(song?.releaseYear);
  return (
    <div
      data-testid={`era-reveal-${card.songIndex}`}
      data-scene={themeId}
      className="relative -mx-5 -my-10 flex aspect-[3/4] w-[calc(100%+2.5rem)] flex-col items-center overflow-y-auto px-5 sm:-mx-6 sm:w-[calc(100%+3rem)]"
    >
      {/* The fixed global room — shelves, desk, lamp — themed to the music.
                    Locked to a fixed 3:4 backdrop box (aspect-[3/4]) so the mood
                    wallpaper matches the produced asset 1:1 and never depends on
                    viewport height. If the card content exceeds the 3:4 box on
                    short/mobile viewports the wrapper scrolls (never clips). */}
      <SceneRoom
        themeId={themeId}
        mood={song?.mood ?? null}
        genre={song?.genre ?? null}
        releaseYear={song?.releaseYear ?? null}
      />

      <div className="relative z-10 my-auto flex flex-col items-center gap-6">
        {/* The card stands on the desk. */}
        <div className="relative isolate w-full max-w-xs animate-in fade-in zoom-in-95 duration-500">
          {eraTheme.overlayClasses && (
            <div aria-hidden="true" className={eraTheme.overlayClasses} />
          )}
          <QuizCard card={card} song={song} autoPlayPreview templateFile={null} />
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
