import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { Dna, Film, Sparkles, Clock, Map, Maximize } from "lucide-react";

import { Button } from "@/components/ui/button";
import { questions } from "@/lib/questions";
import { loadJourney } from "@/lib/journey-storage";
import { AnimatedReveal } from "@/components/AnimatedReveal";
import { AIPersonalityCard } from "@/components/results/AIPersonalityCard";
import { PosterCanvas } from "@/components/results/PosterCanvas";
import { analyzeUserJourney } from "@/lib/ai/pipeline";
import { getQuestionEmotionLabels } from "@/lib/ai/questionEmotions";
import { generateStory } from "@/lib/llm/generateStory.server";
import { deterministicLifeStory } from "@/lib/llm/prompts";
import { deterministicPoeticAnalysis, type PoeticAnalysis } from "@/lib/llm/poetic-analyzer";
import { generatePoeticAnalysis } from "@/lib/llm/generateAnalysis.server";
import posterPreview from "@/assets/poster-preview.jpg";

const PosterLightbox = lazy(() => import("@/components/results/PosterLightbox"));

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Your SoundMap Results — SoundMap" },
      {
        name: "description",
        content:
          "Your personal SoundMap: a life story, your music DNA, an emotional timeline and a cinematic poster built from the eight songs that shaped you.",
      },
      { property: "og:title", content: "Your SoundMap Results — SoundMap" },
      {
        property: "og:description",
        content:
          "A life story, music DNA, emotional timeline and cinematic poster built from the eight songs that shaped you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Your SoundMap Results — SoundMap" },
      {
        name: "twitter:description",
        content:
          "A life story, music DNA, emotional timeline and cinematic poster built from the eight songs that shaped you.",
      },
    ],
  }),
  component: ResultsPage,
});

function SectionHeading({
  icon: Icon,
  eyebrow,
  title,
}: {
  icon: typeof Dna;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="space-y-3">
      <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-primary">
        <Icon className="h-4 w-4" />
        {eyebrow}
      </span>
      <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
        {title}
      </h2>
    </div>
  );
}

type StoryStatus = "idle" | "loading" | "ready" | "fallback";

/**
 * Life Story section — Sprint 014.
 *
 * 1. Deterministic profile is available immediately (always rendered as the
 *    fallback narrative while/if the LLM is unavailable).
 * 2. The server Story Engine is called once per distinct (songs + profile)
 *    fingerprint; duplicate calls within the same Results session are skipped.
 * 3. On success, the generated narrative replaces the fallback. On any failure
 *    or empty response, the deterministic narrative remains. The page never
 *    breaks because the LLM is unavailable.
 */
