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

    // Aura pill glassmorphism styling hook.
    const pill = screen.getByText(analysis.visual.aura[0]);
    expect(pill.className).toContain("backdrop-blur-sm");
  });

  it("renders the age phase roadmap with 6 phases", () => {
    const analysis = makeAnalysis();
    render(<PosterCanvas analysis={analysis} songs={SONGS} />);

    expect(screen.getByText(/life phase roadmap/i)).toBeInTheDocument();
    expect(screen.getAllByText("DISCOVERY & WONDER").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("MENTAL AWAKENING").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("STRENGTH & TRIUMPH").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("THRESHOLD PORTALS").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("PURE ENERGY & JOY").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("IDENTITY & SYNTHESIS").length).toBeGreaterThanOrEqual(1);
    // These age ranges also appear as badges on the MTG life cards below.
    expect(screen.getAllByText("Ages 9–12").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ages 12–18").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ages 18–24").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ages 24–30").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ages 30–35").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Ages 35+")).toBeInTheDocument();
  });

  it("renders the 8 MTG-style life cards in a 4×2 grid section", () => {
    const analysis = makeAnalysis();
    render(<PosterCanvas analysis={analysis} songs={SONGS} />);

    expect(screen.getByText("LIFE CARDS")).toBeInTheDocument();
    const cards = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => screen.getByTestId(`quiz-card-${i + 1}`));
    expect(cards).toHaveLength(8);
    // Each card carries its era frame: title, type line, stats, narrative.
    expect(screen.getByText("FIRST SPARK")).toBeInTheDocument();
    expect(screen.getAllByText("ACCEPTANCE").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Legendary Life Era")).toHaveLength(8);
  });

  it("makes every album art clickable — a Spotify search deep link", () => {
    const analysis = makeAnalysis();
    render(<PosterCanvas analysis={analysis} songs={SONGS} />);

    const links = screen.getAllByRole("link", { name: /listen to .+ on spotify/i });
    // At least one link per song (chapter strip + playlist rows).
    expect(links.length).toBeGreaterThanOrEqual(SONGS.length);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
      expect(link.getAttribute("href")).toMatch(/^https:\/\/open\.spotify\.com\/search\//);
    }
    expect(
      screen
        .getAllByRole("link", { name: /listen to judas priest - painkiller on spotify/i })[0]
        .getAttribute("href"),
    ).toContain(encodeURIComponent("Judas Priest - Painkiller"));
  });

  it("renders SVG waveform instead of bar chart", () => {
    const analysis = makeAnalysis();
    render(<PosterCanvas analysis={analysis} songs={SONGS} />);

    const svg = document.querySelector("svg[aria-label='Emotional intensity waveform']");
    expect(svg).toBeInTheDocument();
    expect(svg?.querySelector("path")).toBeInTheDocument();

    // Dynamic gradient follows the theme engine's waveGradient stops.
    const stops = svg?.querySelectorAll("linearGradient stop");
    expect(stops?.length).toBeGreaterThanOrEqual(2);
    expect(analysis.visual.waveGradient).toBeTruthy();
    expect(stops?.[0].getAttribute("stop-color")).toBe(analysis.visual.waveGradient![0]);
    expect(stops?.[1].getAttribute("stop-color")).toBe(analysis.visual.waveGradient![1]);
  });

  it("renders poetic footer quotes", () => {
    const analysis = makeAnalysis();
    render(<PosterCanvas analysis={analysis} songs={SONGS} />);

    expect(screen.getByText(/first i tried to understand/i)).toBeInTheDocument();
    expect(
      screen.getByText(/music changes\. we change\. but it always stays with us\./i),
    ).toBeInTheDocument();
  });

  it("applies the dynamic theme palette to the poster surface", () => {
    const analysis = makeAnalysis();
    render(<PosterCanvas analysis={analysis} songs={SONGS} />);

    const section = screen.getByLabelText("Dynamic Music Map poster");
    expect(analysis.visual.themeId).toBe("metal-gothic");
    expect(section.getAttribute("data-frame")).toBe("arch");
    expect(section.getAttribute("data-texture")).toBe("smoke");
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
