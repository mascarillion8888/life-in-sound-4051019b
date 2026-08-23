import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/journey/ProgressBar";
import { QuestionCard } from "@/components/journey/QuestionCard";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { questions } from "@/lib/questions";
import { clearJourney, loadJourney, saveJourney } from "@/lib/journey-storage";
import { useSession } from "@/lib/supabase/use-session";
import {
  clearRemoteJourney,
  loadRemoteJourney,
  saveRemoteJourney,
} from "@/lib/supabase/journey-remote";
import { searchSongs, suggestSongs } from "@/lib/song/searchSong.server";
import { spotifySuggestSongs } from "@/lib/song/spotify.server";
import type { Song } from "@/lib/song/types";

const VERIFICATION_DEBOUNCE_MS = 300;
const SUGGESTION_DEBOUNCE_MS = 300;

export const Route = createFileRoute("/journey")({
  head: () => ({
    meta: [
      { title: "Your Journey — SoundMap" },
      {
        name: "description",
        content:
          "Build your personal SoundMap by answering 8 meaningful questions about the music that shaped your life.",
      },
      {
        property: "og:title",
        content: "Your Journey — SoundMap",
      },
      {
        property: "og:description",
        content:
          "Build your personal SoundMap by answering 8 meaningful questions about the music that shaped your life.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Your Journey — SoundMap",
      },
      {
        name: "twitter:description",
        content:
          "Build your personal SoundMap by answering 8 meaningful questions about the music that shaped your life.",
      },
    ],
  }),
  component: JourneyPage,
});

