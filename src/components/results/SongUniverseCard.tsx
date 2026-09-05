import React from "react";
import { Music2, Calendar, Sparkles } from "lucide-react";
import type { Song } from "@/lib/song/types";

export interface SongUniverseCardProps {
  song: Song;
  stageName?: string;
  vibeLabel?: string;
  stepNumber: number;
  temporalArcPosition?: number;
}

export const SongUniverseCard: React.FC<SongUniverseCardProps> = ({
  song,
  stageName = "Life Stage",
  vibeLabel = "Grounded Reflection",
  stepNumber,
  temporalArcPosition = 0,
}) => {
  const formattedStep = String(stepNumber).padStart(2, "0");

  return (
    <div
      data-testid={`song-universe-card-${stepNumber}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 sm:p-6"
    >
      <div className="space-y-4">
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-primary">
            Stage {formattedStep}
          </span>
          <span className="rounded-full border border-border/60 bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {stageName}
          </span>
        </div>

        {/* Real Album Artwork (Instant iTunes / verified cover) */}
        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border/40 bg-muted/30">
          {song.artworkUrl ? (
            <img
              src={song.artworkUrl}
              alt={`${song.title} cover`}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center text-muted-foreground/60">
              <Music2 className="h-10 w-10 stroke-[1.25]" />
              <span className="mt-2 text-xs font-medium">Original Artwork</span>
            </div>
          )}

          {/* Temporal Arc Badge */}
          <div className="absolute bottom-2.5 right-2.5 rounded-md bg-background/85 px-2 py-0.5 text-[10px] font-semibold text-foreground/90 backdrop-blur-md">
            {temporalArcPosition}% Arc
          </div>
        </div>

        {/* Song Info */}
        <div className="space-y-1">
          <h3 className="line-clamp-1 text-base font-bold text-foreground group-hover:text-primary transition-colors">
            {song.title}
          </h3>
          <p className="line-clamp-1 text-sm text-foreground/70">
            {song.artist || "Unknown Artist"}
          </p>
        </div>
      </div>

      {/* Footer Meta */}
      <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {song.releaseYear ?? "—"}
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-primary/90">
          <Sparkles className="h-3 w-3" />
          {vibeLabel}
        </span>
      </div>
    </div>
  );
};
