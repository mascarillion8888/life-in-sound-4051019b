/**
 * Share Poster dialog — the "Paylaş" modal for one gallery card.
 *
 * Renders the 1080x1920 story poster onto a live canvas (CSS-scaled preview;
 * the backing store stays full-resolution) and offers one-click PNG
 * download. The render is fully client-side (Canvas 2D, no DOM
 * rasterization), so fonts and the gothic chiaroscuro grading survive the
 * export unchanged.
 */
import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Share2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  exportSharePoster,
  renderSharePoster,
  type SharePosterResult,
} from "@/lib/soundmap/sharePoster";
import type { CardRow } from "@/lib/supabase/cards-remote";

type ShareStatus = "idle" | "busy" | "shared" | "downloaded" | "error";
type ShareResult = SharePosterResult;

export function SharePosterDialog({
  card,
  open,
  onOpenChange,
}: {
  card: CardRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { language } = useLanguage();
  // Radix mounts the portal content lazily, so a useRef read inside an
  // effect can race the mount — a callback ref + state reliably retriggers
  // the render once the canvas actually exists.
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [rendering, setRendering] = useState(false);
  const [status, setStatus] = useState<ShareStatus>("idle");

  useEffect(() => {
    if (!open || !card || !canvasEl) return;
    let active = true;
    setRendering(true);
    void renderSharePoster(card, canvasEl)
      // A render failure (e.g. a rejecting image load) must hide the loading
      // overlay and stay silent, not surface an uncaught promise rejection.
      .catch(() => undefined)
      .finally(() => {
        if (active) setRendering(false);
      });
    return () => {
      active = false;
    };
  }, [open, card, canvasEl]);

  // Reset the toast when a new poster is opened.
  useEffect(() => {
    if (open) setStatus("idle");
  }, [open, card]);

  const download = async () => {
    if (!card || status === "busy") return;
    setStatus("busy");
    const result: ShareResult = await exportSharePoster(card);
    setStatus(result === "shared" ? "shared" : result === "downloaded" ? "downloaded" : "error");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-[#5c4a3e] bg-[#141010] text-[#ece2c8]">
        <DialogHeader>
          <DialogTitle className="font-serif tracking-wide">
            {language === "tr" ? "Hikâyende Paylaş" : "Share to your Story"}
          </DialogTitle>
        </DialogHeader>
        <div className="relative mx-auto w-full overflow-hidden rounded-md border border-[#5c4a3e]/60">
          {rendering ? (
            <div
              data-testid="share-poster-rendering"
              className="absolute inset-0 z-10 flex items-center justify-center bg-[#0b0908]/70"
            >
              <Loader2 className="h-6 w-6 animate-spin text-[#d8a65a]" aria-hidden />
            </div>
          ) : null}
          {/* 1080x1920 backing store, previewed at story aspect. */}
          <canvas
            ref={setCanvasEl}
            className="block h-auto w-full"
            data-testid="share-poster-canvas"
          />
        </div>
        <Button
          onClick={() => void download()}
          disabled={!card || rendering || status === "busy"}
          className="w-full bg-[#d8a65a] font-semibold text-[#1a140e] hover:bg-[#e5b76b]"
        >
          {status === "busy" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : status === "shared" ? (
            <Check className="mr-2 h-4 w-4" aria-hidden />
          ) : (
            <Share2 className="mr-2 h-4 w-4" aria-hidden />
          )}
          {status === "busy"
            ? language === "tr"
              ? "Hazırlanıyor…"
              : "Preparing…"
            : status === "shared"
              ? language === "tr"
                ? "Paylaşıldı"
                : "Shared"
              : status === "downloaded"
                ? language === "tr"
                  ? "İndirildi"
                  : "Downloaded"
                : language === "tr"
                  ? "İndir / Hikâyede Paylaş"
                  : "Download / Share to Story"}
        </Button>
        {status === "error" ? (
          <div
            role="alert"
            data-testid="share-poster-error"
            className="mt-2 flex items-start gap-2 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {language === "tr"
                ? "Poster hazırlanamadı. Lütfen tekrar dene."
                : "The poster could not be generated. Please try again."}
            </span>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
