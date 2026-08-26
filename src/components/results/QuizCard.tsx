/**
 * QuizCard — Gothic woodcut collector card for one life era.
 *
 * Renders a LifeCard locked to the reference woodcut template:
 *   1. Top header bar   — aged gold/bronze engraved plaque:
 *      AGE | TITLE | ERA NAME + the collector sequence (e.g. "37/100").
 *   2. Main window      — black inner frame with corner scrollwork ovals;
 *      the iTunes album cover sits inside it (painterly grading), the AI
 *      painting cross-fades over when ready, a coverless song gets the
 *      gothic woodcut skeleton.
 *   3. Middle banner    — "Legendary Life Era — ERA NAME" + emblem.
 *   4. Lore & footer    — distressed parchment box: serif italic lore,
 *      ornamental divider, track signature (♪ Artist — Title (Year)).
 *   5. Score badge      — octagonal bronze badge, bottom-right.
 *   6. Footer credit    — centered TM & © line.
 */
import { Music, Shield, Volume2, VolumeX } from "lucide-react";

import { cardArtworkKey, useCardArtwork } from "@/lib/art/useCardArtwork";
import { useCardLore } from "@/lib/art/useCardLore";
import { dynamicCardText } from "@/lib/art/dynamicCardText";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { eraStyleFor } from "@/lib/soundmap/eraStyle";
import { LIFE_CARD_TONE_COLORS, type LifeCard } from "@/lib/soundmap/lifeCards";
import { useAudioPreview } from "@/lib/soundmap/useAudioPreview";
import type { Song } from "@/lib/song/types";

