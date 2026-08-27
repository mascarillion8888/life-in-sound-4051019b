/**
 * Gothic art load/fallback — shared fixtures for the Card Gallery.
 *
 * - `GothicArtSkeleton` — a chiaroscuro loading frame shown while a HuggingFace
 *   woodcut painting is being generated (breathing candle-glow, ornate frame,
 *   shimmer sweep, spinner + i18n caption). Mirrors the QuizCard art skeleton
 *   so generation feedback stays visually consistent across the app.
 *
 * - `GothicArtFallback` — a doom/fallback panel for the "couldn't paint" cases:
 *   API rate limit, network failure, or broken image. A cracked-seal inset
 *   holds the classification message and, for retryable failures, a retry
 *   action. It never renders a broken <img>.
 */
import type { ReactNode } from "react";
import { Loader2, RotateCw, Skull } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { GothicArtErrorKind } from "@/services/huggingFaceService";

/** Resolve a classified HF error into localized fallback copy + retry flag. */
export function gothicArtFallbackContent(
  kind: GothicArtErrorKind | undefined,
  t: {
    rateLimitTitle: string;
    rateLimitMessage: string;
    networkTitle: string;
    networkMessage: string;
    genericTitle: string;
    genericMessage: string;
  },
) {
  switch (kind) {
    case "rate-limit":
    case "auth":
      return { title: t.rateLimitTitle, message: t.rateLimitMessage };
    case "network":
    case "missing-token":
      return { title: t.networkTitle, message: t.networkMessage };
    default:
      return { title: t.genericTitle, message: t.genericMessage };
  }
}

/* ------------------------------------------------------------------ *
 * Loading skeleton
 * ------------------------------------------------------------------ */
export function GothicArtSkeleton({
  generating,
  caption,
}: {
  generating: boolean;
  caption: string;
}) {
  return (
    <div
      data-testid="gothic-art-skeleton"
      data-generating={generating ? "true" : "false"}
      aria-busy={generating}
      className="relative block h-full w-full overflow-hidden"
      style={{ background: "linear-gradient(to bottom, #17110b 0%, #0b0906 60%, #080604 100%)" }}
    >
      {/* Breathing candle-glow. */}
      <span
        aria-hidden
        className={`absolute inset-0 ${generating ? "animate-pulse" : ""}`}
        style={{
          background:
            "radial-gradient(ellipse at 50% 32%, rgba(216,166,90,0.2) 0%, transparent 62%)",
        }}
      />
      {/* Empty portrait frame silhouette. */}
      <span
        aria-hidden
        className="absolute inset-[14%] rounded-[2px] border-2 border-[#3a2f1e]/80"
        style={{ boxShadow: "inset 0 0 30px rgba(0,0,0,0.75), 0 0 14px rgba(216,166,90,0.12)" }}
      />
      {/* Ornamental corner marks. */}
      {(["top", "bottom"] as const).flatMap((v) =>
        (["left", "right"] as const).map((h) => (
          <span
            key={`${v}-${h}`}
            aria-hidden
            className="absolute h-4 w-4 border-[#4a3a22]/80"
            style={{
              [v]: "14%",
              [h]: "14%",
              borderTopWidth: v === "top" ? 2 : 0,
              borderBottomWidth: v === "bottom" ? 2 : 0,
              borderLeftWidth: h === "left" ? 2 : 0,
              borderRightWidth: h === "right" ? 2 : 0,
            }}
          />
        )),
      )}
      {/* Gilded resting line. */}
      <span
        aria-hidden
        className="absolute inset-x-[24%] top-1/2 h-[2px] rounded-full"
        style={{
          background: "linear-gradient(to right, transparent, rgba(216,166,90,0.4), transparent)",
        }}
      />
      {/* Shimmer sweep while generating. */}
      {generating ? (
        <span
          data-testid="gothic-art-shimmer"
          aria-hidden
          className="absolute inset-0 animate-[card-shimmer_1.8s_ease-in-out_infinite]"
          style={{
            background:
              "linear-gradient(105deg, transparent 30%, rgba(216,166,90,0.14) 48%, rgba(236,226,200,0.2) 52%, transparent 70%)",
            backgroundSize: "220% 100%",
          }}
        />
      ) : null}
      {/* Spinner + i18n caption. */}
      {generating ? (
        <span
          aria-hidden
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40"
        >
          <Loader2 className="h-8 w-8 animate-spin text-[#c8aa6e]" />
          <span className="px-2 text-center text-xs font-mono text-amber-200/70">{caption}</span>
        </span>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Doom fallback
 * ------------------------------------------------------------------ */
export function GothicArtFallback({
  title,
  message,
  children,
  retrying = false,
  onRetry,
}: {
  title: string;
  message: string;
  /** Optional extra content rendered between the message and the retry. */
  children?: ReactNode;
  retrying?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div
      data-testid="gothic-art-fallback"
      className="relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden px-4 text-center"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, rgba(90,20,20,0.28) 0%, rgba(8,6,4,0.9) 70%)",
      }}
    >
      {/* Cracked dark seal backdrop. */}
      <span
        aria-hidden
        className="absolute inset-[18%] rounded-full border border-[#5a2a1e]/70"
        style={{ boxShadow: "inset 0 0 40px rgba(0,0,0,0.9), 0 0 30px rgba(120,30,20,0.18)" }}
      />
      <span
        aria-hidden
        className="absolute inset-[26%] rounded-full border border-dashed border-[#8a4a30]/50"
      />
      <span
        aria-hidden
        className="absolute inset-x-[30%] top-[52%] h-[2px] rotate-[-18deg] rounded bg-[#6a2a18]/70"
      />
      <span
        aria-hidden
        className="absolute inset-x-[30%] top-[58%] h-[2px] rotate-[24deg] rounded bg-[#6a2a18]/50"
      />

      <Skull className="relative h-8 w-8 text-[#8a3a20]" aria-hidden />
      <h4
        className="relative text-sm font-bold uppercase tracking-[0.18em] text-[#d8a65a]"
        style={{ fontFamily: "'Cinzel', Georgia, serif" }}
      >
        {title}
      </h4>
      <div className="relative flex flex-col items-center gap-2">
        <p className="max-w-[32ch] text-xs italic text-[#b8a890]">{message}</p>
        {children}
      </div>
      {onRetry ? (
        <Button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          variant="outline"
          size="sm"
          className="relative gap-2 border-[#5c4a3e] bg-transparent text-[#d8a65a] hover:bg-[#d8a65a]/10 hover:text-[#e5b76b]"
        >
          {retrying ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
          )}
          {retrying ? "Resurrecting…" : "Try Again"}
        </Button>
      ) : null}
    </div>
  );
}
