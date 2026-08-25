/**
 * QuizCard — Gothic wooden-frame card for one life era.
 *
 * Renders a LifeCard (dynamic title, type line, score shield, narrative)
 * as a treasured framed photograph in a multi-dimensional wooden gallery —
 * ornate carved border, warm amber lighting, layered depth shadows.
 *
 * STRICT RULE: the artwork area never shows an un-stylized photo or an
 * empty icon box. The provider cover shows INSTANTLY through the painterly
 * grading (styled, illustration-like); the generated painting cross-fades
 * over it when ready; a coverless song gets the stylized gothic skeleton.
 * The provider still only supplies metadata + the 30s preview stream.
 */
import { useState } from "react";
import { Music, Shield, Volume2, VolumeX } from "lucide-react";

import { cardArtworkKey, useCardArtwork } from "@/lib/art/useCardArtwork";
import { dynamicCardText } from "@/lib/art/dynamicCardText";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { eraStyleFor } from "@/lib/soundmap/eraStyle";
import { LIFE_CARD_TONE_COLORS, type LifeCard } from "@/lib/soundmap/lifeCards";
import { useAudioPreview } from "@/lib/soundmap/useAudioPreview";
import type { Song } from "@/lib/song/types";

/**
 * Stylized gothic art-frame — the ONLY fallback while a painting generates.
 * A breathing ornate empty frame with candle-glow: never a raw photo and —
 * per the Sting rule — never a bare icon box either.
 */
function CardArtSkeleton({ generating }: { generating: boolean }) {
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
  const gem = LIFE_CARD_TONE_COLORS[card.tone];
  const era = eraStyleFor(song, card.index);
  const art = useCardArtwork(song, { cardIndex: card.index });
  // The fallback cover must never render as a broken/empty <img>: if the
  // provider URL fails to decode/load, the stylized skeleton takes over.
  const [erroredCover, setErroredCover] = useState<string | null>(null);
  const coverUrl = song?.artworkUrl ?? null;
  const coverUsable = coverUrl !== null && coverUrl !== erroredCover;
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
      className="relative w-full max-w-md overflow-hidden rounded-2xl border-4 bg-[#1c1815]/95 p-4 font-serif text-[#d4c3a3] shadow-2xl"
      style={{
        borderColor: "#8b7355",
        // Layered depth — amber glow + inner recess = multi-dimensional frame.
        boxShadow:
          "0 18px 44px rgba(0,0,0,0.65), 0 0 28px rgba(216,166,90,0.12), inset 0 0 22px rgba(8,6,4,0.7)",
      }}
    >
      {/* Header — dynamic title + actual sequence badge (never hardcoded). */}
      <header className="mb-3 flex items-center justify-between gap-2 border-b border-[#5c4a3e] pb-2">
        <h3 className="truncate text-base font-bold uppercase tracking-wider text-[#e8dcc4]">
          {copy?.title ?? card.eraTitle}
        </h3>
        <span className="flex shrink-0 items-center gap-1.5">
          {copy ? (
            <span className="text-[9px] font-semibold tracking-wider text-[#8f8168]">
              {copy.sequence}
            </span>
          ) : null}
          {era.eraLabel ? (
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider"
              style={{ borderColor: `${era.palette.accent}66`, color: era.palette.accent }}
            >
              {era.eraLabel}
            </span>
          ) : null}
          <span className="rounded-full border border-[#5c4a3e] bg-[#2a231f] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#d4c3a3]">
            {card.ageRange}
          </span>
        </span>
      </header>

      {/* Artwork window — ornate wooden inner frame; painterly cover shows
          INSTANTLY, AI painting cross-fades over it, skeleton for coverless. */}
      <div className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded border-2 border-[#6e5a47] bg-[#0b0a08] shadow-inner">
        {song && coverUsable ? (
          <>
            <img
              data-testid="card-art-fallback"
              src={coverUrl as string}
              alt={`${song.title} — ${song.artist}`}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: era.grading }}
              onError={() => setErroredCover(coverUrl)}
            />
            <InnerVignette />
          </>
        ) : (
          <CardArtSkeleton generating={song ? art.status === "loading" : false} />
        )}
        {song && art.status === "ready" && art.imageUrl ? (
          <>
            <img
              data-testid="card-art-ai"
              src={art.imageUrl}
              alt=""
              aria-hidden
              loading="lazy"
              className="absolute inset-0 h-full w-full animate-in fade-in object-cover duration-1000"
              style={{ filter: "sepia(0.12) contrast(1.04) brightness(0.97)" }}
            />
            <InnerVignette />
          </>
        ) : null}
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
          className="absolute bottom-2 right-2 rounded-full border border-[#d8c9a8]/40 bg-[#0b0a08]/80 p-1.5 text-[#d8c9a8] transition-colors hover:border-[#d8c9a8] disabled:cursor-not-allowed disabled:opacity-30"
        >
          {preview.playing ? (
            <VolumeX className="h-4 w-4" aria-hidden />
          ) : (
            <Volume2 className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      {/* Category banner — type line with the carved shield motif. */}
      <div className="mb-3 flex items-center justify-between border-y border-[#5c4a3e] bg-[#2a231f] px-2 py-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#c5b396]">
          {card.typeLine}
        </span>
        <Shield className="h-3.5 w-3.5 text-[#c5b396]" aria-hidden />
      </div>

      {/* Narrative + metadata footer. */}
      <div className="flex flex-1 flex-col gap-1.5">
        {copy ? (
          <div className="flex items-center justify-between gap-2">
            <span
              className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider"
              style={{
                borderColor: `${gem}88`,
                color: gem,
                boxShadow: `inset 0 0 8px ${gem}22`,
              }}
            >
              {copy.score}/10 {copy.scoreLabel}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a89a7c]">
              {t.quizCard.intensityLabel} {Math.round(card.intensity * 100)}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#a89a7c]">
            <span>{card.tag}</span>
            <span>
              {t.quizCard.intensityLabel} {Math.round(card.intensity * 100)}
            </span>
          </div>
        )}
        <p className="text-[11px] italic leading-relaxed text-[#b8a890]">
          {copy?.body ?? card.narrative}
        </p>
        {song ? (
          <p className="mt-auto flex items-center gap-1.5 truncate border-t border-[#5c4a3e] pt-2 text-[10px] font-medium text-[#8f8168]">
            <Music className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">
              {song.title}
              {song.artist ? ` — ${song.artist}` : ""}
            </span>
          </p>
        ) : null}
      </div>
    </article>
  );
}
