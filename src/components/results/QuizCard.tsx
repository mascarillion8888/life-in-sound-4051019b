/**
 * QuizCard — Gothic woodcut collector card for one life era.
 *
 * Renders a LifeCard locked to the simplified reference layout:
 *   0. Outer frame   — double gold frame wrapping the whole card:
 *      2px #c9a961 border, an inset #8a6d3b hairline and four 20×20
 *      L-shaped corner brackets (#c9a961).
 *   1. Header        — centered uppercase gold line:
 *      AGE | dynamic TITLE | ERA NAME.
 *   2. Art window    — square black frame with a gold hairline border;
 *      the iTunes album cover sits inside it (painterly grading), the AI
 *      painting cross-fades over when ready, a coverless song gets the
 *      gothic woodcut skeleton (with spinner while generating).
 *   3. Lore box      — dark inset panel with serif italic lore.
 *   4. Footer        — track signature (Music icon + Artist — Title (Year))
 *      and the dynamic score chip (n/10).
 */
import { Loader2, Music, Volume2, VolumeX } from "lucide-react";

import { cardArtworkKey, useCardArtwork } from "@/lib/art/useCardArtwork";
import { useCardLore } from "@/lib/art/useCardLore";
import { dynamicCardText } from "@/lib/art/dynamicCardText";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { eraStyleFor } from "@/lib/soundmap/eraStyle";
import type { LifeCard } from "@/lib/soundmap/lifeCards";
import { useAudioPreview } from "@/lib/soundmap/useAudioPreview";
import type { Song } from "@/lib/song/types";

/**
 * Stylized gothic art-frame — the ONLY imagery for a coverless song while a
 * painting generates. A breathing ornate empty frame with candle-glow:
 * never a bare icon box.
 */
function CardArtSkeleton({ generating, caption }: { generating: boolean; caption: string }) {
  return (
    <span
      data-testid="card-art-skeleton"
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
            "radial-gradient(ellipse at 50% 30%, rgba(216,166,90,0.2) 0%, transparent 62%)",
        }}
      />
      {/* Empty portrait frame silhouette. */}
      <span
        aria-hidden
        className="absolute inset-[14%] rounded-[2px] border-2 border-[#3a2f1e]/80"
        style={{ boxShadow: "inset 0 0 30px rgba(0,0,0,0.75), 0 0 14px rgba(216,166,90,0.12)" }}
      />
      {/* Ornamental corner marks — carved, not vector. */}
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
      {/* Gilded resting line — a portrait awaiting its painting. */}
      <span
        aria-hidden
        className="absolute inset-x-[24%] top-1/2 h-[2px] rounded-full"
        style={{
          background: "linear-gradient(to right, transparent, rgba(216,166,90,0.4), transparent)",
        }}
      />
      {/* Shimmer sweep — travels across the frame while generation runs. */}
      {generating ? (
        <span
          data-testid="card-art-shimmer"
          aria-hidden
          className="absolute inset-0 animate-[card-shimmer_1.8s_ease-in-out_infinite]"
          style={{
            background:
              "linear-gradient(105deg, transparent 30%, rgba(216,166,90,0.14) 48%, rgba(236,226,200,0.2) 52%, transparent 70%)",
            backgroundSize: "220% 100%",
          }}
        />
      ) : null}
      {/* Spinner + i18n caption — visual feedback while the painting generates. */}
      {generating ? (
        <span
          aria-hidden
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40"
        >
          <Loader2 className="h-8 w-8 animate-spin text-[#c8aa6e]" />
          <span className="px-2 text-center text-xs font-mono text-amber-200/70">{caption}</span>
        </span>
      ) : null}
    </span>
  );
}

/** Soft inner vignette melting any image into the card frame. */
function InnerVignette() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        background: "radial-gradient(ellipse at center, transparent 62%, rgba(8,6,10,0.42) 100%)",
      }}
    />
  );
}

