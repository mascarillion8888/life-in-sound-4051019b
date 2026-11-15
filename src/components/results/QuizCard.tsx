/**
 * QuizCard — player-card layout (docs/reference/kart-prototip-v3.html).
 *
 * Same props and hooks as the previous gothic card; only the rendering moved
 * to <PlayerCard />. The old layout is kept in QuizCardLegacy.tsx.
 *
 * The stage chip is a listener-controlled meeting selector: a card's life
 * moment is WHEN THE LISTENER MET THE SONG. The card offers the periods the
 * listener may be offered (their current age gates the list), preselects a
 * smart default when the release year makes one plausible, and lets the
 * listener state an exact age. The choice feeds the encounter age (and so the
 * lore) and is reported through `onPeriodChange` / `onMetAgeChange` so the
 * journey can persist it inside the song object.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { cardArtworkKey, useCardArtwork } from "@/lib/art/useCardArtwork";
import { useCardLore } from "@/lib/art/useCardLore";
import { dynamicCardText } from "@/lib/art/dynamicCardText";
import { resolveEncounterAge } from "@/lib/art/encounterAge";
import {
  MEETING_PROMPT,
  PERIODS,
  availablePeriods,
  currentAgeFor,
  isMetAge,
  isPeriod,
  periodForAge,
  periodLabel,
  suggestedPeriod,
  type Period,
} from "@/lib/art/listenerPeriod";
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
import { PeriodChip } from "./PeriodChip";
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
  currentYear,
  onPeriodChange,
  onMetAgeChange,
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
  /** Current year, injected so the smart default stays deterministic in tests. */
  currentYear?: number;
  /** Reports a listener-chosen life period so the caller can persist it. */
  onPeriodChange?: (period: Period) => void;
  /** Reports a typed exact meeting age (null clears it) so the caller can persist it. */
  onMetAgeChange?: (age: number | null) => void;
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

  // The listener's stated meeting: a period choice and/or an exact age. Local
  // state wins for the session; the persisted `song.period` / `song.metAge`
  // restore them after a refresh/navigation.
  const [chosen, setChosen] = useState<Period | null>(null);
  const [chosenMetAge, setChosenMetAge] = useState<number | null>(null);
  useEffect(() => {
    setChosen(null);
    setChosenMetAge(null);
  }, [collectionKey]);

  const year = currentYear ?? new Date().getFullYear();
  const persistedPeriod = song?.period ?? null;
  const persistedMetAge = isMetAge(song?.metAge) ? (song?.metAge as number) : null;
  const metAge = chosenMetAge ?? persistedMetAge;
  const chosenPeriod = chosen ?? (isPeriod(persistedPeriod) ? persistedPeriod : null);
  const currentAge = currentAgeFor(birthYear, year);
  const defaultPeriod = suggestedPeriod({
    birthYear,
    releaseYear: song?.releaseYear ?? null,
    currentYear: year,
  });
  // The effective period: the listener's stated exact age wins (derived through
  // the stage thresholds), else their period choice, else the card's smart
  // default. An age is more specific than a period, so it takes precedence.
  const derivedFromAge = metAge != null ? periodForAge(metAge) : null;
  const period: Period | null = derivedFromAge ?? chosenPeriod ?? defaultPeriod;
  // A persisted/effective period is ALWAYS offered (and highlighted) even when
  // it would no longer be available (e.g. above the listener's current age).
  const options = useMemo(() => {
    const base = availablePeriods(currentAge);
    return period && !base.includes(period) ? [...base, period] : base;
  }, [currentAge, period]);

  const selectPeriod = (next: Period) => {
    setChosen(next);
    onPeriodChange?.(next);
  };
  const selectMetAge = (next: number | null) => {
    setChosenMetAge(next);
    onMetAgeChange?.(next);
  };

  const art = useCardArtwork(song, { cardIndex: card.index });
  const templateUrl = templateFile ? cardTemplateUrl(templateFile) : undefined;
  const { value: encounterAge, discoveredLater } = resolveEncounterAge({
    metAge,
    birthYear,
    releaseYear: song?.releaseYear ?? null,
    period,
    currentYear: year,
  });
  // Chip label: the stated/default period's label, or the English prompt when
  // no meeting is known yet (never invent one).
  const stageLabel = period ? periodLabel(period) : MEETING_PROMPT;
  const releaseYear = song?.releaseYear ?? null;
  // Meta line: the "met" part shows the exact age when stated, else the period
  // label, else nothing; the release year is appended when known.
  const metPart = metAge != null ? `Met at ${metAge}` : period ? `Met in ${stageLabel}` : "";
  const metaLeft = [metPart, releaseYear != null ? String(releaseYear) : "", card.eraTitle]
    .filter((part) => part.length > 0)
    .join(" · ");
  const lore = useCardLore(song, {
    encounterAge,
    discoveredLater,
    birthYear,
    mood: (song as { mood?: string | null } | null)?.mood ?? null,
    cardIndex: card.index,
    genre: song ? `${song.title} ${song.artist} ${song.album ?? ""}` : null,
    language,
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
  const eraValue = releaseYear ? `${Math.floor(releaseYear / 10) * 10}s` : card.ageRange;
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
      periodChip={
        <PeriodChip
          label={stageLabel}
          selected={period}
          options={options}
          onSelect={selectPeriod}
          metAge={metAge}
          maxAge={currentAge}
          onMetAge={selectMetAge}
        />
      }
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
