import { AnimatedSection } from "@/components/AnimatedSection";
import posterPreview from "@/assets/poster-preview.jpg";

export default function PreviewSection() {
  return (
    <section className="relative mx-auto max-w-7xl px-5 py-16 sm:px-6 md:py-24 lg:px-8">
      <AnimatedSection className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] border border-border/50 bg-card/20 shadow-2xl">
        <div className="group relative aspect-square md:aspect-[16/10]">
          <img
            src={posterPreview}
            alt="Example SoundMap poster"
            width={1024}
            height={1024}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover blur-2xl transition-all duration-1000 group-hover:blur-xl group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/40 transition-colors duration-700 group-hover:bg-black/30" />
          <div className="absolute inset-0 flex items-center justify-center p-5 sm:p-8">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-center backdrop-blur-md sm:px-8 sm:py-5 md:px-12 md:py-6">
              <p className="text-lg font-medium text-foreground sm:text-xl md:text-3xl">
                Your story could look like this.
              </p>
            </div>
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
}
