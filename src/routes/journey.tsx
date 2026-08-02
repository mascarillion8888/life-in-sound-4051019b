import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/journey/ProgressBar";
import { QuestionCard } from "@/components/journey/QuestionCard";
import { questions } from "@/lib/questions";

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
  const [current, setCurrent] = useState(1);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const question = questions[current - 1];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 glow-gold opacity-60" />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-24">
        <div className="w-full max-w-2xl">
          <ProgressBar current={current} total={total} />
        </div>

        <div className="mt-12 w-full max-w-2xl">
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

        <div className="mt-12 flex w-full max-w-2xl flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            disabled={current === total}
            onClick={() => setCurrent((c) => Math.min(total, c + 1))}
            className="h-12 w-full rounded-full px-8 text-base font-semibold sm:w-auto"
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
