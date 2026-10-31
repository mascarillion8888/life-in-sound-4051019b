import { useState } from "react";
import { parseBirthYear } from "@/lib/supabase/birthYear";

type Props = {
  onSave: (year: number) => void | Promise<void>;
  onSkip: () => void;
};

/**
 * One question, one field: which year were you born? Skippable. Only the year
 * is asked for, never a full date.
 */
export function BirthYearPrompt({ onSave, onSkip }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const year = parseBirthYear(value);
    if (year == null) {
      setError(`Enter a four-digit year, like 1985.`);
      return;
    }
    setError(null);
    await onSave(year);
  };

  return (
    <form onSubmit={submit} data-testid="birth-year-prompt" style={{ display: "grid", gap: 12, maxWidth: 360 }}>
      <label htmlFor="birth-year-input" style={{ fontSize: 18 }}>
        Which year were you born?
      </label>
      <p style={{ margin: 0, opacity: 0.7, fontSize: 14 }}>
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
        style={{ padding: "10px 12px", fontSize: 18, borderRadius: 10 }}
      />
      {error && (
        <div id="birth-year-error" role="alert" style={{ color: "#c0392b", fontSize: 14 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" data-testid="birth-year-save">
          Continue
        </button>
        <button type="button" data-testid="birth-year-skip" onClick={onSkip}>
          Skip for now
        </button>
      </div>
    </form>
  );
}
