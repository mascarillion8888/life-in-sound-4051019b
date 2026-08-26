import { X } from "lucide-react";

import posterPreview from "@/assets/poster-preview.jpg";
import { resolvePosterTheme, type PosterTheme } from "@/lib/soundmap/posterTheme";

/**
 * Fullscreen poster preview. The frame re-casts the palette the poster-theme
 * engine resolved for the journey (metal border, background wash), so the
 * lightbox matches the Master Poster sheet and the high-res PNG export.
 */
export default function PosterLightbox({
  onClose,
  theme,
}: {
  onClose: () => void;
  theme?: PosterTheme;
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
        <img
          src={posterPreview}
          alt="Fullscreen cinematic poster of your personal SoundMap"
          className="max-h-[82vh] max-w-full rounded-[1.25rem] object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
