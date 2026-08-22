import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SongPicker, type Pick } from "@/components/soundmap/SongPicker";
import { eras } from "@/lib/soundmap/data";

export function Wizard({
  step,
  picks,
  onPick,
  onBack,
  onNext,
}: {
  step: number;
  picks: Record<number, Pick>;
  onPick: (eraId: number, pick: Pick | null) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const era = eras[step];
  const pick = picks[era.id] ?? null;
  const confirmed = Boolean(pick?.confirmed);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-6 md:py-24">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          <span>
            Adım {step + 1} / {eras.length}
          </span>
          <span className="text-primary">
            {era.age} · {era.phase}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet to-primary"
            initial={false}
            animate={{ width: `${((step + 1) / eras.length) * 100}%` }}
            transition={{ type: "spring", stiffness: 140, damping: 22 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={era.id}
          initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -24, filter: "blur(8px)" }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 rounded-[2rem] border border-border/50 bg-card/60 p-6 backdrop-blur-xl sm:p-8 md:p-10"
        >
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {era.question}
          </h2>
          <p className="mt-3 text-base text-foreground/70">{era.hint}</p>

          <div className="mt-8">
            <SongPicker value={pick} onChange={(p) => onPick(era.id, p)} />
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          onClick={onBack}
          className="h-12 w-full rounded-full px-8 text-base sm:w-auto"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Geri
        </Button>
        <Button
          onClick={onNext}
          disabled={!confirmed}
          className="h-12 w-full rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground hover:bg-primary/90 sm:w-auto"
        >
          {step === eras.length - 1 ? "Haritamı Oluştur" : "İleri"}
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      {!confirmed ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Devam etmek için bir şarkı seçip onayla.
        </p>
      ) : null}
    </div>
  );
}
