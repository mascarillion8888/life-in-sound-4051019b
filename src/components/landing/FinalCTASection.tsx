import { Link } from "@tanstack/react-router";

import { AnimatedSection } from "@/components/AnimatedSection";

export default function FinalCTASection() {
  return (
    <section className="relative mx-auto max-w-7xl px-5 pb-20 pt-8 sm:px-6 md:pb-32 md:pt-16 lg:px-8">
      <AnimatedSection className="relative overflow-hidden rounded-[2.5rem] border border-border/50 bg-card/30 p-7 text-center backdrop-blur-xl sm:p-12 md:p-20">
        <div className="pointer-events-none absolute inset-0 glow-gold opacity-50" />
        <div className="relative z-10">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-5xl lg:text-6xl">
            Ready to discover your soundtrack?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Your memories are already playing. Let’s make them visible.
          </p>
          <Link
            to="/journey"
            search={{ fresh: true }}
            className="mt-8 inline-flex w-full max-w-xs items-center justify-center rounded-full bg-primary px-8 py-4 text-base sm:mt-10 sm:w-auto sm:px-10 sm:py-5 sm:text-lg font-semibold text-primary-foreground shadow-2xl shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/40 active:scale-[0.98]"
          >
            Begin Your Journey
          </Link>
        </div>
      </AnimatedSection>
    </section>
  );
}
