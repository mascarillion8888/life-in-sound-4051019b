import { createFileRoute, Link } from "@tanstack/react-router";
import { Dna, Heart, Image as ImageIcon } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";

import { AnimatedSection } from "@/components/AnimatedSection";
import { track, PRODUCT_EVENTS } from "@/lib/telemetry";

const HowItWorksSection = lazy(() => import("@/components/landing/HowItWorksSection"));
const PreviewSection = lazy(() => import("@/components/landing/PreviewSection"));
const WhyMusicSection = lazy(() => import("@/components/landing/WhyMusicSection"));
const FinalCTASection = lazy(() => import("@/components/landing/FinalCTASection"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SoundMap — Your Life. One Soundtrack." },
      {
        name: "description",
        content:
          "Discover the music that shaped your story and transform your memories into a beautiful visual journey with SoundMap.",
      },
      {
        property: "og:title",
        content: "SoundMap — Your Life. One Soundtrack.",
      },
      {
        property: "og:description",
        content:
          "Discover the music that shaped your story and transform your memories into a beautiful visual journey.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "SoundMap — Your Life. One Soundtrack.",
      },
      {
        name: "twitter:description",
        content:
          "Discover the music that shaped your story and transform your memories into a beautiful visual journey.",
      },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: Heart,
    title: "Life Story",
    description: "Discover the songs that defined your life.",
  },
  {
    icon: Dna,
    title: "Music DNA",
    description: "Reveal emotional patterns hidden in your favorite music.",
  },
  {
    icon: ImageIcon,
    title: "Personal Poster",
    description: "Generate a beautiful poster representing your life soundtrack.",
  },
];

function SectionFallback() {
  return <div className="min-h-[40vh]" aria-hidden="true" />;
}

function Header() {
  return (
    <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <div className="h-3.5 w-3.5 rounded-full bg-primary" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-foreground">SoundMap</span>
        <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Beta
        </span>
      </div>
      <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground sm:flex">
        <a href="#features" className="transition-colors hover:text-foreground">
          Features
        </a>
        <a href="#" className="transition-colors hover:text-foreground">
          About
        </a>
      </nav>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="flex flex-col items-center justify-center px-5 pb-12 pt-10 text-center sm:px-6 md:pb-24 md:pt-24 lg:pt-32">
      <h1 className="max-w-4xl text-4xl font-bold sm:text-5xl tracking-tight text-foreground md:text-7xl lg:text-8xl">
        <span className="block">Your Life.</span>
        <span className="block">
          One <span className="text-gold-gradient">Soundtrack.</span>
        </span>
      </h1>
      <p className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg md:mt-8 md:text-xl">
        Music doesn't just play in the background — it becomes part of who you are. Rediscover the
        songs that shaped your memories and identity, and turn them into a cinematic visual journey.
      </p>
      <Link
        to="/journey"
        className="mt-8 inline-flex w-full max-w-xs items-center justify-center rounded-full bg-primary px-8 py-4 text-base sm:mt-10 sm:w-auto sm:text-lg font-semibold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 active:scale-[0.98]"
      >
        Begin Your Journey
      </Link>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-5 pb-12 sm:px-6 md:pb-16 lg:px-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
        {features.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <AnimatedSection
              key={feature.title}
              delay={i * 100}
              className="group relative flex flex-col rounded-[2rem] border border-border bg-card/60 p-6 sm:p-8 backdrop-blur-xl transition-all hover:border-gold-subtle hover:bg-card/80 lg:p-10"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                <Icon className="h-7 w-7 text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="mt-6 text-xl font-semibold sm:mt-8 sm:text-2xl tracking-tight text-card-foreground">
                {feature.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
                {feature.description}
              </p>
            </AnimatedSection>
          );
        })}
      </div>
    </section>
  );
}

function Index() {
  // Content-free product instrumentation: the app was opened. No user content.
  useEffect(() => {
    track({
      event: PRODUCT_EVENTS.appOpened,
      timestamp: new Date().toISOString(),
    });
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 glow-gold" />
      <Header />
      <main className="relative z-10">
        <HeroSection />
        <FeaturesSection />
        <Suspense fallback={<SectionFallback />}>
          <HowItWorksSection />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <PreviewSection />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <WhyMusicSection />
        </Suspense>
        <Suspense fallback={<SectionFallback />}>
          <FinalCTASection />
        </Suspense>
      </main>
    </div>
  );
}
