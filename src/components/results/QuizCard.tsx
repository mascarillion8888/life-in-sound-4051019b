/**
 * QuizCard — Magic: The Gathering style frame for one life era.
 *
 * Renders a LifeCard (era title, type line, stats, gothic narrative) with the
 * era's song artwork harmonized into the dark bronze style via a CSS filter
 * approximation of the canvas shader recipe (the PNG export uses the real
 * pipeline in `artworkHarmonize.ts`). A subtle mute/play toggle rides the
 * artwork corner and plays the provider's 30s preview — only when the song
 * actually carries one; a missing song/artwork stays a dark placeholder,
 * never a fabricated cover.
 */
import { Music, Volume2, VolumeX } from "lucide-react";

import { useLanguage } from "@/lib/i18n/LanguageContext";
import { harmonizeFilter } from "@/lib/soundmap/artworkHarmonize";
import { LIFE_CARD_TONE_COLORS, type LifeCard } from "@/lib/soundmap/lifeCards";
import { useAudioPreview } from "@/lib/soundmap/useAudioPreview";
import type { Song } from "@/lib/song/types";

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

  return (
    <article
      data-testid={`quiz-card-${card.songIndex}`}
      data-tone={card.tone}
      className="flex flex-col overflow-hidden rounded-2xl border bg-[#12100c]/90 shadow-lg"
      style={{
        borderColor: `${gem}55`,
        boxShadow: `0 0 24px ${gem}22, inset 0 0 18px rgba(8,6,10,0.6)`,
      }}
    >
      {/* Title bar — MTG name line with the mana-cost-style age badge. */}
      <header className="flex items-center justify-between gap-2 border-b border-[#2a2418] bg-gradient-to-b from-[#1c1812] to-[#12100c] px-3 py-2">
        <h3 className="truncate font-serif text-sm font-bold uppercase tracking-wide text-[#e8dfc8]">
          {card.eraTitle}
        </h3>
        <span
          className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#d8c9a8]"
          style={{ borderColor: `${gem}66` }}
        >
          {card.ageRange}
        </span>
      </header>

      {/* Artwork window — harmonized cover, or an empty dark frame. */}
      <div className="relative m-2 mb-0 aspect-square overflow-hidden rounded-lg border border-[#2a2418] bg-[#0b0a08]">
        {song?.artworkUrl ? (
          <img
            src={song.artworkUrl}
            alt={`${song.title} — ${song.artist}`}
            loading="lazy"
            className="h-full w-full object-cover"
            style={{ filter: harmonizeFilter() }}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[#3a342a]">
            <Music className="h-10 w-10" aria-hidden />
          </span>
        )}
        {/* Bronze tint + edge vignette overlays (DOM twin of the canvas recipe). */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 45%, rgba(8,6,10,0.55) 100%)",
            mixBlendMode: "multiply",
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[#96693a] opacity-[0.14] mix-blend-multiply"
        />
        {/* Gothic mute/play toggle — only real previews can sound. */}
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

      {/* Type line — MTG "Legendary Life Era" with the tone gem. */}
      <div className="mx-2 mt-1.5 flex items-center justify-between border-b border-[#2a2418] px-1 pb-1">
        <span className="font-serif text-[11px] italic text-[#c9b995]">{card.typeLine}</span>
        <span
          aria-hidden
          className="h-3 w-3 rounded-full border border-black/50"
          style={{ background: `radial-gradient(circle at 35% 35%, #fff8, transparent), ${gem}` }}
        />
      </div>

      {/* Text box — stats + gothic narrative + the song it belongs to. */}
      <div className="m-2 mt-1.5 flex flex-1 flex-col gap-1.5 rounded-md border border-[#2a2418] bg-[#171410] p-2">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#a89a7c]">
          <span>{card.tag}</span>
          <span>
            {t.quizCard.intensityLabel} {Math.round(card.intensity * 100)}
          </span>
        </div>
        <p className="font-serif text-[11px] italic leading-snug text-[#d8ccb0]">
          {card.narrative}
        </p>
        {song ? (
          <p className="mt-auto truncate text-[10px] text-[#8f8168]">
            {song.title}
            {song.artist ? ` — ${song.artist}` : ""}
          </p>
        ) : null}
      </div>
    </article>
  );
}
