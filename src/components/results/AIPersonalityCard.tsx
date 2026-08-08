import { Brain } from "lucide-react";

import type { PersonalityProfile } from "@/lib/ai/types";

export function AIPersonalityCard({
  profile,
}: {
  profile: PersonalityProfile | null;
}) {
  if (!profile) {
    return (
      <section className="rounded-[2rem] border border-border/50 bg-card/60 p-6 text-center backdrop-blur-xl sm:p-8 md:p-12">
        <p className="text-base text-muted-foreground">
          No journey data available yet — complete your journey to unlock your
          personality profile.
        </p>
      </section>
    );
  }

  const confidencePct = Math.round((profile.confidence ?? 0) * 100);

  return (
    <section className="rounded-[2rem] border border-border/50 bg-card/60 p-6 backdrop-blur-xl sm:p-8 md:p-12">
      <div className="space-y-3">
        <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-primary">
          <Brain className="h-4 w-4" />
          Personality
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
          {profile.archetype}
        </h2>
        <p className="text-lg font-medium text-primary">{profile.title}</p>
      </div>

      <p className="mt-6 text-base leading-relaxed text-foreground/80 sm:text-lg">
        {profile.description}
      </p>

      {profile.poeticSummary ? (
        <p className="mt-6 border-l border-primary/40 pl-5 text-base italic leading-relaxed text-foreground/70">
          {profile.poeticSummary}
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Emotional profile
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {(profile.emotionalProfile ?? []).map((item) => (
              <li
                key={item}
                className="rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
              >
                {item}
              </li>
            ))}
          </ul>

          <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Traits
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {(profile.traits ?? []).map((item) => (
              <li
                key={item}
                className="rounded-full border border-border/60 px-4 py-1.5 text-sm font-medium text-foreground/80"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Music profile
          </p>
          <p className="mt-4 text-base leading-relaxed text-foreground/80">
            {profile.musicProfile}
          </p>

          <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Recommended genres
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {(profile.recommendedGenres ?? []).map((item) => (
              <li
                key={item}
                className="rounded-full border border-primary/25 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="font-semibold uppercase tracking-widest">
            Confidence
          </span>
          <span className="font-semibold text-primary">{confidencePct}%</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border/50">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${confidencePct}%` }}
          />
        </div>
      </div>
    </section>
  );
}

export default AIPersonalityCard;