/**
 * Stylized gothic art-frame — the ONLY imagery for a coverless song while a
 * painting generates. A breathing ornate empty frame with candle-glow:
 * never a bare icon box.
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

/** Engraved scrollwork oval guarding one corner of the black art window. */
function CornerScroll({ v, h }: { v: "top" | "bottom"; h: "left" | "right" }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute z-10 flex h-7 w-9 items-center justify-center rounded-[50%] border border-[#a98c5f]/80"
      style={{
        [v]: 5,
        [h]: 5,
        background:
          "radial-gradient(ellipse at 40% 35%, rgba(169,140,95,0.35) 0%, rgba(20,14,8,0.85) 70%)",
        boxShadow: "0 0 6px rgba(0,0,0,0.8), inset 0 0 5px rgba(216,166,90,0.25)",
      }}
    >
      <span className="h-3 w-4 rounded-[50%] border border-[#d8a65a]/50" />
    </span>
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
  const gem = LIFE_CARD_TONE_COLORS[card.tone];
  const era = eraStyleFor(song, card.index);
  const art = useCardArtwork(song, { cardIndex: card.index });
  // Poetic lore (LLM or deterministic server-side) — replaces the static
  // narrative when ready; the card also persists server-side on this call.
  const lore = useCardLore(song, {
    cardIndex: card.index,
    genre: song ? `${song.title} ${song.artist} ${song.album ?? ""}` : null,
  });
  // Artwork contract: the iTunes cover (song.artworkUrl) renders INSTANTLY
  // inside the black window, styled with the painterly grading; the AI
  // painting cross-fades over it when ready; a coverless song keeps the
  // gothic woodcut skeleton. The provider still only supplies metadata, the
  // cover bitmap and the 30s preview stream.
  const coverUrl = song?.artworkUrl ?? null;
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
      className="relative w-full max-w-md overflow-hidden rounded-2xl border-4 bg-[#1c1815]/95 p-3 font-serif text-[#d4c3a3] shadow-2xl"
      style={{
        borderColor: "#8b7355",
        // Layered depth — amber glow + inner recess = multi-dimensional frame.
        boxShadow:
          "0 18px 44px rgba(0,0,0,0.65), 0 0 28px rgba(216,166,90,0.12), inset 0 0 22px rgba(8,6,4,0.7)",
      }}
    >
      {/* 1 · Top header bar — aged gold/bronze engraved plaque. */}
      <header
        data-testid="card-header"
        className="mb-3 flex items-center justify-between gap-2 rounded-md border"
        style={{
          borderColor: "#3f2f1b",
          background: "linear-gradient(to bottom, #6b5426 0%, #8b6f3a 45%, #5a451f 100%)",
          boxShadow:
            "inset 0 1px 0 rgba(240,226,192,0.35), inset 0 -2px 4px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.5)",
        }}
      >
        <span className="truncate px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#f0e2c0] [text-shadow:0_1px_1px_rgba(0,0,0,0.7)]">
          {card.ageRange} | {copy?.title ?? card.tag.toUpperCase()} | {card.eraTitle}
        </span>
        <span
          data-testid="card-sequence"
          className="m-1 shrink-0 rounded-[50%] border border-[#f0e2c0]/40 bg-[#241a0e]/70 px-2 py-1 text-[10px] font-bold tracking-wider text-[#f0e2c0]"
          style={{ boxShadow: "inset 0 0 6px rgba(0,0,0,0.8)" }}
        >
          {copy?.sequence ?? `${card.songIndex}/100`}
        </span>
      </header>

      {/* 2 · Main window — black inner frame, corner scrollwork ovals. The
              iTunes cover sits inside it; the AI painting cross-fades over
              when ready; coverless songs keep the woodcut skeleton. */}
      <div
        data-testid="card-art-window"
        className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded border-2 bg-[#060504] shadow-inner"
        style={{
          borderColor: "#6e5a47",
          boxShadow:
            "inset 0 0 0 1px rgba(0,0,0,0.9), inset 0 0 26px rgba(0,0,0,0.85), 0 0 10px rgba(216,166,90,0.08)",
        }}
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
          <CardArtSkeleton generating={song ? art.status === "loading" : false} />
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
        <CornerScroll v="top" h="left" />
        <CornerScroll v="top" h="right" />
        <CornerScroll v="bottom" h="left" />
        <CornerScroll v="bottom" h="right" />
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

      {/* 3 · Middle banner — Legendary Life Era — ERA NAME + emblem. */}
      <div
        data-testid="card-banner"
        className="mb-3 flex items-center justify-between border-y border-[#5c4a3e] bg-[#2a231f] px-2 py-1"
      >
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-[#c5b396]">
          {card.typeLine} — {card.eraTitle}
        </span>
        <Shield className="h-3.5 w-3.5 shrink-0 text-[#c5b396]" aria-hidden />
      </div>

      {/* 4+5 · Lore & footer box — distressed parchment, italic serif lore,
              ornamental divider, track signature; the octagonal score badge
              hangs off its bottom-right corner. */}
      <div className="relative mb-2">
        <div
          data-testid="card-lore-box"
          className="rounded-sm border border-[#8a6f4a]/60 px-3 py-2 pr-16"
          style={{
            background: "linear-gradient(160deg, #e9dcbd 0%, #ddcda6 45%, #cbb684 100%)",
            boxShadow:
              "inset 0 0 18px rgba(120,90,50,0.35), inset 0 1px 0 rgba(255,248,230,0.5), 0 2px 8px rgba(0,0,0,0.45)",
          }}
        >
          <p className="text-[11px] italic leading-relaxed text-[#3a2c18]">
            {lore ?? copy?.body ?? card.narrative}
          </p>
          <OrnamentalDivider />
          {song ? (
            <p className="flex items-center gap-1.5 truncate text-[10px] font-semibold text-[#4a3820]">
              <Music className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">
                {song.artist ? `${song.artist} — ` : ""}
                {song.title}
                {song.releaseYear ? ` (${song.releaseYear})` : ""}
              </span>
            </p>
          ) : (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6f5836]">
              {card.tag}
            </p>
          )}
        </div>
        <div
          data-testid="card-score-badge"
          className="absolute -bottom-2 right-2 flex h-14 w-14 flex-col items-center justify-center text-center"
          style={{
            clipPath: OCTAGON_CLIP,
            background: `linear-gradient(160deg, ${gem} 0%, #8b6f3a 55%, #5a451f 100%)`,
            boxShadow: "0 3px 8px rgba(0,0,0,0.6)",
          }}
        >
          <span className="text-[11px] font-black leading-none text-[#140e06]">
            {copy ? `${copy.score}/10` : `${Math.round(card.intensity * 10)}/10`}
          </span>
          <span className="mt-0.5 max-w-[44px] truncate text-[6.5px] font-bold uppercase tracking-wider text-[#241a0e]">
            {copy?.scoreLabel ?? card.tag}
          </span>
        </div>
      </div>

      {/* 6 · Footer credit — centered, engraved small print. */}
      <footer
        data-testid="card-credit"
        className="pt-1 text-center text-[8.5px] font-medium uppercase tracking-widest text-[#8f8168]"
      >
        TM &amp; © 2026 LifeInSound | Illus. R. Swanland
      </footer>
    </article>
  );
}
