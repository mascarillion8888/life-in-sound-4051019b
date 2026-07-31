import { createFileRoute, Link } from "@tanstack/react-router";
import { Dna, Heart, Image as ImageIcon, Music, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import posterPreview from "@/assets/poster-preview.jpg";
import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/use-in-view";

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

const steps = [
  {
    number: "01",
    title: "Choose your songs",
    description:
      "Select 8 songs that changed your life — the moments, people, and emotions tied to each one.",
  },
  {
    number: "02",
    title: "Answer 8 questions",
    description:
      "Reflect on meaningful questions about your memories, feelings, and the identity behind your music.",
  },
  {
    number: "03",
    title: "Receive your SoundMap",
    description:
      "Get your complete personal artwork including Life Story, Music DNA, Emotional Timeline, and a Cinematic Poster.",
  },
];

const reasons = [
  {
    icon: Heart,
    title: "Emotion",
    text: "Music encodes feelings directly into memory.",
  },
  {
    icon: Music,
    title: "Memory",
    text: "Songs trigger vivid, autobiographical recall.",
  },
  {
    icon: Sparkles,
    title: "Identity",
    text: "Your soundtrack reveals who you are becoming.",
  },
];

function AnimatedSection({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const hidden = ready && !inView;

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-1000 ease-out will-change-transform",
        hidden ? "opacity-0 translate-y-12" : "opacity-100 translate-y-0",
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Header() {
  return (
    <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-8 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
          <div className="h-3.5 w-3.5 rounded-full bg-primary" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-foreground">
          SoundMap
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
    <section className="flex flex-col items-center justify-center px-6 pb-16 pt-16 text-center md:pb-24 md:pt-24 lg:pt-32">
      <h1 className="max-w-4xl text-5xl font-bold tracking-tight text-foreground md:text-7xl lg:text-8xl">
        <span className="block">Your Life.</span>
        <span className="block">
          One <span className="text-gold-gradient">Soundtrack.</span>
        </span>
      </h1>
      <p className="mt-8 max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl">
        Music doesn't just play in the background — it becomes part of who you
        are. Rediscover the songs that shaped your memories and identity, and
        turn them into a cinematic visual journey.
      </p>
      <Link
        to="/journey"
        className="mt-10 inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 active:scale-[0.98]"
      >
        Begin Your Journey
      </Link>
    </section>
  );
}


function FeaturesSection() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 pb-16 lg:px-8">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
        {features.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <AnimatedSection
              key={feature.title}
              delay={i * 100}
              className="group relative flex flex-col rounded-[2rem] border border-border bg-card/60 p-8 backdrop-blur-xl transition-all hover:border-gold-subtle hover:bg-card/80 lg:p-10"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 transition-colors group-hover:bg-primary/15">
                <Icon className="h-7 w-7 text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="mt-8 text-2xl font-semibold tracking-tight text-card-foreground">
                {feature.title}
              </h3>
              <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </AnimatedSection>
          );
        })}
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative mx-auto max-w-7xl px-6 py-24 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 glow-gold opacity-40" />
      <AnimatedSection className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          How it Works
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
          Three steps to your personal SoundMap
        </h2>
      </AnimatedSection>

      <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
        {steps.map((step, i) => (
          <AnimatedSection
            key={step.number}
            delay={150 + i * 120}
            className="relative"
          >
            <div className="flex h-full flex-col rounded-[2rem] border border-border/50 bg-card/40 p-8 backdrop-blur-xl transition-all hover:border-gold-subtle hover:bg-card/60 lg:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="text-lg font-bold">{step.number}</span>
              </div>
              <h3 className="mt-8 text-2xl font-semibold tracking-tight text-card-foreground">
                {step.title}
              </h3>
              <p className="mt-3 flex-1 text-lg leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          </AnimatedSection>
        ))}
      </div>
    </section>
  );
}

function PreviewSection() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 py-24 lg:px-8">
      <AnimatedSection className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] border border-border/50 bg-card/20 shadow-2xl">
        <div className="group relative aspect-square md:aspect-[16/10]">
          <img
            src={posterPreview}
            alt="Example SoundMap poster"
            width={1024}
            height={1024}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover blur-2xl transition-all duration-1000 group-hover:blur-xl group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/40 transition-colors duration-700 group-hover:bg-black/30" />
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-8 py-5 text-center backdrop-blur-md md:px-12 md:py-6">
              <p className="text-xl font-medium text-foreground md:text-3xl">
                Your story could look like this.
              </p>
            </div>
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
}

function ReasonCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Heart;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur-xl transition-all hover:border-gold-subtle hover:bg-card/60">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
        <Icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
      </div>
      <div>
        <h3 className="text-xl font-semibold text-card-foreground">{title}</h3>
        <p className="mt-1 text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function WhyMusicSection() {
  return (
    <section
      id="why-music"
      className="relative mx-auto max-w-7xl px-6 py-24 lg:px-8"
    >
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <AnimatedSection>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            The Science
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
            Why Music?
          </h2>
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-muted-foreground">
            <p>
              Music is one of the most powerful triggers of autobiographical
              memory. Neuroscience shows that when you hear a song tied to a
              meaningful moment, your brain activates the hippocampus — where
              memories live — and the amygdala, where emotions are processed.
            </p>
            <p>
              This unique connection is why a single melody can instantly
              transport you back to a person, a place, or a version of yourself
              you thought you had lost. SoundMap honors this connection by
              turning your music into a living visual story of who you are.
            </p>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={200} className="grid gap-4">
          {reasons.map((reason) => (
            <ReasonCard key={reason.title} {...reason} />
          ))}
        </AnimatedSection>
      </div>
    </section>
  );
}

function FinalCTASection() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 pb-32 pt-16 lg:px-8">
      <AnimatedSection className="relative overflow-hidden rounded-[2.5rem] border border-border/50 bg-card/30 p-12 text-center backdrop-blur-xl md:p-20">
        <div className="pointer-events-none absolute inset-0 glow-gold opacity-50" />
        <div className="relative z-10">
          <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Ready to discover your soundtrack?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Your memories are already playing. Let’s make them visible.
          </p>
          <Link
            to="/journey"
            className="mt-10 inline-flex items-center justify-center rounded-full bg-primary px-10 py-5 text-lg font-semibold text-primary-foreground shadow-2xl shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/40 active:scale-[0.98]"
          >
            Begin Your Journey
          </Link>
        </div>
      </AnimatedSection>
    </section>
  );
}

function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 glow-gold" />
      <Header />
      <main className="relative z-10">
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PreviewSection />
        <WhyMusicSection />
        <FinalCTASection />
      </main>
    </div>
  );
}
