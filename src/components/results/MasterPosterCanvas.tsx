import { useRef } from "react";
import { toPng } from "html-to-image";
import { Download } from "lucide-react";

import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { PoeticAnalysis } from "@/lib/llm/poetic-analyzer";
import type { LifeFeedEntry } from "@/lib/life-feed";
import { RENDER_LABELS } from "@/lib/soundmap/masterPosterContent";
import type { Song } from "@/lib/song/types";

import { MasterPosterSheet } from "./MasterPosterSheet";

/**
 * MasterPosterCanvas — hosts the fixed 2:3 editorial Master Poster sheet
 * (1024×1536 logical; exported at 2048×3072) on the /results page.
 *
 * The sheet itself is `MasterPosterSheet` — shared with the
 * journey-completion modal — so the render and the export never diverge.
 */
export function MasterPosterCanvas({
  analysis,
  songs,
  feedEntries = [],
}: {
  analysis: PoeticAnalysis;
  songs: Song[];
  feedEntries?: LifeFeedEntry[];
}) {
  const { language, t } = useLanguage();
  const locale = (language === "tr" ? "tr" : "en") as "tr" | "en";
  const labels = RENDER_LABELS[locale];
  const sheetRef = useRef<HTMLDivElement>(null);

  async function handleExport() {
    const node = sheetRef.current?.querySelector("[data-testid='master-poster-sheet']");
    if (!(node instanceof HTMLElement)) return;
    const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "life-in-a-sound-master-poster.png";
    a.click();
  }

  return (
    <section aria-label={t.poster.ariaLabel} className="relative">
      <div ref={sheetRef} className="mx-auto w-full max-w-[560px]">
        <MasterPosterSheet
          analysis={analysis}
          songs={songs}
          feedEntries={feedEntries}
          labels={labels}
          locale={locale}
        />
      </div>
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={handleExport}
          data-testid="poster-export-button"
          className="flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition hover:scale-[1.02]"
          style={{
            borderColor: "#d4af3766",
            background: "#d4af3722",
            color: "#f0d878",
          }}
        >
          <Download className="h-4 w-4" />
          {labels.download}
        </button>
      </div>
      <p
        className="mt-3 text-center text-xs"
        style={{ color: `${analysis.visual.palette.text}66` }}
      >
        {t.poster.themeLabel} {analysis.visual.themeId} · {analysis.visual.typography}
      </p>
    </section>
  );
}
