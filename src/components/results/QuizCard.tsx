/**
 * QuizCard — player-card layout (docs/reference/kart-prototip-v3.html).
 *
 * Same props and hooks as the previous gothic card; only the rendering moved
 * to <PlayerCard />. The old layout is kept in QuizCardLegacy.tsx.
 */
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { cardArtworkKey, useCardArtwork } from "@/lib/art/useCardArtwork";
import { useCardLore } from "@/lib/art/useCardLore";
import { dynamicCardText } from "@/lib/art/dynamicCardText";
import {
  isInCollection,
  loadCollection,
  saveCollection,
  toggleInCollection,
} from "@/lib/collection";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { LifeCard } from "@/lib/soundmap/lifeCards";
import { useAudioPreview } from "@/lib/soundmap/useAudioPreview";
import { cardTemplateUrl } from "@/lib/card/cardTemplates";
import type { Song } from "@/lib/song/types";
import { PlayerCard } from "./PlayerCard";

/** Tiny deterministic string hash (no external dependency). */
function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

export function QuizCard({
  card,
  song,
  autoPlayPreview = false,
  templateFile,
  artStatus,
}: {
  card: LifeCard;
  /** The era's song when one exists — artwork + preview come only from here. */
  song: Song | null;
  /** Attempt fade-in playback on mount (browser gesture policy may block it). */
  autoPlayPreview?: boolean;
  /** Optional 1:1 card-frame template drawn over the artwork window. */
  templateFile?: string | null;
  /** Background cover verification state (journey). */
  artStatus?: "idle" | "loading" | "ok" | "notfound";
}) {
  const { t } = useLanguage();
  const preview = useAudioPreview(song, { autoPlay: autoPlayPreview });

  const collectionKey = song ? cardArtworkKey(song) : "";
  const [saved, setSaved] = useState(
    song ? isInCollection(loadCollection(), collectionKey) : false,
  );
  const toggleSaved = () => {
    if (!song) return;
    const next = toggleInCollection(loadCollection(), collectionKey, song);
    saveCollection(next);
    setSaved(isInCollection(next, collectionKey));
  };

  const art = useCardArtwork(song, { cardIndex: card.index });
  const templateUrl = templateFile ? cardTemplateUrl(templateFile) : undefined;
  const ageNums = card.ageRange.match(/\d+/g)?.map(Number) ?? [];
  const encounterAge = ageNums.length
    ? Math.round(ageNums.reduce((a, b) => a + b, 0) / ageNums.length)
    : null;
  const lore = useCardLore(song, {
    encounterAge,
    cardIndex: card.index,
    genre: song ? `${song.title} ${song.artist} ${song.album ?? ""}` : null,
  });
  const coverUrl = song?.artworkUrl ?? null;
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

  const sequence = (copy as { sequence?: string } | null)?.sequence ?? "";
  const mood = (song as { mood?: string | null } | null)?.mood ?? null;
  const year = song?.releaseYear ?? null;
  const eraValue = year ? `${Math.floor(year / 10) * 10}s` : card.ageRange;
  // Placeholder score: deterministic 6–10 from the track identity.
  // Replace with a real discovery score when one exists.
  const score = song ? 6 + (hashString(collectionKey) % 5) : 6;
  const generating = song ? (artStatus === "loading" || art.status === "loading") && artStatus !== "notfound" : false;

  const playLabel = preview.available
    ? preview.playing
      ? t.quizCard.mutePreviewAria
      : t.quizCard.playPreviewAria
    : t.quizCard.previewUnavailableAria;

  const coverSlot = (
    <>
      {coverUrl ? (
        <img
          data-testid="card-art-cover"
          src={coverUrl}
          alt=""
          aria-hidden
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span
          data-testid="card-art-skeleton"
          data-generating={generating ? "true" : "false"}
          aria-busy={generating}
          data-notfound={artStatus === "notfound" ? "true" : "false"}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40"
        >
          {generating ? (
            <>
              <span className="animate-pulse" aria-hidden><Loader2 className="h-8 w-8 animate-spin" aria-hidden /></span>
              <span className="px-2 text-center text-xs opacity-80">
                {t.quizCard.artGenerating}
              </span>
            </>
          ) : null}
        </span>
      )}
      {song && art.status === "ready" && art.imageUrl ? (
        <img
          data-testid="card-art-ai"
          src={art.imageUrl}
          alt=""
          aria-hidden
          loading="lazy"
          className="absolute inset-0 h-full w-full animate-in fade-in object-cover duration-1000"
        />
      ) : null}
      {templateUrl ? (
        <img
          data-testid="card-art-template"
          src={templateUrl}
          alt=""
          aria-hidden
          loading="lazy"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </>
  );

  return (
    <PlayerCard
      data-testid={`quiz-card-${card.songIndex}`}
      genre={song?.genre ?? null}
      mood={mood}
      metaLeft={`${card.ageRange} · ${card.eraTitle}`}
      sequence={sequence}
      title={song?.title ?? card.eraTitle}
      artist={song?.artist ?? card.tag}
      lore={lore ?? copy?.body ?? card.narrative}
      score={score}
      scoreLabel="DISCOVERY"
      eraTitle="ERA"
      eraValue={eraValue}
      moodTitle="MOOD"
      moodValue={(mood ?? "Nostalgic").toUpperCase()}
      coverSlot={coverSlot}
      progress={null}
      canPlay={preview.available}
      playing={preview.playing}
      onPlay={preview.toggle}
      analyser={preview.analyser}
      playLabel={playLabel}
      collected={saved}
      onCollect={toggleSaved}
      collectLabel={saved ? t.quizCard.inCollection : t.quizCard.addToCollection}
    />
  );
}

export default QuizCard;