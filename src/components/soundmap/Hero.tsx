import { motion } from "framer-motion";
import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Hero({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-5 py-20 text-center sm:px-6">
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-[11px] font-semibold uppercase tracking-[0.4em] text-violet sm:text-xs"
      >
        Life in a Sound
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="mt-8 text-3xl font-black uppercase leading-[1.1] tracking-tight text-gold-gradient sm:text-5xl md:text-6xl"
      >
        Müzik Haritası — Hayatının Soundtrack'i
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.35 }}
        className="mt-8 text-sm uppercase tracking-[0.3em] text-muted-foreground sm:text-base"
      >
        Zihin • Güç • Karanlık • Kabullenme
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.5 }}
        className="mt-14 w-full sm:w-auto"
      >
        <Button
          onClick={onStart}
          className="h-16 w-full rounded-full bg-primary px-12 text-base font-semibold text-primary-foreground shadow-[0_0_80px_-20px_var(--gold)] transition-transform hover:bg-primary/90 active:scale-[0.98] sm:w-auto sm:text-lg"
        >
          <Play className="mr-2 h-5 w-5" />
          Başla / Begin Journey
        </Button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-8 text-sm text-muted-foreground"
      >
        8 soru · 8 şarkı · tek bir harita
      </motion.p>
    </div>
  );
}
