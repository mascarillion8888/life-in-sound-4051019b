import { useState } from "react";
import { Button } from "@/components/ui/button";
import { parseBirthYear } from "@/lib/supabase/birthYear";

type Props = {
  /** Prefills the field when the listener is changing an existing year. */
  initialValue?: number | null;
  onSave: (year: number) => void | Promise<void>;
  onSkip: () => void;
};

/**
 * One question, one field: which year were you born? Skippable. Only the year
 * is asked for, never a full date.
 */
export function BirthYearPrompt({ initialValue, onSave, onSkip }: Props) {
  const [value, setValue] = useState(initialValue != null ? String(initialValue) : "");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const year = parseBirthYear(value);
    if (year == null) {
      setError("Enter a four-digit year, like 1985.");
      return;
    }
    setError(null);
    await onSave(year);
  };

  return (
    <form
      onSubmit={submit}
      data-testid="birth-year-prompt"
      className="grid w-full max-w-sm gap-4 text-center"
    >
      <label htmlFor="birth-year-input" className="text-2xl font-semibold tracking-tight">
        Which year were you born?
      </label>
      <p className="text-sm text-muted-foreground">
        Your songs are told for the age you were when you first heard them. Only the year is kept.
      </p>
      <input
        id="birth-year-input"
        data-testid="birth-year-input"
        inputMode="numeric"
        autoComplete="bday-year"
        maxLength={4}
        placeholder="1985"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        aria-invalid={error != null}
        aria-describedby={error ? "birth-year-error" : undefined}
        className="rounded-xl border border-border bg-card px-4 py-3 text-center text-2xl tracking-widest text-foreground outline-none focus:border-primary"
      />
      {error && (
        <div id="birth-year-error" role="alert" className="text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex justify-center gap-3">
        <Button type="submit" data-testid="birth-year-save" className="rounded-full px-8">
          Continue
        </Button>
        <Button
          type="button"
          variant="outline"
          data-testid="birth-year-skip"
          onClick={onSkip}
          className="rounded-full px-6"
        >
          Skip for now
        </Button>
      </div>
    </form>
  );
}
