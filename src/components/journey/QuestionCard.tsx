import { useState } from "react";
import { Check, Music2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function QuestionCard({
  number,
  title,
  description,
  answer,
  onChoose,
}: {
  number: number;
  title: string;
  description: string;
  answer?: string;
  onChoose: (song: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full rounded-[2rem] border border-border/50 bg-card/60 p-6 backdrop-blur-xl sm:p-8 md:p-12">
      <div className="space-y-4">
        <span className="text-sm font-semibold uppercase tracking-widest text-primary">
          Question {number}
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
          {title}
        </h2>
        <p className="text-base leading-relaxed text-foreground/80 sm:text-lg">{description}</p>
      </div>

      <Button
        onClick={() => {
          setOpen(true);
          onChoose(`Song for question ${number}`);
        }}
        className="mt-8 h-14 w-full gap-3 sm:mt-10 sm:h-16 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-primary/30 active:scale-[0.98]"
      >
        <Music2 className="h-5 w-5" />
        Choose Song
      </Button>

      {answer ? (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-primary">
          <Check className="h-4 w-4" />
          {answer}
        </p>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-border/50 bg-card/95 text-foreground sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Song selection</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Song selection coming in Sprint 2.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
