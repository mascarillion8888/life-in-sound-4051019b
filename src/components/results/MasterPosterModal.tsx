import { useRef } from "react";
import { toPng } from "html-to-image";
import { Download, X } from "lucide-react";

import type { PoeticAnalysis } from "@/lib/llm/poetic-analyzer";
import { RENDER_LABELS } from "@/lib/soundmap/masterPosterContent";
import type { LifeFeedEntry } from "@/lib/life-feed";
import type { Song } from "@/lib/song/types";

import { MasterPosterSheet } from "./MasterPosterSheet";

/**
 * Journey-completion modal — renders the fixed 2:3 editorial Master Poster
 * (MasterPosterSheet) overlaying the whole screen, with a single-click
 * 2048×3072 PNG download via html-to-image (pixelRatio: 2).
 *
 * Shared sheet = the /results render and this export never diverge.
 */
export function MasterPosterModal({
  analysis,
  songs,
  feedEntries = [],
  onClose,
  locale = "en",
}: {
  analysis: PoeticAnalysis;
  songs: Song[];
  feedEntries?: LifeFeedEntry[];
  onClose: () => void;
  locale?: "tr" | "en";
}) {
  const labels = RENDER_LABELS[locale];
  const sheetRef = useRef<HTMLDivElement>(null);

  async function handleDownload() {
    const node = sheetRef.current?.querySelector("[data-testid='master-poster-sheet']");
    if (!(node instanceof HTMLElement)) return;
    const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "life-in-a-sound-master-poster.png";
    a.click();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
      data-testid="master-poster-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={labels.close}
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/90 shadow-lg transition hover:scale-105"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        ref={sheetRef}
        className="max-h-[90vh] w-auto max-w-[86vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <MasterPosterSheet
          analysis={analysis}
          songs={songs}
          feedEntries={feedEntries}
          labels={labels}
          locale={locale}
        />
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void handleDownload();
        }}
        data-testid="modal-download"
        className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#d4af3766] bg-[#1a1408]/90 px-6 py-3 text-sm font-semibold text-[#f0d878] shadow-xl transition hover:scale-[1.03]"
      >
        <Download className="h-4 w-4" />
        {labels.download}
      </button>
    </div>
  );
}
