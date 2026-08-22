import { Disc3, Download, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Waveform } from "@/components/soundmap/Waveform";
import { eras } from "@/lib/soundmap/data";
import type { Pick } from "@/components/soundmap/SongPicker";
import { downloadPoster } from "@/lib/soundmap/poster";

const toneClass: Record<string, string> = {
  violet: "border-violet/40 text-violet",
  gold: "border-primary/40 text-primary",
  silver: "border-border text-foreground/70",
};

function story(picks: Record<number, Pick>) {
  const first = picks[1]?.title ?? "ilk ses";
  const rebel = picks[3]?.title ?? "isyanın";
  const dark = picks[6]?.title ?? "karanlığın";
  const last = picks[8]?.title ?? "son sahne";
  return `Hikâyen ${first} ile başlıyor: dünyanın hâlâ yumuşak olduğu, sesin bir sığınak sayıldığı yıllar. Sonra ${rebel} geliyor — çeliğe dönüşmenin ilk gürültüsü, kendini duyurmak için sesi yükseltmek zorunda kalan biri. ${dark} sende kırılmayı değil, kırılmayı taşımayı öğretiyor; karanlık burada bir düşman değil, bir oda. Ve ${last} ile kapanıyor: sorularını kaybetmeden onlarla yaşamayı seçen bir insanın soundtrack'i. Çelikten hüzne değil — çelikten kabullenmeye giden bir harita bu.`;
}

export function Results({ picks, onRestart }: { picks: Record<number, Pick>; onRestart: () => void }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-6 md:py-24">
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-violet">Müzik Haritan</p>
        <h1 className="mt-4 text-3xl font-black uppercase tracking-tight text-gold-gradient sm:text-5xl md:text-6xl">
          Fra Stål Til Sorg
        </h1>
        <p className="mt-3 text-sm uppercase tracking-[0.3em] text-muted-foreground">Müzik Haritası</p>
      </motion.header>

      <section className="mt-14">
        <h2 className="mb-6 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Dönem Zaman Çizelgesi
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {eras.map((era, i) => {
            const p = picks[era.id];
            return (
              <motion.article
                key={era.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.05 }}
                className="group rounded-3xl border border-border/50 bg-card/50 p-5 backdrop-blur-xl transition-colors hover:border-primary/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-gradient-to-br from-violet/25 to-primary/20">
                    <Disc3 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{era.age}</p>
                    <p className="truncate text-sm font-semibold text-foreground">{era.phase}</p>
                  </div>
                </div>
                <p className="mt-4 truncate text-base font-semibold text-foreground">
                  {p?.title ?? "—"}
                </p>
                <p className="truncate text-sm text-primary">{p?.artist || "—"}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{era.emotion}</p>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="mb-6 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Duygusal Yolculuk
        </h2>
        <Waveform />
      </section>

      <section className="mt-16 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-[2rem] border border-border/50 bg-card/50 p-6 backdrop-blur-xl sm:p-10">
          <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Hikâyen
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-foreground/85">{story(picks)}</p>
        </div>

        <div className="rounded-[2rem] border border-border/50 bg-card/50 p-6 backdrop-blur-xl sm:p-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Çalma Listesi
          </h2>
          <ol className="mt-5 space-y-2">
            {eras.map((era, i) => {
              const p = picks[era.id];
              return (
                <li
                  key={era.id}
                  className="flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2 transition-colors hover:border-border/60 hover:bg-background/40"
                >
                  <span className="w-6 text-xs font-mono text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {p?.title ?? "—"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p?.artist || "—"}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-widest ${toneClass[era.tone]}`}
                  >
                    {era.tag}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <footer className="mt-16 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          onClick={() => downloadPoster(picks)}
          className="h-14 rounded-full bg-primary px-10 text-base font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Download className="mr-2 h-5 w-5" />
          High-Res Poster İndir
        </Button>
        <Button
          variant="outline"
          onClick={onRestart}
          className="h-14 rounded-full px-10 text-base"
        >
          <RotateCcw className="mr-2 h-5 w-5" />
          Tekrar Başla
        </Button>
      </footer>
    </div>
  );
}
