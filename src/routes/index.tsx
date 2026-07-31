import { createFileRoute } from "@tanstack/react-router";
import { Dna, Heart, Image as ImageIcon } from "lucide-react";

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

function Index() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 glow-gold" />

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

      <main className="relative z-10">
        <section className="flex flex-col items-center justify-center px-6 pb-24 pt-16 text-center md:pt-24 lg:pt-32">
          <h1 className="max-w-4xl text-5xl font-bold tracking-tight text-foreground md:text-7xl lg:text-8xl">
            <span className="block">Your Life.</span>
            <span className="block">
              One <span className="text-gold-gradient">Soundtrack.</span>
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Discover the music that shaped your story and transform your memories
            into a beautiful visual journey.
          </p>
          <button className="mt-10 inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 active:scale-[0.98]">
            Begin Your Journey
          </button>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-6 pb-32 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
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
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
