import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { Dna, Film, Sparkles, Clock, Maximize, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { questions } from "@/lib/questions";
import { loadJourney } from "@/lib/journey-storage";
import { AnimatedReveal } from "@/components/AnimatedReveal";
import posterPreview from "@/assets/poster-preview.jpg";


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

const emotions = ["Nostalgia", "Longing", "Euphoria", "Tenderness"];
const styles = ["Cinematic pop", "Warm analog soul", "Late-night indie"];
const themes = ["Coming of age", "Love & loss", "Reinvention", "Belonging"];

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
  const songs = questions.map(
    (q) => answers?.[q.id] ?? `Untitled track ${q.id}`,
  );


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
        <section className="rounded-[2rem] border border-border/50 bg-card/60 p-6 backdrop-blur-xl sm:p-8 md:p-12">
          <SectionHeading icon={Sparkles} eyebrow="Chapter one" title="Life Story" />
          <div className="mt-8 space-y-5 text-base leading-relaxed text-foreground/80 sm:text-lg">
            <p>
              It begins with <span className="text-primary">{songs[0]}</span> — a
              sound from a version of you that had not yet learned to be careful.
              By the time <span className="text-primary">{songs[1]}</span> arrived,
              everything felt urgent, and music was the only language large enough
              for it.
            </p>
            <p>
              Then someone became a melody:{" "}
              <span className="text-primary">{songs[2]}</span>. And when things
              came apart, <span className="text-primary">{songs[3]}</span> held the
              weight for you until you could carry it again.
            </p>
            <p>
              You found your spine again in{" "}
              <span className="text-primary">{songs[4]}</span>, kept someone close
              through <span className="text-primary">{songs[5]}</span>, and changed
              direction to <span className="text-primary">{songs[6]}</span>. If the
              credits rolled tomorrow, they would roll over{" "}
              <span className="text-primary">{songs[7]}</span>.
            </p>
          </div>
        </section>
        </AnimatedReveal>

        {/* Music DNA */}
<AnimatedReveal>
        <section>
          <SectionHeading icon={Dna} eyebrow="Your signature" title="Music DNA" />
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              { label: "Favorite emotions", items: emotions },
              { label: "Music style", items: styles },
              { label: "Dominant life themes", items: themes },
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

        {/* Emotional Timeline */}
<AnimatedReveal>
        <section>
          <SectionHeading
            icon={Clock}
            eyebrow="In order"
            title="Emotional Timeline"
          />
          <ol className="mt-10 space-y-6 border-l border-border/60 pl-7 sm:pl-8">
            {questions.map((q, i) => (
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
              </li>
            ))}
          </ol>
        </section>
        </AnimatedReveal>

        {/* Cinematic Poster */}
        <AnimatedReveal>
          <section>
            <SectionHeading
              icon={Film}
              eyebrow="Framed"
              title="Cinematic Poster"
            />
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
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              A printable poster of your SoundMap is coming soon.
            </p>
          </section>
        </AnimatedReveal>

        {/* Fullscreen Poster Overlay */}
        {posterOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
            onClick={() => setPosterOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Fullscreen poster preview"
          >
            <button
              onClick={() => setPosterOpen(false)}
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
