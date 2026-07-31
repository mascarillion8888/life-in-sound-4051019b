import { Progress } from "@/components/ui/progress";

export function ProgressBar({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const value = (current / total) * 100;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        <span>Question {current}</span>
        <span>of {total}</span>
      </div>
      <Progress value={value} className="h-4 bg-primary/20" />
    </div>
  );
}
