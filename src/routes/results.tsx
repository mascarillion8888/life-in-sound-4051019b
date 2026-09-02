import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Dna, Film, Sparkles, Clock, Map, Maximize, Radio, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { questions } from "@/lib/questions";
import { loadJourney, type JourneyProgress } from "@/lib/journey-storage";
import { resetJourneySession } from "@/lib/reset-session";
import { useSession } from "@/lib/supabase/use-session";
import type { LifeFeedEntry, LifeFeedState } from "@/lib/life-feed";
import type { Song } from "@/lib/song/types";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { AnimatedReveal } from "@/components/AnimatedReveal";
import { AIPersonalityCard } from "@/components/results/AIPersonalityCard";
import { MasterPosterCanvas } from "@/components/results/MasterPosterCanvas";
import { LifeFeedSection } from "@/components/feed/LifeFeedSection";
import { analyzeUserJourney, generateGroundedAnalysis } from "@/lib/ai/pipeline";
import { getQuestionEmotionLabels } from "@/lib/ai/questionEmotions";
import { generateStory } from "@/lib/llm/generateStory.server";
import { deterministicLifeStory } from "@/lib/llm/prompts";
import { deterministicPoeticAnalysis, type PoeticAnalysis } from "@/lib/llm/poetic-analyzer";
import { generatePoeticAnalysis } from "@/lib/llm/generateAnalysis.server";
import { themeFromAnalysis } from "@/lib/soundmap/posterTheme";
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
  songs: songTitles,
}: {
  profile: NonNullable<ReturnType<typeof analyzeUserJourney>>;
  songs: string[];
}) {
  const { t } = useLanguage();
  const fallback = useMemo(() => deterministicLifeStory(songTitles), [songTitles]);

  // Stable fingerprint of the inputs — prevents duplicate LLM calls on re-render
  // for the same Results state. Kept client-side only; contains no secrets.
  const fingerprint = useMemo(
    () => JSON.stringify({ songs: songTitles, archetype: profile.archetype }),
    [songTitles, profile.archetype],
  );

  const [story, setStory] = useState<string | null>(null);
  const [status, setStatus] = useState<StoryStatus>("idle");

  useEffect(() => {
    // Skip if we already have a story for these inputs, or are mid-flight.
    if (status !== "idle") return;
    let active = true;
    setStatus("loading");

    generateStory({ data: { profile, songs: songTitles } })
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
      <SectionHeading
        icon={Sparkles}
        eyebrow={t.results.lifeStoryEyebrow}
        title={t.results.lifeStoryTitle}
      />
      <div className="mt-8 space-y-5 text-base leading-relaxed text-foreground/80 sm:text-lg">
        {showFallback ? (
          fallback
            .split("\n\n")
            .map((paragraph, i) => <p key={i}>{highlightSongs(paragraph, songTitles)}</p>)
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
  feedEntries,
}: {
  profile: NonNullable<ReturnType<typeof analyzeUserJourney>>;
  songs: Song[];
  feedEntries: LifeFeedEntry[];
}) {
  const { language, t } = useLanguage();
  const fallback = useMemo(
    () =>
      deterministicPoeticAnalysis(
        profile,
        songs.map((s) => s.title),
      ),
    [profile, songs],
  );
  const [analysis, setAnalysis] = useState<PoeticAnalysis>(fallback);

  const fingerprint = useMemo(
    () =>
      JSON.stringify({ songs: songs.map((s) => s.title), archetype: profile.archetype, language }),
    [songs, profile.archetype, language],
  );

  useEffect(() => {
    setAnalysis(fallback);
    let active = true;
    generatePoeticAnalysis({ data: { profile, songs: songs.map((s) => s.title), language } })
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
      <SectionHeading icon={Map} eyebrow={t.results.mapEyebrow} title={t.results.mapTitle} />
      <div className="mt-8">
        <MasterPosterCanvas analysis={analysis} songs={songs} feedEntries={feedEntries} />
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
  const [journey, setJourney] = useState<JourneyProgress | null>(null);
  const [feed, setFeed] = useState<LifeFeedState | null>(null);
  const [posterOpen, setPosterOpen] = useState(false);

  // Fall back to saved progress when the page is reloaded or opened directly.
  useEffect(() => {
    const saved = loadJourney();
    if (saved) {
      setStoredAnswers(saved.answers);
      setJourney(saved);
    }
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
  const songTitles = questions.map((q) => answers?.[q.id] ?? `Untitled track ${q.id}`);
  const songs = questions.map(
    (q) =>
      journey?.songs?.[q.id] ?? {
        provider: "manual" as const,
        providerId: `manual-${q.id}`,
        title: answers?.[q.id] ?? `Untitled track ${q.id}`,
        artist: "",
        album: null,
        artworkUrl: null,
        previewUrl: null,
        releaseYear: null,
        genre: null,
        mood: null,
        isrc: null,
      },
  );
  const profile = useMemo(() => analyzeUserJourney(answers), [answers]);
  // Grounded P0/P2/P3 analysis — deterministic master-gap engines fed from the
  // journey Song[] selection (not just title strings). Never blocks the page:
  // the try/catch falls back to null when the journey is empty.
  const grounded = useMemo(() => {
    try {
      return generateGroundedAnalysis(songs);
    } catch {
      return null;
    }
  }, [songs]);
  // Same deterministic fallback DynamicMusicMap uses — the lightbox frame and
  // the sheet paint the same palette.
  const posterTheme = useMemo(
    () =>
      profile
        ? themeFromAnalysis(
            deterministicPoeticAnalysis(
              profile,
              songs.map((s) => s.title),
            ),
            songs,
          )
        : undefined,
    [profile, songs],
  );
  const { t } = useLanguage();
  const navigate = useNavigate();
  const session = useSession();

  // Always-available clean restart: wipes the journey (local + remote), the
  // Life Feed and every cached artifact, then lands on Question 1 of 8.
  const startOver = () => {
    const userId = session.status === "anonymous" && session.user ? session.user.id : null;
    void resetJourneySession(userId);
    void navigate({ to: "/journey", search: { fresh: undefined } });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 glow-gold opacity-60" />
      <div className="absolute right-5 top-5 z-20 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>

      <main className="relative z-10 mx-auto max-w-4xl space-y-16 px-5 py-16 sm:px-6 md:space-y-24 md:py-32">
        <AnimatedReveal>
          <header className="space-y-5 text-center">
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">
              {t.results.yourSoundmap}
            </span>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl md:text-6xl">
              <span className="text-gold-gradient">{t.results.heroAccent}</span>
              <br />
              {t.results.heroTagline}
            </h1>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-foreground/70 sm:text-lg">
              {t.results.heroSub}
            </p>
          </header>
        </AnimatedReveal>

        {/* Life Story */}
        <AnimatedReveal>
          {profile ? (
            <LifeStory profile={profile} songs={songTitles} />
          ) : (
            <section className="rounded-[2rem] border border-border/50 bg-card/60 p-6 backdrop-blur-xl sm:p-8 md:p-12">
              <SectionHeading
                icon={Sparkles}
                eyebrow={t.results.lifeStoryEyebrow}
                title={t.results.lifeStoryTitle}
              />
              <p className="mt-8 text-base text-muted-foreground sm:text-lg">
                {t.results.lifeStoryLocked}
              </p>
            </section>
          )}
        </AnimatedReveal>

        {/* AI Personality */}
        <AnimatedReveal>
          <AIPersonalityCard profile={profile} />
        </AnimatedReveal>

        {/* Music DNA — grounded P0 row (era distribution / diversity / vibe)
                sits above the original personality triad when the journey
                carries at least one selection. */}
        <AnimatedReveal>
          <section>
            <SectionHeading icon={Dna} eyebrow={t.results.dnaEyebrow} title={t.results.dnaTitle} />
            {grounded ? (
              <div data-testid="grounded-music-dna" className="mt-8 grid gap-6 md:grid-cols-3">
                <div className="rounded-[2rem] border border-border/50 bg-card/60 p-6 backdrop-blur-xl sm:p-8">
                  <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    Primary Era
                  </p>
                  <p className="mt-6 text-2xl font-bold text-foreground">
                    {grounded.dna.temporalPattern.primaryEra}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {grounded.dna.temporalPattern.spanYears}-year sonic journey
                  </p>
                </div>
                <div className="rounded-[2rem] border border-border/50 bg-card/60 p-6 backdrop-blur-xl sm:p-8">
                  <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    Artist Diversity
                  </p>
                  <p className="mt-6 text-2xl font-bold text-foreground">
                    {grounded.dna.musicalIdentity.diversityScore}%
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {grounded.dna.musicalIdentity.topArtists.join(", ") || "—"}
                  </p>
                </div>
                <div className="rounded-[2rem] border border-border/50 bg-card/60 p-6 backdrop-blur-xl sm:p-8">
                  <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    Dominant Vibe
                  </p>
                  <p className="mt-6 text-2xl font-bold text-foreground">
                    {grounded.dna.musicalIdentity.dominantVibe}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {grounded.dna.songCount}-track soundtrack
                  </p>
                </div>
              </div>
            ) : null}
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                {
                  label: t.results.favoriteEmotions,
                  items: profile?.emotionalProfile ?? [],
                },
                {
                  label: t.results.musicStyle,
                  items: profile?.music ? [profile.music.mood] : [],
                },
                {
                  label: t.results.recommendedGenres,
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

        {/* Dynamic Music Map — evolves with the Life Feed */}
        <AnimatedReveal>
          {profile ? (
            <DynamicMusicMap profile={profile} songs={songs} feedEntries={feed?.entries ?? []} />
          ) : null}
        </AnimatedReveal>

        {/* Life Feed — the unrestricted post-journey timeline */}
        <AnimatedReveal>
          <section>
            <SectionHeading
              icon={Radio}
              eyebrow={t.results.feedEyebrow}
              title={t.results.feedTitle}
            />
            <div className="mt-8">
              <LifeFeedSection journey={journey} onFeedChange={setFeed} />
            </div>
          </section>
        </AnimatedReveal>

        {/* Grounded Emotional Timeline — time-tracked P3 nodes (valency,
            intensity, vibeLabel, stage, song + artist) with trajectory and
            peak pinned inside. Falls back to the original question-row when
            no grounded nodes exist. */}
        <AnimatedReveal>
          <section>
            <SectionHeading
              icon={Clock}
              eyebrow={t.results.timelineEyebrow}
              title={t.results.timelineTitle}
            />
            {grounded ? (
              <ol
                data-testid="grounded-emotional-timeline"
                className="mt-10 space-y-6 border-l border-border/60 pl-7 sm:pl-8"
              >
                {grounded.timeline.nodes.map((node) => (
                  <li key={node.stageName} className="relative">
                    <span className="absolute -left-[2.4rem] top-1.5 sm:-left-[2.65rem] flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-[0.7rem] font-semibold text-primary">
                      {node.temporalArcPosition}
                    </span>
                    <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
                      {node.stageName} · {node.vibeLabel}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground sm:text-xl">
                      {node.artistName ? `${node.artistName} — ` : ""}
                      {node.songTitle}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Intensity {node.intensity}/10 · Valency {node.valency.toFixed(1)}
                    </p>
                  </li>
                ))}
              </ol>
            ) : null}
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
                      {songTitles[i]}
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
            <SectionHeading
              icon={Film}
              eyebrow={t.results.posterEyebrow}
              title={t.results.posterTitle}
            />
            <div className="group relative mt-8 overflow-hidden rounded-[2rem] border border-border/50 bg-card/60 p-4 backdrop-blur-xl">
              <img
                src={posterPreview}
                alt={t.results.posterAlt}
                loading="lazy"
                className="w-full rounded-[1.5rem] object-cover"
              />
              <button
                onClick={() => setPosterOpen(true)}
                className="absolute right-4 top-4 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-card/80 text-foreground shadow-lg sm:right-6 sm:top-6 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-card md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                aria-label={t.results.posterFullscreenAria}
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
            <PosterLightbox theme={posterTheme} onClose={() => setPosterOpen(false)} />
          </Suspense>
        )}

        <AnimatedReveal>
          <div className="flex flex-col items-center gap-4 pb-8">
            <Button
              onClick={startOver}
              className="h-14 rounded-full px-10 text-base font-semibold shadow-lg shadow-primary/20"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Start Over — New Journey
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
