import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/journey/ProgressBar";
import { QuestionCard } from "@/components/journey/QuestionCard";
import { questions } from "@/lib/questions";
import { clearJourney, loadJourney, saveJourney } from "@/lib/journey-storage";
import { useSession } from "@/lib/supabase/use-session";
import {
  clearRemoteJourney,
  loadRemoteJourney,
  saveRemoteJourney,
} from "@/lib/supabase/journey-remote";
import type { Song } from "@/lib/song/types";

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
  const [current, setCurrent] = useState(1);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  // Structured Song objects chosen for each question, kept in component state
  // for the QuestionCard display. Only the title string is persisted to the
  // existing answers store (Supabase/localStorage); structured metadata lives
  // in memory for this journey session (persistence is a later phase).
  const [songs, setSongs] = useState<Record<number, Song>>({});
  const [restored, setRestored] = useState(false);
  const [completed, setCompleted] = useState(false);
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
      }
      setRestored(true);
    })();

    return () => {
      active = false;
    };
  }, [session.status, userId, total]);

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

  const startNewJourney = () => {
    if (userId) {
      void clearRemoteJourney(userId);
    } else {
      clearJourney();
    }
    setCompleted(false);
    setAnswers({});
    setSongs({});
    setCurrent(1);
  };

  const savedProgress = current > 1 || Object.keys(answers).length > 0;

  const isAnswered = Boolean(answers[question.id]);
  const unanswered = questions.filter((q) => !answers[q.id]);
  const canFinish = unanswered.length === 0;
  const canAdvance = isLast ? canFinish : isAnswered;
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setShowHint(false);
  }, [current, isAnswered]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 glow-gold opacity-60" />
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
            onChoose={(song) => {
              setAnswers((prev) => ({ ...prev, [question.id]: song.title }));
              setSongs((prev) => ({ ...prev, [question.id]: song }));
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
              if (isLast) {
                // Journey finished — keep the answers persisted so /results can
                // reload them on a direct visit / F5 (history state is lost on
                // refresh). The user can still wipe progress via the "Start New
                // Journey" action. We only stop further auto-save by marking
                // the local component as completed.
                setCompleted(true);
                navigate({ to: "/results", state: { answers } as never });
              } else {
                setCurrent((c) => Math.min(total, c + 1));
              }
            }}
            aria-disabled={!canAdvance}
            className={`h-12 w-full rounded-full px-8 text-base font-semibold sm:w-auto ${
              canAdvance ? "" : "opacity-50"
            }`}
          >
            {isLast ? "See Your Results" : "Next"}
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
              ? `Still missing an answer for question${unanswered.length > 1 ? "s" : ""} ${unanswered
                  .map((q) => q.id)
                  .join(", ")}.`
              : "Choose a song before moving on."}
          </p>
        ) : null}

        {savedProgress ? (
          <button
            onClick={startNewJourney}
            className="mt-10 inline-flex items-center gap-2 rounded-full border border-border/60 px-5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <RotateCcw className="h-4 w-4" />
            Start New Journey
          </button>
        ) : null}
      </main>
    </div>
  );
}
