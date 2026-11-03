import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BirthYearPrompt } from "./BirthYearPrompt";

describe("BirthYearPrompt when changing an existing year", () => {
  it("prefills the field with the saved year", () => {
    render(<BirthYearPrompt initialValue={1985} onSave={vi.fn()} onSkip={vi.fn()} />);
    expect((screen.getByTestId("birth-year-input") as HTMLInputElement).value).toBe("1985");
  });

  it("saves the corrected year", async () => {
    const onSave = vi.fn();
    render(<BirthYearPrompt initialValue={1985} onSave={onSave} onSkip={vi.fn()} />);
    fireEvent.change(screen.getByTestId("birth-year-input"), { target: { value: "1990" } });
    fireEvent.click(screen.getByTestId("birth-year-save"));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(1990));
  });

  it("starts empty when there is no saved year", () => {
    render(<BirthYearPrompt onSave={vi.fn()} onSkip={vi.fn()} />);
    expect((screen.getByTestId("birth-year-input") as HTMLInputElement).value).toBe("");
  });
});
