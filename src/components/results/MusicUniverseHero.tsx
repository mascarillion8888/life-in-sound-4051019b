import { Sparkles } from "lucide-react";

import type { PersonalityProfile } from "@/lib/ai/types";
import type { Song } from "@/lib/song/types";
import type { MusicDNA } from "@/types/musicDna";

interface MusicUniverseHeroProps {
  profile: PersonalityProfile | null;
  grounded: { dna: MusicDNA } | null;
  songs: Song[];
  title?: string;
  subtitle?: string;
}

/**
 * MusicUniverseHero — the visual entry point into the song universes.
 *
 * Uses only existing result-page data (personality profile + grounded Music DNA +
 * the 8-song selection) — no network calls, no AI generation, no invented
 * metadata. Deterministic: identical input always renders identically.
 *
 * Background (the "World") ring on the grounded era/data;the card grid that
 * follows renders the artifacts in front of it. Grounded data may be absent
 * for a fresh journey — the hero degrades gracefully to the profile-only state.
 */
export function MusicUniverseHero({
  profile,
  grounded,
  songs,
  title = "Your Music Universe",
  subtitle = "Eight songs. Eight worlds. One soundtrack.",
}: MusicUniverseHeroProps) {
  const primaryEra = grounded?.dna.temporalPattern.primaryEra ?? null;
  const spanYears = grounded?.dna.temporalPattern.spanYears ?? null;
  const dominantVibe = grounded?.dna.musicalIdentity.dominantVibe ?? null;
  const diversityScore = grounded?.dna.musicalIdentity.diversityScore ?? null;
  const archetype = profile?.archetype ?? null;

  return (
    <section
      aria-label="Your Music Universe"
      className="relative overflow-hidden rounded-[2rem] border border-border/50 bg-card/60 p-8 backdrop-blur-xl sm:p-10 md:p-14"
      data-testid="music-universe-hero"
    >
      {/* Cinematic atmosphere — the World behind the cards. No fabricated imagery. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(216,166,90,0.16), transparent 55%), radial-gradient(ellipse at 80% 80%, rgba(96,72,148,0.12), transparent 50%)",
        }}
      />

      <div className="relative space-y-4">
        <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-primary">
          <Sparkles className="h-4 w-4" />
          {title}
        </span>

        {archetype ? (
          <p className="text-sm font-medium text-muted-foreground">{archetype}</p>
        ) : null}

        <h2 className="max-w-3xl text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
          {subtitle}
        </h2>

        {grounded ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {primaryEra ? (
              <span className="rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                {primaryEra}
              </span>
            ) : null}
            {spanYears !== null ? (
              <span className="rounded-full border border-border/60 px-4 py-1.5 text-sm font-medium text-foreground/80">
                {spanYears}-year span
              </span>
            ) : null}
            {dominantVibe ? (
              <span className="rounded-full border border-border/60 px-4 py-1.5 text-sm font-medium text-foreground/80">
                {dominantVibe}
              </span>
            ) : null}
            {diversityScore !== null ? (
              <span className="rounded-full border border-border/60 px-4 py-1.5 text-sm font-medium text-foreground/80">
                {diversityScore}% artist diversity
              </span>
            ) : null}
          </div>
        ) : null}

        {songs.length ? (
          <p className="pt-2 text-sm text-muted-foreground">
            {songs.length} songs discovered — plunge into each universe below.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default MusicUniverseHero;
