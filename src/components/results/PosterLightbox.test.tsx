import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { resolvePosterTheme } from "@/lib/soundmap/posterTheme";
import PosterLightbox from "./PosterLightbox";

describe("PosterLightbox", () => {
  it("re-casts the frame in the resolved poster theme (Bronze for Metal journeys)", () => {
    const theme = resolvePosterTheme({ genres: ["Heavy Metal"] });
    render(<PosterLightbox theme={theme} onClose={() => {}} />);

    const frame = screen.getByTestId("lightbox-frame");
    const style = frame.getAttribute("style") ?? "";
    expect(style).toContain("rgb(169, 113, 66)"); // bronze border
    expect(style).toContain("linear-gradient(180deg, rgb(11, 11, 16) 0%");
    // The image remains a static preview — only the frame re-casts.
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("Neon Magenta frame for synthwave journeys — palette never drifts from the sheet", () => {
    const theme = resolvePosterTheme({ genres: ["synthwave"] });
    render(<PosterLightbox theme={theme} onClose={() => {}} />);
    const frame = screen.getByTestId("lightbox-frame");
    const style = frame.getAttribute("style") ?? "";
    expect(style).toContain("rgb(255, 47, 179)"); // neon magenta
    expect(style).toContain("linear-gradient(180deg, rgb(18, 8, 31) 0%");
  });

  it("falls back to the Gold default when no theme is passed", () => {
    render(<PosterLightbox onClose={() => {}} />);
    const frame = screen.getByTestId("lightbox-frame");
    expect(frame.getAttribute("style") ?? "").toContain("rgb(212, 175, 55)"); // gold
  });
});
