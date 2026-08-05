import { AnimatedSection } from "@/components/AnimatedSection";

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

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 glow-gold opacity-40" />
      <AnimatedSection className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          How it Works
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl lg:text-5xl">
          Three steps to your personal SoundMap
        </h2>
      </AnimatedSection>

      <div className="mt-10 grid grid-cols-1 gap-6 md:mt-16 md:grid-cols-3 md:gap-8">
        {steps.map((step, i) => (
          <AnimatedSection
            key={step.number}
            delay={150 + i * 120}
            className="relative"
          >
            <div className="flex h-full flex-col rounded-[2rem] border border-border/50 bg-card/40 p-6 sm:p-8 backdrop-blur-xl transition-all hover:border-gold-subtle hover:bg-card/60 lg:p-10">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="text-lg font-bold">{step.number}</span>
              </div>
              <h3 className="mt-6 text-xl font-semibold sm:mt-8 sm:text-2xl tracking-tight text-card-foreground">
                {step.title}
              </h3>
              <p className="mt-3 flex-1 text-base leading-relaxed text-muted-foreground sm:text-lg">
                {step.description}
              </p>
            </div>
          </AnimatedSection>
        ))}
      </div>
    </section>
  );
}
