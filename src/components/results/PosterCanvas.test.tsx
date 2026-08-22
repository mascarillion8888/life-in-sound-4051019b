import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { analyzeUserJourney } from "@/lib/ai/pipeline";
import { deterministicPoeticAnalysis } from "@/lib/llm/poetic-analyzer";
import { PosterCanvas } from "./PosterCanvas";

const SONGS = [
  "Judas Priest - Painkiller",
  "Metallica - Fade to Black",
  "Black Sabbath - Iron Man",
  "Queensrÿche - Silent Lucidity",
  "Iron Maiden - The Trooper",
  "Dio - Rainbow in the Dark",
  "Slayer - Raining Blood",
  "Pink Floyd - Wish You Were Here",
];

function makeAnalysis() {
  const answers: Record<number, string> = {};
  SONGS.forEach((song, i) => {
    answers[i + 1] = song;
  });
  const profile = analyzeUserJourney(answers);
  if (!profile) throw new Error("fixture profile must exist");
  return deterministicPoeticAnalysis(profile, SONGS);
}

describe("PosterCanvas", () => {
  it("renders manifesto, chapters, insights, duality and export action", () => {
    const analysis = makeAnalysis();
    render(<PosterCanvas analysis={analysis} songs={SONGS} />);

    // Manifesto.
    expect(screen.getByText(`“${analysis.manifesto}”`)).toBeInTheDocument();

    // Chapter cards with their songs.
    for (const chapter of analysis.chapters) {
      expect(screen.getByText(chapter.title)).toBeInTheDocument();
    }

    // One insight row per song.
    for (const insight of analysis.songInsights) {
      expect(screen.getByText(insight.insight)).toBeInTheDocument();
    }

    // Core duality poles.
    expect(screen.getByText(analysis.coreDuality.left)).toBeInTheDocument();
    expect(screen.getByText(analysis.coreDuality.right)).toBeInTheDocument();
    expect(screen.getByText(analysis.coreDuality.resolution)).toBeInTheDocument();

    // Aura keywords.
    for (const keyword of analysis.visual.aura) {
      expect(screen.getByText(keyword)).toBeInTheDocument();
    }

    // Export action.
    expect(screen.getByRole("button", { name: /export high-res poster/i })).toBeInTheDocument();
  });

  it("applies the dynamic theme palette to the poster surface", () => {
    const analysis = makeAnalysis();
    render(<PosterCanvas analysis={analysis} songs={SONGS} />);

    const section = screen.getByLabelText("Dynamic Music Map poster");
    expect(analysis.visual.themeId).toBe("metal-gothic");
    // jsdom normalizes hex → rgb in CSSOM, so compare in rgb form.
    const style = section.getAttribute("style") ?? "";
    const rgb = (hex: string) => {
      const int = Number.parseInt(hex.slice(1), 16);
      return `rgb(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255})`;
    };
    expect(style).toContain(rgb(analysis.visual.palette.background));
    expect(style).toContain(rgb(analysis.visual.palette.text));
  });
});
