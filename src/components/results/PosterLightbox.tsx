import { X } from "lucide-react";

import posterPreview from "@/assets/poster-preview.jpg";

export default function PosterLightbox({ onClose }: { onClose: () => void }) {
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
        className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-card/80 text-foreground shadow-lg sm:right-6 sm:top-6 backdrop-blur-md transition-transform hover:scale-105"
        aria-label="Close fullscreen poster"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={posterPreview}
        alt="Fullscreen cinematic poster of your personal SoundMap"
        className="max-h-[90vh] max-w-full rounded-[1.5rem] object-contain shadow-2xl shadow-primary/10"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
