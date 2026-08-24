import { useEffect, useRef, useState } from "react";

import type { Song } from "@/lib/song/types";
import type { JourneyProgress } from "@/lib/journey-storage";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Language } from "@/lib/i18n/languages";
import {
  appendLifeFeedEntry,
  graduateToLifeFeed,
  isJourneyComplete,
  loadLifeFeed,
  removeLifeFeedEntry,
  saveLifeFeed,
  updateLifeFeedEntry,
  type LifeFeedState,
} from "@/lib/life-feed";
import { deterministicEntryInsight } from "@/lib/llm/poetic-analyzer";
import { generateEntryInsight } from "@/lib/llm/generateAnalysis.server";
import { LifeFeedInput, type SongSuggester } from "./LifeFeedInput";
import { LifeFeedTimeline } from "./LifeFeedTimeline";

/** Instant-insight provider, injectable for tests. Defaults to the Gemini server function. */
export type EntryInsightFetcher = (input: {
  song: Song;
  note: string | null;
  language: Language;
}) => Promise<string | null>;

const defaultInsightFetcher: EntryInsightFetcher = ({ song, note, language }) =>
  generateEntryInsight({
    data: { songTitle: song.title, artist: song.artist || undefined, note, language },
  })
    .then((r) => r?.insight ?? null)
    .catch(() => null);

/**
 * Life Feed section — owns the feed state, persistence, and the
 * deterministic-now / Gemini-when-ready insight upgrade.
 *
 * Graduation: on mount, a completed journey becomes a Life Feed exactly once
 * (an already-persisted feed is loaded instead — the base 8 are never
 * re-created). Every mutation persists immediately; `onFeedChange` lifts the
 * state so the poster evolves with the feed.
 */
export function LifeFeedSection({
  journey,
  onFeedChange,
  insightFetcher = defaultInsightFetcher,
  suggester,
}: {
  journey: JourneyProgress | null;
  onFeedChange?: (state: LifeFeedState | null) => void;
  insightFetcher?: EntryInsightFetcher;
  suggester?: SongSuggester;
}) {
  const [feed, setFeed] = useState<LifeFeedState | null>(null);
  const [pending, setPending] = useState(false);
  const { language } = useLanguage();
  const feedRef = useRef<LifeFeedState | null>(null);
  feedRef.current = feed;

  // Load the persisted feed, or graduate a completed journey into a new one.
  useEffect(() => {
    const stored = loadLifeFeed();
    if (stored) {
      setFeed(stored);
      return;
    }
    const graduated = graduateToLifeFeed(journey);
    if (graduated) {
      setFeed(graduated);
      saveLifeFeed(graduated);
    }
  }, [journey]);

  useEffect(() => {
    onFeedChange?.(feed);
  }, [feed, onFeedChange]);

  const mutate = (next: LifeFeedState) => {
    setFeed(next);
    saveLifeFeed(next);
  };

  const handleAdd = ({ song, note }: { song: Song; note: string | null }) => {
    const current = feedRef.current;
    if (!current || pending) return;
    setPending(true);

    // Instant deterministic insight — the friend answers immediately.
    const insight = deterministicEntryInsight({ songTitle: song.title, note });
    const next = appendLifeFeedEntry(current, { song, note, insight });
    mutate(next);

    const entryId = next.entries[next.entries.length - 1].id;
    insightFetcher({ song, note, language })
      .then((geminiInsight) => {
        if (!geminiInsight || !feedRef.current) return;
        mutate(updateLifeFeedEntry(feedRef.current, entryId, { insight: geminiInsight }));
      })
      .catch(() => {
        /* deterministic line already on screen */
      })
      .finally(() => setPending(false));
  };

  const handleDelete = (id: string) => {
    const current = feedRef.current;
    if (!current) return;
    mutate(removeLifeFeedEntry(current, id));
  };

  const handleEditNote = (id: string, note: string | null) => {
    const current = feedRef.current;
    if (!current) return;
    mutate(updateLifeFeedEntry(current, id, { note }));
  };

  if (!feed) {
    return (
      <p className="rounded-3xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        {isJourneyComplete(journey)
          ? "Preparing your Life Feed…"
          : "Complete your 8-song journey to unlock the Life Feed."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <LifeFeedInput onAdd={handleAdd} pending={pending} suggester={suggester} />
      <LifeFeedTimeline
        entries={feed.entries}
        onDelete={handleDelete}
        onEditNote={handleEditNote}
      />
    </div>
  );
}
