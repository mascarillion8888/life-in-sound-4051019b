/**
 * PeriodChip — the small life-period selector on an era card.
 *
 * The chip shows the song's current period label (the listener's choice, or the
 * card band's default) and opens a listbox of the seven periods. Fully
 * keyboard-driven: Up/Down move the highlight, Enter picks, Escape closes and
 * returns focus to the chip; an outside click also closes it. Accessibility
 * contract: the trigger is a button with `aria-haspopup="listbox"`, the menu is
 * a `role="listbox"` of `role="option"` items.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { PERIODS, periodLabel, type Period } from "@/lib/art/listenerPeriod";

export function PeriodChip({
  label,
  selected,
  onSelect,
}: {
  /** Visible label — the chosen period, or the band's default period. */
  label: string;
  /** Effective period, highlighted as the current option. */
  selected: Period;
  onSelect: (period: Period) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selectedIndex = Math.max(0, PERIODS.indexOf(selected));

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
      setActiveIndex((i) => (i + 1) % PERIODS.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + PERIODS.length) % PERIODS.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(PERIODS[activeIndex]);
    }
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
          {PERIODS.map((period, index) => (
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
        </div>
      )}
    </div>
  );
}

export default PeriodChip;
