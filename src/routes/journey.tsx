import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/journey/ProgressBar";
import { QuestionCard } from "@/components/journey/QuestionCard";
import { questions } from "@/lib/questions";
import { clearJourney, loadJourney, saveJourney } from "@/lib/journey-storage";



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
  const [current, setCurrent] = useState(1);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [restored, setRestored] = useState(false);
  const [completed, setCompleted] = useState(false);
  const question = questions[current - 1];
  const isLast = current === total;

  // Restore any saved progress after hydration.
  useEffect(() => {
    const saved = loadJourney();
    if (saved) {
      setCurrent(Math.min(Math.max(saved.current, 1), total));
      setAnswers(saved.answers);
    }
    setRestored(true);
  }, [total]);

  // Persist on every change once restoration has run.
  useEffect(() => {
    if (!restored || completed) return;
    saveJourney({ current, answers });
  }, [restored, completed, current, answers]);

  const startNewJourney = () => {
    clearJourney();
    setAnswers({});
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
            onChoose={(song) =>
              setAnswers((prev) => ({ ...prev, [question.id]: song }))
            }
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
                // Journey finished — progress is no longer needed.
                setCompleted(true);
                clearJourney();
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

