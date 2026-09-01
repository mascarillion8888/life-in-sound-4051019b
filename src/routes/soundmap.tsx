import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";

import { Hero } from "@/components/soundmap/Hero";
import { Wizard } from "@/components/soundmap/Wizard";
import { Results } from "@/components/soundmap/Results";
import type { Pick } from "@/components/soundmap/SongPicker";
import { eras } from "@/lib/soundmap/data";

const DESC =
  "8 soruda hayatının soundtrack'ini çıkar: dönem dönem şarkılarını seç, duygusal haritanı ve sinematik posterini al.";

export const Route = createFileRoute("/soundmap")({
  head: () => ({
    meta: [
      { title: "Müzik Haritası — Hayatının Soundtrack'i | SoundMap" },
      { name: "description", content: DESC },
      { property: "og:title", content: "Müzik Haritası — Hayatının Soundtrack'i" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Müzik Haritası — Hayatının Soundtrack'i" },
      { name: "twitter:description", content: DESC },
    ],
  }),
  component: SoundMapApp,
});

type View = "hero" | "wizard" | "results";

function SoundMapApp() {
  const [view, setView] = useState<View>("hero");
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<Record<number, Pick>>({});

  const setPick = (eraId: number, pick: Pick | null) =>
    setPicks((prev) => {
      const next = { ...prev };
      if (pick) next[eraId] = pick;
      else delete next[eraId];
      return next;
    });

  const back = () => {
    if (step === 0) setView("hero");
    else setStep((s) => s - 1);
  };

  const next = () => {
    if (step === eras.length - 1) setView("results");
    else setStep((s) => s + 1);
  };

  const restart = () => {
    setPicks({});
    setStep(0);
    setView("hero");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 glow-gold opacity-70" />
      <div className="pointer-events-none absolute inset-0 glow-violet opacity-60" />
      <main className="relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 30, filter: "blur(12px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -30, filter: "blur(12px)" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {view === "hero" ? <Hero onStart={() => setView("wizard")} /> : null}
            {view === "wizard" ? (
              <Wizard step={step} picks={picks} onPick={setPick} onBack={back} onNext={next} />
            ) : null}
            {view === "results" ? <Results picks={picks} onRestart={restart} /> : null}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
