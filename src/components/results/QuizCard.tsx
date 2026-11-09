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
import { resolveEncounterAge } from "@/lib/art/encounterAge";
import { stageLabelForAge } from "@/lib/art/lifeStageLabel";
import {
  isInCollection,
  loadCollection,
  saveCollection,
  toggleInCollection,
} from "@/lib/collection";
import { syncCollectionToggle } from "@/lib/supabase/use-collection-sync";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { LifeCard } from "@/lib/soundmap/lifeCards";
import { useAudioPreview } from "@/lib/soundmap/useAudioPreview";
import { cardTemplateUrl } from "@/lib/card/cardTemplates";
import type { Song } from "@/lib/song/types";
import { usePreviewSpectrum } from "@/lib/soundmap/previewSpectrum";
import { useBirthYear } from "@/lib/supabase/birth-year-store";
import { PlayerCard } from "./PlayerCard";

/** Tiny deterministic string hash (no external dependency). */
function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
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
  const { t, language } = useLanguage();
  const preview = useAudioPreview(song, { autoPlay: autoPlayPreview });
  const spectrum = usePreviewSpectrum(song?.previewUrl ?? null);
  const birthYear = useBirthYear();

  const collectionKey = song ? cardArtworkKey(song) : "";
  const [saved, setSaved] = useState(
    song ? isInCollection(loadCollection(), collectionKey) : false,
  );
  const toggleSaved = () => {
    if (!song) return;
    const next = toggleInCollection(loadCollection(), collectionKey, song);
    saveCollection(next);
    setSaved(isInCollection(next, collectionKey));
    // Mirror the single change to the server (fire-and-forget; no-op when
    // there is no session). The UI never waits on — or breaks from — this.
    const entry = next.entries.find((e) => e.trackKey === collectionKey) ?? null;
    syncCollectionToggle(collectionKey, entry);
  };

  const art = useCardArtwork(song, { cardIndex: card.index });
  const templateUrl = templateFile ? cardTemplateUrl(templateFile) : undefined;
  const { value: encounterAge, derived: ageIsDerived } = resolveEncounterAge({
    ageRange: card.ageRange,
    birthYear,
    releaseYear: song?.releaseYear ?? null,
  });
  // A real age (from birth year + release year) replaces the card's coarse band
  // in both the meta line ("Age 20" / "20 Yaş") and the life-stage chip.
  const metaLeft =
    ageIsDerived && encounterAge != null
      ? `${language === "tr" ? `${encounterAge} Yaş` : `Age ${encounterAge}`} · ${card.eraTitle}`
      : `${card.ageRange} · ${card.eraTitle}`;
  const stageLabel =
    ageIsDerived && encounterAge != null ? stageLabelForAge(encounterAge) : undefined;
  const lore = useCardLore(song, {
    encounterAge,
    birthYear,
    mood: (song as { mood?: string | null } | null)?.mood ?? null,
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
  const generating = song
    ? (artStatus === "loading" || art.status === "loading") && artStatus !== "notfound"
    : false;

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
              <span className="animate-pulse" aria-hidden>
                <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
              </span>
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
      metaLeft={metaLeft}
      stageLabel={stageLabel}
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
      progress={preview.progress}
      spectrum={spectrum}
      getTime={preview.getTime}
      timeLeft={fmtTime(preview.currentTime)}
      timeRight={fmtTime(preview.duration)}
      canPlay={preview.available}
      playing={preview.playing}
      onPlay={preview.toggle}
      playLabel={playLabel}
      collected={saved}
      onCollect={toggleSaved}
      collectLabel={saved ? t.quizCard.inCollection : t.quizCard.addToCollection}
    />
  );
}

export default QuizCard;