function LifeStory({
  profile,
  songs,
}: {
  profile: NonNullable<ReturnType<typeof analyzeUserJourney>>;
  songs: string[];
}) {
  const fallback = useMemo(() => deterministicLifeStory(songs), [songs]);

  // Stable fingerprint of the inputs — prevents duplicate LLM calls on re-render
  // for the same Results state. Kept client-side only; contains no secrets.
  const fingerprint = useMemo(
    () => JSON.stringify({ songs, archetype: profile.archetype }),
    [songs, profile.archetype],
  );

  const [story, setStory] = useState<string | null>(null);
  const [status, setStatus] = useState<StoryStatus>("idle");

  useEffect(() => {
    // Skip if we already have a story for these inputs, or are mid-flight.
    if (status !== "idle") return;
    let active = true;
    setStatus("loading");

    generateStory({ data: { profile, songs } })
      .then((result) => {
        if (!active) return;
        if (result && typeof result.story === "string" && result.story.length > 0) {
          setStory(result.story);
          setStatus("ready");
        } else {
          setStatus("fallback");
        }
      })
      .catch(() => {
        if (!active) return;
        setStatus("fallback");
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  const showFallback = status === "loading" || status === "idle" || status === "fallback";

  return (
    <section className="rounded-[2rem] border border-border/50 bg-card/60 p-6 backdrop-blur-xl sm:p-8 md:p-12">
      <SectionHeading icon={Sparkles} eyebrow="Chapter one" title="Life Story" />
      <div className="mt-8 space-y-5 text-base leading-relaxed text-foreground/80 sm:text-lg">
        {showFallback ? (
          fallback
            .split("\n\n")
            .map((paragraph, i) => <p key={i}>{highlightSongs(paragraph, songs)}</p>)
        ) : (
          <p className="whitespace-pre-line">{story}</p>
        )}
      </div>
    </section>
  );
}

/**
 * Dynamic Music Map section — renders the deterministic analysis immediately,
 * then upgrades it in place when the Gemini poetic analyzer responds. Follows
 * the same contract as LifeStory: fingerprinted single call, any failure keeps
 * the deterministic render, the page never breaks on provider errors.
 */
function DynamicMusicMap({
  profile,
  songs,
}: {
  profile: NonNullable<ReturnType<typeof analyzeUserJourney>>;
  songs: string[];
}) {
  const fallback = useMemo(() => deterministicPoeticAnalysis(profile, songs), [profile, songs]);
  const [analysis, setAnalysis] = useState<PoeticAnalysis>(fallback);

  const fingerprint = useMemo(
    () => JSON.stringify({ songs, archetype: profile.archetype }),
    [songs, profile.archetype],
  );

  useEffect(() => {
    setAnalysis(fallback);
    let active = true;
    generatePoeticAnalysis({ data: { profile, songs } })
      .then((result) => {
        if (active && result?.analysis) setAnalysis(result.analysis);
      })
      .catch(() => {
        /* deterministic render already on screen — nothing to do */
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  return (
    <section>
      <SectionHeading icon={Map} eyebrow="Your living map" title="Dynamic Music Map" />
      <div className="mt-8">
        <PosterCanvas analysis={analysis} songs={songs} />
      </div>
    </section>
  );
}

/** Highlight supplied song titles that appear in the deterministic fallback prose. */
function highlightSongs(paragraph: string, songs: string[]): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = paragraph;
  let key = 0;
  while (remaining.length > 0) {
    let earliest = -1;
    let matched: string | null = null;
    for (const song of songs) {
      if (!song) continue;
      const idx = remaining.indexOf(song);
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx;
        matched = song;
      }
    }
    if (earliest === -1 || !matched) {
      parts.push(remaining);
      break;
    }
    if (earliest > 0) parts.push(remaining.slice(0, earliest));
    parts.push(
      <span key={key++} className="text-primary">
        {matched}
      </span>,
    );
    remaining = remaining.slice(earliest + matched.length);
  }
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>{p}</span>
      ))}
    </>
  );
}

function ResultsPage() {
  const stateAnswers = useRouterState({
    select: (s) => (s.location.state as { answers?: Record<number, string> })?.answers,
  });
  const [storedAnswers, setStoredAnswers] = useState<Record<number, string>>({});
  const [posterOpen, setPosterOpen] = useState(false);

  // Fall back to saved progress when the page is reloaded or opened directly.
  useEffect(() => {
    const saved = loadJourney();
    if (saved) setStoredAnswers(saved.answers);
  }, []);

  // Close fullscreen poster with Escape.
  useEffect(() => {
    if (!posterOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPosterOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [posterOpen]);

  const answers = stateAnswers ?? storedAnswers;
  const songs = questions.map((q) => answers?.[q.id] ?? `Untitled track ${q.id}`);
  const profile = useMemo(() => analyzeUserJourney(answers), [answers]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 glow-gold opacity-60" />

      <main className="relative z-10 mx-auto max-w-4xl space-y-16 px-5 py-16 sm:px-6 md:space-y-24 md:py-32">
        <AnimatedReveal>
          <header className="space-y-5 text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">
              Your SoundMap
            </span>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-6xl">
              <span className="text-gold-gradient">Eight songs.</span>
              <br />
              One life, in sound.
            </h1>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-foreground/70 sm:text-lg">
              Everything below was shaped by the answers you just gave.
            </p>
          </header>
        </AnimatedReveal>

        {/* Life Story */}
        <AnimatedReveal>
          {profile ? (
            <LifeStory profile={profile} songs={songs} />
          ) : (
            <section className="rounded-[2rem] border border-border/50 bg-card/60 p-6 backdrop-blur-xl sm:p-8 md:p-12">
              <SectionHeading icon={Sparkles} eyebrow="Chapter one" title="Life Story" />
              <p className="mt-8 text-base text-muted-foreground sm:text-lg">
                Complete your journey to unlock your Life Story.
              </p>
            </section>
          )}
        </AnimatedReveal>

        {/* AI Personality */}
        <AnimatedReveal>
          <AIPersonalityCard profile={profile} />
        </AnimatedReveal>

        {/* Music DNA */}
        <AnimatedReveal>
          <section>
            <SectionHeading icon={Dna} eyebrow="Your signature" title="Music DNA" />
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                {
                  label: "Favorite emotions",
                  items: profile?.emotionalProfile ?? [],
                },
                {
                  label: "Music style",
                  items: profile?.music ? [profile.music.mood] : [],
                },
                {
                  label: "Recommended genres",
                  items: profile?.recommendedGenres ?? [],
                },
              ].map((group) => (
                <div
                  key={group.label}
                  className="rounded-[2rem] border border-border/50 bg-card/60 p-6 backdrop-blur-xl sm:p-8"
                >
                  <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </p>
                  <ul className="mt-6 space-y-3">
                    {group.items.map((item) => (
                      <li
                        key={item}
                        className="rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-center text-sm font-medium text-primary"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </AnimatedReveal>

        {/* Dynamic Music Map */}
        <AnimatedReveal>
          {profile ? <DynamicMusicMap profile={profile} songs={songs} /> : null}
        </AnimatedReveal>

        {/* Emotional Timeline */}
        <AnimatedReveal>
          <section>
            <SectionHeading icon={Clock} eyebrow="In order" title="Emotional Timeline" />
            <ol className="mt-10 space-y-6 border-l border-border/60 pl-7 sm:pl-8">
              {questions.map((q, i) => {
                const emotionLabels = getQuestionEmotionLabels(q.id);
                return (
                  <li key={q.id} className="relative">
                    <span className="absolute -left-[2.4rem] top-1.5 sm:-left-[2.65rem] flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-[0.7rem] font-semibold text-primary">
                      {i + 1}
                    </span>
                    <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                      {q.title}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground sm:text-xl">
                      {songs[i]}
                    </p>
                    {emotionLabels.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {emotionLabels.map((label) => (
                          <li
                            key={label}
                            className="rounded-full border border-primary/25 bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary"
                          >
                            {label}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>
        </AnimatedReveal>

        {/* Cinematic Poster */}
        <AnimatedReveal>
          <section>
            <SectionHeading icon={Film} eyebrow="Framed" title="Cinematic Poster" />
            <div className="group relative mt-8 overflow-hidden rounded-[2rem] border border-border/50 bg-card/60 p-4 backdrop-blur-xl">
              <img
                src={posterPreview}
                alt="Placeholder cinematic poster of your personal SoundMap"
                loading="lazy"
                className="w-full rounded-[1.5rem] object-cover"
              />
              <button
                onClick={() => setPosterOpen(true)}
                className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-card/80 text-foreground shadow-lg sm:right-6 sm:top-6 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-card md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                aria-label="View poster fullscreen"
              >
                <Maximize className="h-5 w-5" />
              </button>
              {profile?.poster ? (
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-6 pt-12">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                    {profile.poster.paletteLabel}
                  </p>
                  <h3 className="text-xl font-bold text-white sm:text-2xl">
                    {profile.poster.headline}
                  </h3>
                  <p className="text-sm text-white/80">{profile.poster.subheadline}</p>
                  {profile.poster.keywords.length > 0 ? (
                    <ul className="mt-1 flex flex-wrap gap-2">
                      {profile.poster.keywords.map((keyword) => (
                        <li
                          key={keyword}
                          className="rounded-full border border-white/30 bg-white/10 px-3 py-0.5 text-xs font-medium text-white"
                        >
                          {keyword}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              A printable poster of your SoundMap is coming soon.
            </p>
          </section>
        </AnimatedReveal>

        {/* Fullscreen Poster Overlay (lazy-loaded on demand) */}
        {posterOpen && (
          <Suspense fallback={null}>
            <PosterLightbox onClose={() => setPosterOpen(false)} />
          </Suspense>
        )}

        <AnimatedReveal>
          <div className="flex flex-col items-center gap-4 pb-8">
            <Button
              asChild
              className="h-14 rounded-full px-10 text-base font-semibold shadow-lg shadow-primary/20"
            >
              <Link to="/journey">Start again</Link>
            </Button>
            <Link
              to="/"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Back home
            </Link>
          </div>
        </AnimatedReveal>
      </main>
    </div>
  );
}
