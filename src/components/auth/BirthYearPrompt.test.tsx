import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BirthYearPrompt } from "./BirthYearPrompt";

function setup() {
  const onSave = vi.fn();
  const onSkip = vi.fn();
  render(<BirthYearPrompt onSave={onSave} onSkip={onSkip} />);
  const input = screen.getByTestId("birth-year-input") as HTMLInputElement;
  return { onSave, onSkip, input };
}

describe("BirthYearPrompt", () => {
  it("shows an error and does not save for an invalid year", () => {
    const { onSave, input } = setup();
    fireEvent.change(input, { target: { value: "85" } });
    fireEvent.click(screen.getByTestId("birth-year-save"));
    expect(screen.getByRole("alert").textContent).toMatch(/four-digit year/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("saves a valid year", async () => {
    const { onSave, input } = setup();
    fireEvent.change(input, { target: { value: "1985" } });
    fireEvent.click(screen.getByTestId("birth-year-save"));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(1985));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("strips non-digits as the user types", () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: "19a8b5" } });
    expect(input.value).toBe("1985");
  });

  it("lets the user skip without saving", () => {
    const { onSave, onSkip } = setup();
    fireEvent.click(screen.getByTestId("birth-year-skip"));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("rejects a year in the future", () => {
    const { onSave, input } = setup();
    const next = String(new Date().getFullYear() + 1);
    fireEvent.change(input, { target: { value: next } });
    fireEvent.click(screen.getByTestId("birth-year-save"));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
});
