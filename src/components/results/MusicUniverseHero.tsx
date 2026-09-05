import React from "react";
import { Disc3, Compass, Sparkles, Radio } from "lucide-react";
import type { MusicDNA } from "@/types/musicDna";

export interface MusicUniverseHeroProps {
  dna: MusicDNA | null;
  songCount: number;
  primaryEra?: string;
  dominantVibe?: string;
}

export const MusicUniverseHero: React.FC<MusicUniverseHeroProps> = ({
  dna,
  songCount,
  primaryEra,
  dominantVibe,
}) => {
  const era = primaryEra || dna?.temporalPattern?.primaryEra || "Timeless";
  const vibe = dominantVibe || dna?.musicalIdentity?.dominantVibe || "Eclectic Explorer";
  const span = dna?.temporalPattern?.spanYears ?? 0;
  const diversity = dna?.musicalIdentity?.diversityScore ?? 100;
  const topArtists = dna?.musicalIdentity?.topArtists ?? [];

  return (
    <section
      data-testid="music-universe-hero"
      className="relative overflow-hidden rounded-[2.5rem] border border-border/60 bg-gradient-to-b from-card/80 via-card/50 to-background/90 p-8 shadow-2xl backdrop-blur-2xl sm:p-12 md:p-16"
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl" />

      <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Music Universe
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/60 px-3 py-1 text-xs font-medium text-foreground/80">
              <Radio className="h-3 w-3 text-primary" />
              {era} Era
            </span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            A sonic tapestry anchored in <span className="text-gold-gradient">{era}</span>
          </h2>

          <p className="text-sm leading-relaxed text-foreground/75 sm:text-base">
            Your life soundtrack weaves through{" "}
            {span > 0 ? `${span} years of musical evolution` : "a spectrum of eras"}, expressing a{" "}
            <strong className="font-semibold text-foreground">{vibe}</strong> identity.
            {topArtists.length > 0 && <> Guided by voices like {topArtists.join(", ")}.</>}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:w-80">
          <div className="rounded-2xl border border-border/50 bg-background/50 p-4 text-center backdrop-blur-md">
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Disc3 className="h-4 w-4" />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{songCount}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Key Anthems</p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-background/50 p-4 text-center backdrop-blur-md">
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Compass className="h-4 w-4" />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{diversity}%</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Diversity</p>
          </div>
        </div>
      </div>
    </section>
  );
};
