import { Heart, Music, Sparkles } from "lucide-react";

import { AnimatedSection } from "@/components/AnimatedSection";

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
    <div className="flex items-start gap-4 rounded-2xl border border-border/50 bg-card/40 p-5 sm:p-6 backdrop-blur-xl transition-all hover:border-gold-subtle hover:bg-card/60">
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

export default function WhyMusicSection() {
  return (
    <section
      id="why-music"
      className="relative mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-24 lg:px-8"
    >
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-20">
        <AnimatedSection>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            The Science
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl lg:text-5xl">
            Why Music?
          </h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
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
