import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { analyzeUserJourney } from "@/lib/ai/pipeline";
import { feedEntryIntensity, type LifeFeedEntry } from "@/lib/life-feed";
import { deterministicPoeticAnalysis } from "@/lib/llm/poetic-analyzer";
import type { Song } from "@/lib/song/types";
import { PosterCanvas } from "./PosterCanvas";

const SONG_TITLES = [
  "Judas Priest - Painkiller",
  "Metallica - Fade to Black",
  "Black Sabbath - Iron Man",
  "Queensrÿche - Silent Lucidity",
  "Iron Maiden - The Trooper",
  "Dio - Rainbow in the Dark",
  "Slayer - Raining Blood",
  "Pink Floyd - Wish You Were Here",
];

const SONGS: Song[] = SONG_TITLES.map((title, i) => ({
  provider: "manual" as const,
  providerId: `test-${i + 1}`,
  title,
  artist: title.split(" - ")[0] ?? "",
  album: null,
  artworkUrl: null,
  isrc: null,
}));

function makeAnalysis() {
  const answers: Record<number, string> = {};
  SONG_TITLES.forEach((song, i) => {
    answers[i + 1] = song;
  });
  const profile = analyzeUserJourney(answers);
  if (!profile) throw new Error("fixture profile must exist");
  return deterministicPoeticAnalysis(profile, SONG_TITLES);
}

describe("PosterCanvas", () => {
  it("renders manifesto, chapters, insights, duality and export action", () => {
    const analysis = makeAnalysis();
    render(<PosterCanvas analysis={analysis} songs={SONGS} />);

    // Manifesto.
    expect(screen.getByText(`“${analysis.manifesto}”`)).toBeInTheDocument();

    // Chapter cards with their songs.
    for (const chapter of analysis.chapters) {
      expect(screen.getAllByText(chapter.title).length).toBeGreaterThanOrEqual(1);
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
    expect(screen.getByRole("button", { name: /download poster/i })).toBeInTheDocument();
  });

  it("renders the age phase roadmap with 4 phases", () => {
    const analysis = makeAnalysis();
    render(<PosterCanvas analysis={analysis} songs={SONGS} />);

    expect(screen.getByText(/life phase roadmap/i)).toBeInTheDocument();
    expect(screen.getAllByText("FIRST SPARK").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("AWAKENING").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("PASSAGES").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("DEEP RESONANCE").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Ages 9–12")).toBeInTheDocument();
    expect(screen.getByText("Ages 12–18")).toBeInTheDocument();
    expect(screen.getByText("Ages 18–28")).toBeInTheDocument();
    expect(screen.getByText("Ages 35+")).toBeInTheDocument();
  });

  it("renders SVG waveform instead of bar chart", () => {
    const analysis = makeAnalysis();
    render(<PosterCanvas analysis={analysis} songs={SONGS} />);

    const svg = document.querySelector("svg[aria-label='Emotional intensity waveform']");
    expect(svg).toBeInTheDocument();
    expect(svg?.querySelector("path")).toBeInTheDocument();
  });

  it("renders poetic footer quotes", () => {
    const analysis = makeAnalysis();
    render(<PosterCanvas analysis={analysis} songs={SONGS} />);

    expect(screen.getByText(/first i tried to understand/i)).toBeInTheDocument();
    expect(screen.getByText(/music changes\. we change\. but it always stays with us\./i)).toBeInTheDocument();
  });

  it("applies the dynamic theme palette to the poster surface", () => {
    const analysis = makeAnalysis();
    render(<PosterCanvas analysis={analysis} songs={SONGS} />);

    const section = screen.getByLabelText("Dynamic Music Map poster");
    expect(analysis.visual.themeId).toBe("metal-gothic");
    const style = section.getAttribute("style") ?? "";
    const rgb = (hex: string) => {
      const int = Number.parseInt(hex.slice(1), 16);
      return `rgb(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255})`;
    };
    expect(style).toContain(rgb(analysis.visual.palette.background));
    expect(style).toContain(rgb(analysis.visual.palette.text));
  });

  it("evolves: Life Feed entries extend the curve and the playlist", () => {
    const analysis = makeAnalysis();
    const feedEntries: LifeFeedEntry[] = [
      {
        id: "lf-1",
        song: {
          provider: "manual",
          providerId: "m1",
          title: "Nightcall",
          artist: "Kavinsky",
          album: null,
          artworkUrl: null,
          isrc: null,
        },
        note: "gece sürüşü",
        insight: null,
        addedAt: "2026-08-22T21:00:00.000Z",
      },
      {
        id: "lf-2",
        song: {
          provider: "manual",
          providerId: "m2",
          title: "Sunset Runner",
          artist: "",
          album: null,
          artworkUrl: null,
          isrc: null,
        },
        note: null,
        insight: null,
        addedAt: "2026-08-22T22:00:00.000Z",
      },
    ];

    render(<PosterCanvas analysis={analysis} songs={SONGS} feedEntries={feedEntries} />);

    // Playlist section lists the new entries.
    expect(screen.getByText(/the map keeps growing/i)).toBeInTheDocument();
    expect(screen.getByText("Nightcall")).toBeInTheDocument();
    expect(screen.getByText("Sunset Runner")).toBeInTheDocument();

    // The emotional curve grew from 8 to 10 points: "+1"/"+2" markers exist
    expect(screen.getAllByText("+1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("+2").length).toBeGreaterThanOrEqual(1);
  });

  it("without feed entries there is no playlist section", () => {
    render(<PosterCanvas analysis={makeAnalysis()} songs={SONGS} />);
    expect(screen.queryByText(/the map keeps growing/i)).not.toBeInTheDocument();
  });
});