function JourneyPage() {
  const total = questions.length;
  const navigate = useNavigate();
  const session = useSession();
  const { t } = useLanguage();
  const [current, setCurrent] = useState(1);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  // Structured Song objects chosen for each question, kept in component state
  // for the QuestionCard display. Only the title string is persisted to the
  // existing answers store (Supabase/localStorage); structured metadata lives
  // in memory for this journey session (persistence is a later phase).
  const [songs, setSongs] = useState<Record<number, Song>>({});
  // Free-text draft for the current question's primary text box. Owned here so
  // the Next button can commit it synchronously (no race with input blur).
  const [draft, setDraft] = useState("");
  const [restored, setRestored] = useState(false);
  const [completed, setCompleted] = useState(false);
  // Per-question background verification (iTunes), keyed by the exact text it
  // was run for. Enrichment only — it never blocks, rewrites, or replaces the
  // user's typed text, and no button ever waits on it.
  const [verifications, setVerifications] = useState<
    Record<number, { text: string; status: "checking" | "verified" | "failed"; match: Song | null }>
  >({});
  // Per-question live suggestions (Spotify primary, iTunes fallback), keyed by
  // the text they were fetched for. Display-only: never authoritative, never
  // blocks input.
  const [suggestions, setSuggestions] = useState<Record<number, { text: string; songs: Song[] }>>(
    {},
  );
  const question = questions[current - 1];
  const isLast = current === total;

  const userId = session.status === "anonymous" && session.user ? session.user.id : null;

  // Restore progress once the session resolves. Uses the server copy when the
  // user is authenticated (reconciled with the local cache), otherwise the
  // localStorage fallback.
  useEffect(() => {
    if (session.status === "loading") return;

    let active = true;
    (async () => {
      const saved = userId ? await loadRemoteJourney(userId) : loadJourney();
      if (!active) return;
      if (saved) {
        setCurrent(Math.min(Math.max(saved.current, 1), total));
        setAnswers(saved.answers);
        setSongs(saved.songs ?? {});
        // Prefill the draft for the restored question so the text box reflects it.
        const restoredQuestion = questions[Math.min(Math.max(saved.current, 1), total) - 1];
        setDraft(saved.answers?.[restoredQuestion.id] ?? "");
      }
      setRestored(true);
    })();

    return () => {
      active = false;
    };
  }, [session.status, userId, total]);

  // Prefill the draft when navigating between questions so the text box shows
  // the existing answer (if any) and is empty for an unanswered question.
  useEffect(() => {
    setDraft(answers[question.id] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Persist on every change once restoration has run. Server write is async;
  // localStorage write inside saveRemoteJourney is synchronous and immediate.
  useEffect(() => {
    if (!restored || completed) return;
    if (userId) {
      void saveRemoteJourney(userId, { current, answers, songs });
    } else {
      saveJourney({ current, answers, songs });
    }
  }, [restored, completed, current, answers, songs, userId]);

  // Background verification pipeline. Fires for the typed draft (debounced)
  // and never blocks the UI: Onayla/Next commit synchronously without waiting
  // for it, `answers` always keeps the raw typed text, and any failure leaves
  // the manual song untouched. Never invents data.
  const runVerification = async (questionId: number, text: string) => {
    setVerifications((prev) => ({
      ...prev,
      [questionId]: { text, status: "checking" as const, match: null },
    }));
    let match: Song | null = null;
    try {
      const out = await searchSongs({ data: { query: text } });
      match = out.results[0] ?? null;
    } catch {
      match = null;
    }
    setVerifications((prev) => {
      // A newer draft superseded this request while it was in flight.
      if (prev[questionId]?.text !== text) return prev;
      return {
        ...prev,
        [questionId]: { text, status: match ? ("verified" as const) : ("failed" as const), match },
      };
    });
    if (match) {
      // Enrich the committed song only if it is still the manual entry for
      // this exact text — never clobber a newer choice.
      setSongs((prev) => {
        const latest = prev[questionId];
        if (!latest || latest.provider !== "manual" || latest.title !== text) return prev;
        return { ...prev, [questionId]: match };
      });
    }
  };

  // Debounced live verification: 300ms after the user stops typing, verify the
  // draft in the background (one request per pause, never per keystroke).
  const draftText = draft.trim();
  useEffect(() => {
    if (draftText.length < 2) return;
    const existing = verifications[question.id];
    if (existing && existing.text === draftText) return;
    const timer = setTimeout(() => {
      void runVerification(question.id, draftText);
    }, VERIFICATION_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draftText, question.id, verifications]);

  // Debounced live suggestion: 300ms after the user stops typing, fetch the
  // provider list for the dropdown. Display-only; free-text always wins.
  useEffect(() => {
    if (draftText.length < 3) return;
    const existing = suggestions[question.id];
    if (existing && existing.text === draftText) return;
    const timer = setTimeout(() => {
      void (async () => {
        let songs: Song[] = [];
        try {
          const out = await spotifySuggestSongs({ data: { query: draftText } });
          songs = out.results;
        } catch {
          songs = [];
        }
        if (songs.length === 0) {
          try {
            const out = await suggestSongs({ data: { query: draftText } });
            songs = out.results;
          } catch {
            songs = [];
          }
        }
        if (songs.length > 0) {
          setSuggestions((prev) => {
            if (prev[question.id]?.text === draftText) return prev;
            return { ...prev, [question.id]: { text: draftText, songs } };
          });
        }
      })();
    }, SUGGESTION_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draftText, question.id, suggestions]);

  // Green check: only for an entry the iTunes verification actually matched.
  const selectedSong = songs[question.id];
  const verified =
    verifications[question.id]?.status === "verified" ||
    (selectedSong?.provider === "itunes" && selectedSong?.verified === true);

  const handleDraftChange = (text: string) => {
    setDraft(text);
    // Any edit invalidates stale verification/suggestion state for this question.
    setVerifications((prev) => {
      if (!(question.id in prev)) return prev;
      const next = { ...prev };
      delete next[question.id];
      return next;
    });
    setSuggestions((prev) => {
      if (!(question.id in prev)) return prev;
      const next = { ...prev };
      delete next[question.id];
      return next;
    });
  };

  // Use an already-resolved verification for this exact text at commit time,
  // without waiting for anything still in flight.
  const withVerifiedMatch = (questionId: number, manual: Song): Song => {
    const v = verifications[questionId];
    return v && v.text === manual.title && v.match ? v.match : manual;
  };

  const startNewJourney = () => {
    if (userId) {
      void clearRemoteJourney(userId);
    } else {
      clearJourney();
    }
    setCompleted(false);
    setAnswers({});
    setSongs({});
    setDraft("");
    setVerifications({});
    setSuggestions({});
    setCurrent(1);
  };

  const savedProgress = current > 1 || Object.keys(answers).length > 0;

  const isAnswered = Boolean(answers[question.id]);
  const hasPendingDraft = draft.trim().length > 0;
  const unanswered = questions.filter((q) => !answers[q.id]);
  const canFinish = unanswered.length === 0;
  // A typed-but-uncommitted draft for the current question also lets the user
  // advance (Next commits it synchronously). For the last question, a draft
  // only finishes the journey when the current question is the only one left.
  const canAdvance = isLast
    ? canFinish || (hasPendingDraft && unanswered.length === 1 && unanswered[0].id === question.id)
    : isAnswered || hasPendingDraft;
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setShowHint(false);
  }, [current, isAnswered]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 glow-gold opacity-60" />
      <div className="absolute right-5 top-5 z-20 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>
      <main className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-5 py-16 sm:px-6 md:py-24">
        <div className="w-full max-w-2xl">
          <ProgressBar current={current} total={total} />
        </div>

        <div className="mt-8 w-full max-w-2xl md:mt-12">
          <QuestionCard
            key={question.id}
            number={current}
            title={question.title}
            description={question.description}
            answer={answers[question.id]}
            selected={songs[question.id] ?? null}
            verified={verified}
            suggestions={suggestions[question.id]?.songs}
            onSelectSuggestion={(song) => {
              setAnswers((prev) => ({ ...prev, [question.id]: song.title }));
              setSongs((prev) => ({ ...prev, [question.id]: song }));
              setDraft("");
            }}
            draft={draft}
            onDraftChange={handleDraftChange}
            onChoose={(song) => {
              // answers keeps the raw typed text; the structured song is
              // enriched only when a verification for this exact text has
              // already resolved — committing never waits on it.
              setAnswers((prev) => ({ ...prev, [question.id]: song.title }));
              setSongs((prev) => ({
                ...prev,
                [question.id]: withVerifiedMatch(question.id, song),
              }));
            }}
          />
        </div>

        <div className="mt-8 flex w-full max-w-2xl md:mt-12 flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="outline"
            disabled={current === 1}
            onClick={() => setCurrent((c) => Math.max(1, c - 1))}
            className="h-12 w-full rounded-full px-8 text-base font-medium sm:w-auto"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <Button
            onClick={() => {
              if (!canAdvance) {
                setShowHint(true);
                return;
              }
              // Commit a pending draft for the current question before moving on
              // (so typing + Next proceeds in one step, no separate "Onayla" needed).
              let nextAnswers = answers;
              if (!isAnswered && hasPendingDraft) {
                const trimmed = draft.trim();
                nextAnswers = { ...answers, [question.id]: trimmed };
                setAnswers(nextAnswers);
                setSongs((prev) => ({
                  ...prev,
                  [question.id]: withVerifiedMatch(question.id, {
                    provider: "manual",
                    providerId: crypto.randomUUID(),
                    title: trimmed,
                    artist: "",
                    album: null,
                    artworkUrl: null,
                    releaseYear: null,
                    isrc: null,
                  }),
                }));
              }
              if (isLast) {
                // Journey finished — keep the answers persisted so /results can
                // reload them on a direct visit / F5 (history state is lost on
                // refresh). The user can still wipe progress via the "Start New
                // Journey" action. We only stop further auto-save by marking
                // the local component as completed.
                setCompleted(true);
                navigate({ to: "/results", state: { answers: nextAnswers } as never });
              } else {
                setCurrent((c) => Math.min(total, c + 1));
              }
            }}
            aria-disabled={!canAdvance}
            className={`h-12 w-full rounded-full px-8 text-base font-semibold sm:w-auto ${
              canAdvance ? "" : "opacity-50"
            }`}
          >
            {isLast ? t.journey.seeResults : t.journey.next}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {showHint && !canAdvance ? (
          <p
            role="alert"
            className="mt-6 flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2 text-center text-sm font-medium text-primary"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {isLast
              ? t.journey.missingAnswers(unanswered.map((q) => q.id).join(", "))
              : t.journey.chooseSongHint}
          </p>
        ) : null}

        {savedProgress ? (
          <button
            onClick={startNewJourney}
            className="mt-10 inline-flex items-center gap-2 rounded-full border border-border/60 px-5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <RotateCcw className="h-4 w-4" />
            {t.journey.startNewJourney}
          </button>
        ) : null}
      </main>
    </div>
  );
}
