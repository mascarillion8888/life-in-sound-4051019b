import { X } from "lucide-react";

import { GeneratedPoster } from "@/components/results/GeneratedPoster";
import type { PosterModel } from "@/lib/ai/types";
import type { PosterSong } from "@/lib/ai/posterRenderer";
import { resolvePosterTheme, type PosterTheme } from "@/lib/soundmap/posterTheme";

/**
 * Fullscreen poster preview. The frame re-casts the palette the poster-theme
 * engine resolved for the journey (metal border, background wash), so the
 * lightbox matches the Master Poster sheet and the high-res PNG export.
 *
 * The lightbox shows the REAL generated poster (from the same `ProfileModel`
 * the in-page GeneratedPoster renders) — never a static placeholder. When no
 * poster model has been produced yet, it shows a clear "generating" state
 * instead of silently showing wrong/empty content.
 */
export default function PosterLightbox({
  onClose,
  theme,
  model,
  songs,
  alt,
}: {
  onClose: () => void;
  theme?: PosterTheme;
  model?: PosterModel | null;
  songs?: PosterSong[];
  alt?: string;
}) {
  const resolved = theme ?? resolvePosterTheme({});
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen poster preview"
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-transform hover:scale-105 sm:right-6 sm:top-6"
        style={{
          borderColor: resolved.metalColor,
          background: `${resolved.primaryBg}cc`,
          color: resolved.metalHighlight,
        }}
        aria-label="Close fullscreen poster"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        data-testid="lightbox-frame"
        className="rounded-[1.75rem] border-2 p-2 shadow-2xl sm:p-3"
        style={{
          borderColor: resolved.metalColor,
          background: `linear-gradient(180deg, ${resolved.primaryBg} 0%, #000 100%)`,
          boxShadow: `0 0 60px ${resolved.metalColor}40`,
        }}
      >
        {model ? (
          <GeneratedPoster
            model={model}
            songs={songs ?? []}
            alt={alt ?? "Fullscreen cinematic poster of your personal SoundMap"}
            className="max-h-[82vh] max-w-full rounded-[1.25rem] object-contain"
          />
        ) : (
          <div
            data-testid="lightbox-generating"
            className="flex max-h-[82vh] min-h-[40vh] w-[72vw] max-w-[28rem] flex-col items-center justify-center gap-4 rounded-[1.25rem] p-8 text-center"
          >
            <span className="h-12 w-12 animate-pulse rounded-full bg-primary/20" />
            <p className="text-sm font-medium text-foreground/80">Poster is being generated…</p>
          </div>
        )}
      </div>
    </div>
  );
}