/** 20×20 L-shaped gold bracket clamping one corner of the outer frame. */
function FrameCorner({ v, h }: { v: "top" | "bottom"; h: "left" | "right" }) {
  return (
    <span
      aria-hidden
      data-testid={`card-frame-corner-${v}-${h}`}
      className="pointer-events-none absolute z-30 h-5 w-5 border-2 border-[#c9a961]"
      style={{
        [v]: 4,
        [h]: 4,
        // The two edges facing inward stay invisible — only the outer L shows.
        borderTopWidth: v === "top" ? 2 : 0,
        borderBottomWidth: v === "bottom" ? 2 : 0,
        borderLeftWidth: h === "left" ? 2 : 0,
        borderRightWidth: h === "right" ? 2 : 0,
      }}
    />
  );
}

/** Ornamental divider — two hairlines flanking a carved diamond. */
function OrnamentalDivider() {
  return (
    <span aria-hidden className="my-1 flex items-center gap-2">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#8a6f4a]/70 to-[#8a6f4a]/70" />
      <span className="h-1.5 w-1.5 rotate-45 border border-[#6f5836] bg-[#a98c5f]/60" />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[#8a6f4a]/70 to-[#8a6f4a]/70" />
    </span>
  );
}

const OCTAGON_CLIP =
  "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)";

export function QuizCard({
  card,
  song,
  autoPlayPreview = false,
}: {
  card: LifeCard;
  /** The era's song when one exists — artwork + preview come only from here. */
  song: Song | null;
  /** Attempt fade-in playback on mount (browser gesture policy may block it). */
  autoPlayPreview?: boolean;
}) {
  const { t } = useLanguage();
  const preview = useAudioPreview(song, { autoPlay: autoPlayPreview });
  const era = eraStyleFor(song, card.index);
  const art = useCardArtwork(song, { cardIndex: card.index });
  // Poetic lore (LLM or deterministic server-side) — replaces the static
  // narrative when ready; the card also persists server-side on this call.
  const lore = useCardLore(song, {
    cardIndex: card.index,
    genre: song ? `${song.title} ${song.artist} ${song.album ?? ""}` : null,
  });
  // Artwork contract: the provider cover (song.artworkUrl) is ONLY a
  // transitional layer — it renders while the AI painting is loading (and
  // sits underneath the finished painting). Once generation has failed
  // (status "unavailable") the cover is NEVER substituted back in: the gothic
  // woodcut placeholder takes over, so a card face can never get stuck on a
  // plain album photo (e.g. a Michael Jackson cover).
  const coverUrl =
    song?.artworkUrl && art.status !== "unavailable" ? (song.artworkUrl ?? null) : null;
  // Dynamic copy — every string on the card is derived from the track's
  // identity + the era's emotion (deterministic; never static filler).
  const copy = song
    ? dynamicCardText({
        cardIndex: card.index,
        eraTag: card.tag,
        eraNarrative: card.narrative,
        trackKey: cardArtworkKey(song),
        title: song.title,
        artist: song.artist,
        album: song.album ?? null,
      })
    : null;

  return (
    <article
      data-testid={`quiz-card-${card.songIndex}`}
      data-tone={card.tone}
      data-mount={era.mount}
      className="relative w-full max-w-[340px] overflow-hidden rounded-xl border-2 bg-[#1c1815]/95 p-4 font-serif text-[#d4c3a3] shadow-2xl"
      style={{
        borderColor: "#c9a961",
        // Layered depth — amber glow + inner recess = multi-dimensional frame.
        boxShadow:
          "0 18px 44px rgba(0,0,0,0.65), 0 0 28px rgba(216,166,90,0.12), inset 0 0 22px rgba(8,6,4,0.7)",
      }}
    >
      {/* 0 · Double gold frame — inset darker-gold hairline hugging the outer
             2px border, plus four L-shaped corner brackets. Purely decorative:
             no content or data changes. */}
      <span
        aria-hidden
        data-testid="card-frame-inset"
        className="pointer-events-none absolute z-30 rounded-[10px] border border-[#8a6d3b]"
        style={{ inset: 7 }}
      />
      <FrameCorner v="top" h="left" />
      <FrameCorner v="top" h="right" />
      <FrameCorner v="bottom" h="left" />
      <FrameCorner v="bottom" h="right" />

      {/* 1 · Header — centered uppercase gold line: AGE | TITLE | ERA NAME. */}
      <header
        data-testid="card-header"
        className="mb-2 text-center text-[11px] font-bold uppercase tracking-widest text-[#c8aa6e]"
      >
        {card.ageRange} | {copy?.title ?? card.tag.toUpperCase()} | {card.eraTitle}
      </header>

      {/* 2 · Art window — square black frame with a gold hairline border. The
              provider cover is a transitional base while the AI painting
              generates; a failed generation (unavailable) drops it for the
              woodcut skeleton — the album photo never sticks as the face.
              Coverless songs keep the skeleton from the start. */}
      <div
        data-testid="card-art-window"
        className="relative mb-3 aspect-square w-full overflow-hidden rounded-lg border border-[#c8aa6e]/50 bg-[#060504]"
      >
        {coverUrl ? (
          <img
            data-testid="card-art-cover"
            src={coverUrl}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: "sepia(0.18) contrast(1.05) brightness(0.95)" }}
          />
        ) : (
          <CardArtSkeleton
            generating={song ? art.status === "loading" : false}
            caption={t.quizCard.artGenerating}
          />
        )}
        {song && art.status === "ready" && art.imageUrl ? (
          <img
            data-testid="card-art-ai"
            src={art.imageUrl}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute inset-0 h-full w-full animate-in fade-in object-cover duration-1000"
            style={{ filter: "sepia(0.12) contrast(1.04) brightness(0.97)" }}
          />
        ) : null}
        <InnerVignette />
        {/* Corner scrollwork ovals — engraved guards over the image. */}
        {/* Preview toggle — the 30s iTunes stream, singleton-faded. */}
        <button
          type="button"
          onClick={preview.toggle}
          disabled={!preview.available}
          aria-label={
            preview.available
              ? preview.playing
                ? t.quizCard.mutePreviewAria
                : t.quizCard.playPreviewAria
              : t.quizCard.previewUnavailableAria
          }
          className="absolute bottom-2 right-2 z-20 rounded-full border border-[#d8c9a8]/40 bg-[#0b0a08]/80 p-1.5 text-[#d8c9a8] transition-colors hover:border-[#d8c9a8] disabled:cursor-not-allowed disabled:opacity-30"
        >
          {preview.playing ? (
            <VolumeX className="h-4 w-4" aria-hidden />
          ) : (
            <Volume2 className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      {/* 3 · Lore box — dark inset panel with serif italic lore. */}
      <div
        data-testid="card-lore-box"
        className="mt-4 rounded border border-[#c8aa6e]/30 bg-[#161920] p-3 text-[11px] italic text-gray-300"
      >
        {lore ?? copy?.body ?? card.narrative}
      </div>

      {/* 4 · Footer — track signature (Music icon + Artist — Title (Year))
              and the dynamic score chip (n/10). */}
      <footer className="mt-3 flex items-center justify-between text-[11px] font-semibold text-[#c8aa6e]">
        {song ? (
          <span className="flex items-center gap-1.5 truncate">
            <Music className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">
              {song.artist ? `${song.artist} — ` : ""}
              {song.title}
              {song.releaseYear ? ` (${song.releaseYear})` : ""}
            </span>
          </span>
        ) : (
          <span className="truncate text-[10px] uppercase tracking-wider">{card.tag}</span>
        )}
        <span
          data-testid="card-score-badge"
          className="shrink-0 rounded border border-[#c8aa6e]/40 bg-[#c8aa6e]/20 px-2 py-0.5"
        >
          {copy ? `${copy.score}/10` : `${Math.round(card.intensity * 10)}/10`}
        </span>
      </footer>
    </article>
  );
}
