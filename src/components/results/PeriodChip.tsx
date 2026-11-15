/**
 * PeriodChip — the small life-period selector on an era card.
 *
 * The chip shows the listener's current meeting label (their stated period, or
 * the card's smart default, or the English "When did you meet it?" prompt) and
 * opens a listbox of the periods the listener may be offered (see
 * `availablePeriods`). Below the options sits an optional numeric field for an
 * exact meeting age. Fully keyboard-driven: Up/Down move the highlight, Enter
 * picks, Escape closes and returns focus to the chip; an outside click also
 * closes it. Accessibility contract: the trigger is a button with
 * `aria-haspopup="listbox"`, the menu is a `role="listbox"` of `role="option"`
 * items, and the age input has a label + aria-label.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { periodLabel, type Period } from "@/lib/art/listenerPeriod";

export function PeriodChip({
  label,
  selected,
  options,
  onSelect,
  metAge,
  maxAge,
  onMetAge,
}: {
  /** Visible label — the chosen/default period, or the meeting prompt. */
  label: string;
  /** Effective period, highlighted as the current option (null = none yet). */
  selected: Period | null;
  /** The periods the listener may be offered, in life order. */
  options: Period[];
  onSelect: (period: Period) => void;
  /** The listener's exact meeting age, if stated. */
  metAge?: number | null;
  /** Upper bound for the age input (the listener's current age), if known. */
  maxAge?: number | null;
  /** Reports a typed exact meeting age (null clears it). */
  onMetAge?: (age: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [draftAge, setDraftAge] = useState(metAge != null ? String(metAge) : "");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedIndex = Math.max(0, selected ? options.indexOf(selected) : 0);

  useEffect(() => {
    setDraftAge(metAge != null ? String(metAge) : "");
  }, [metAge]);

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const openMenu = () => {
    setActiveIndex(selectedIndex);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };
  const choose = (period: Period) => {
    onSelect(period);
    close();
  };

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMenu();
    }
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(options[activeIndex]);
    }
  };

  const commitAge = () => {
    const trimmed = draftAge.trim();
    if (trimmed === "") {
      onMetAge?.(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0) return;
    if (maxAge != null && parsed > maxAge) return;
    onMetAge?.(parsed);
  };

  return (
    <div className="pc-period">
      <button
        ref={buttonRef}
        type="button"
        className="pc-chip"
        data-testid="card-stage-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Life period: ${label}`}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onButtonKeyDown}
      >
        {label}
      </button>
      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label="Life period"
          data-testid="period-listbox"
          className="pc-chip-menu"
          onKeyDown={onListKeyDown}
        >
          {options.map((period, index) => (
            <div
              key={period}
              role="option"
              tabIndex={-1}
              aria-selected={period === selected}
              data-testid={`period-option-${period}`}
              className={`pc-chip-option${index === activeIndex ? " active" : ""}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(period)}
            >
              {periodLabel(period)}
            </div>
          ))}
          <label className="pc-chip-age">
            <span>Age (optional)</span>
            <input
              type="text"
              inputMode="numeric"
              data-testid="period-age-input"
              aria-label="Age (optional)"
              value={draftAge}
              onChange={(event) => setDraftAge(event.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitAge();
                  close();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                }
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export default PeriodChip;
