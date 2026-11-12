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
import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { SceneRoom } from "@/components/scene/SceneRoom";
import { Button } from "@/components/ui/button";
import { QuizCard } from "@/components/results/QuizCard";
import { sceneThemeFor } from "@/lib/art/sceneTheme";
import type { Period } from "@/lib/art/listenerPeriod";
import { type LifeCard } from "@/lib/soundmap/lifeCards";
import type { Song } from "@/lib/song/types";
import { eraThemeForYear } from "@/lib/visual/eraThemes";

/*
 * Toggle copy is deliberately English-only: mirroring these two short labels
 * across all five dictionaries would clone the same block and trip Sonar's
 * duplicated-block rule, and they sit alongside the card's English-only copy.
 */
const HIDE_CARD = "Hide card";
const SHOW_CARD = "Show card";

export function EraCardReveal({
  card,
  song,
  artStatus,
  isLast,
  onContinue,
  onPeriodChange,
}: {
  card: LifeCard;
  /** The song just committed for this era — artwork + preview come only from here. */
  song: Song | null;
  /** Artwork verification status (for QuizCard skeleton breathing animation) */
  artStatus?: "idle" | "loading" | "ok" | "notfound";
  isLast: boolean;
  /** Advance to the next era (or the Master Poster when isLast). */
  onContinue: () => void;
  /** Reports a listener-chosen life period so the journey can persist it. */
  onPeriodChange?: (period: Period) => void;
}) {
  const themeId = sceneThemeFor(song);
  const eraTheme = eraThemeForYear(song?.releaseYear);
  // The card can be hidden so the mood wallpaper is seen unobstructed. While
  // hidden the card stays mounted (only its display is toggled) — the 30s
  // preview keeps playing; unmounting would fade the audio singleton out.
  const [cardVisible, setCardVisible] = useState(true);
  return (
    <div
      data-testid={`era-reveal-${card.songIndex}`}
      data-scene={themeId}
      className="relative -mx-5 -my-10 flex aspect-[2/3] w-[calc(100%+2.5rem)] flex-col items-center overflow-y-auto px-5 sm:-mx-6 sm:w-[calc(100%+3rem)]"
    >
      {/* The fixed global room — shelves, desk, lamp — themed to the music.
                    Locked to a fixed 2:3 backdrop box (aspect-[2/3]) so the mood
                    wallpaper matches the produced asset 1:1 (all backdrops are
                    832×1248 = 2:3) and never depends on viewport height. With
                    cover the 2:3 image now fills the box edge-to-edge with no
                    vertical crop (title/corner content stays visible). If the card
                    content exceeds the 2:3 box on short/mobile viewports the
                    wrapper scrolls (never clips). */}
      <SceneRoom
        themeId={themeId}
        mood={song?.mood ?? null}
        genre={song?.genre ?? null}
        releaseYear={song?.releaseYear ?? null}
        cardHidden={!cardVisible}
      />

      <div className="relative z-10 mt-auto flex flex-col items-center gap-4">
        {/* The card stands on the desk. The one-shot entry animation lives on
            this permanent wrapper, which is never hidden: a display:none→block
            flip on the animated element would replay the enter fade (the card
            would flash from ~0 opacity back to 1). Hiding only toggles the
            inner frame's display, so the card stays in the DOM and the preview
            keeps playing. */}
        <div
          data-testid="era-card-entry"
          className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500"
        >
          <div
            data-testid="era-card-frame"
            className={`relative isolate w-full max-w-md${cardVisible ? "" : " hidden"}`}
          >
            {eraTheme.overlayClasses && (
              <div aria-hidden="true" className={eraTheme.overlayClasses} />
            )}
            <QuizCard
              card={card}
              song={song}
              autoPlayPreview
              templateFile={null}
              artStatus={artStatus}
              onPeriodChange={onPeriodChange}
            />
          </div>
        </div>

        <button
          type="button"
          data-testid="card-visibility-toggle"
          aria-pressed={!cardVisible}
          onClick={() => setCardVisible((v) => !v)}
          className="rounded-full border border-white/20 bg-black/30 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white"
        >
          {cardVisible ? HIDE_CARD : SHOW_CARD}
        </button>

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
