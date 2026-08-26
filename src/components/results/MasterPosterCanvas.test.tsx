import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { analyzeUserJourney } from "@/lib/ai/pipeline";
import { deterministicPoeticAnalysis } from "@/lib/llm/poetic-analyzer";
import type { Song } from "@/lib/song/types";
import { MasterPosterCanvas } from "./MasterPosterCanvas";

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

describe("MasterPosterCanvas", () => {
  it("renders the strict editorial poster with header, badges, portals and bottom section", () => {
    const analysis = makeAnalysis();
    const { container } = render(<MasterPosterCanvas analysis={analysis} songs={SONGS} />);

    // The strict 2:3 sheet.
    const sheet = container.querySelector("[data-testid='master-poster-sheet']");
    expect(sheet).not.toBeNull();
    expect(sheet?.getAttribute("style")).toContain("aspect-ratio: 2 / 3");

    // Header — title + age badges.
    const badges = screen.getByTestId("era-badges");
    for (const c of analysis.chapters) {
      expect(badges.textContent).toContain(c.ageRange);
    }

    // Middle — three-column grid with the master frame.
    expect(screen.getByTestId("panel-left")).toBeInTheDocument();
    expect(screen.getByTestId("panel-right")).toBeInTheDocument();
    expect(screen.getByTestId("master-frame")).toBeInTheDocument();

    // Portals — 4 gothic transition portals.
    const portals = screen.getByTestId("portal-strip");
    expect(portals.children.length).toBe(4);

    // Bottom — waveform, numbered tracklist, circular seal.
    expect(screen.getByTestId("wave-panel")).toBeInTheDocument();
    expect(screen.getByTestId("tracklist-panel")).toBeInTheDocument();
    expect(screen.getByTestId("circular-seal")).toBeInTheDocument();

    // Export action.
    expect(screen.getByTestId("poster-export-button")).toBeInTheDocument();
  });

  it("waveform SVG maps the emotional curve", () => {
    const analysis = makeAnalysis();
    render(<MasterPosterCanvas analysis={analysis} songs={SONGS} />);
    const svg = document.querySelector("svg[aria-label='emotional waveform']");
    expect(svg).not.toBeNull();
    const path = svg?.querySelector("path");
    expect(path?.getAttribute("d")).toMatch(/^M 0 /);
  });

  it("binds the master theme: metal cast, atmosphere and sky shift with genre & emotion", () => {
    const analysis = makeAnalysis();
    analysis.visual.themeId = "metal-gothic";
    analysis.visual.frame = "arch";
    analysis.visual.texture = "smoke";
    const { container } = render(<MasterPosterCanvas analysis={analysis} songs={SONGS} />);

    const sheet = container.querySelector("[data-testid='master-poster-sheet']");
    expect(sheet?.getAttribute("data-metal")).toBe("bronze");
    expect(sheet?.getAttribute("data-atmosphere")).toBe("gothic-thunder");
    expect(sheet?.getAttribute("data-scene")).toBe("stormy");

    const style = sheet?.getAttribute("style") ?? "";
    expect(style).toContain("rgb(11, 11, 16)"); // gothic primaryBg
    expect(style).toContain("rgba(169, 113, 66"); // bronze border
  });

  it("a synthpop journey recasts the template in neon magenta with a retro grid atmosphere", () => {
    const synthTitles = [
      "A-ha - Take On Me",
      "Depeche Mode - Just Can't Get Enough",
      "Eurythmics - Sweet Dreams",
      "Pet Shop Boys - West End Girls",
      "New Order - Blue Monday",
      "Duran Duran - Rio",
      "Tears for Fears - Shout",
      "Gary Numan - Cars",
    ];
    const answers: Record<number, string> = {};
    synthTitles.forEach((t, i) => {
      answers[i + 1] = t;
    });
    const profile = analyzeUserJourney(answers);
    if (!profile) throw new Error("fixture profile must exist");
    const analysis = deterministicPoeticAnalysis(profile, synthTitles);
    analysis.visual.themeId = "synthwave-80s";
    const songs: Song[] = synthTitles.map((title, i) => ({
      provider: "manual",
      providerId: `sp-${i}`,
      title,
      artist: title.split(" - ")[0] ?? "",
      album: null,
      artworkUrl: null,
      isrc: null,
    }));

    const { container } = render(<MasterPosterCanvas analysis={analysis} songs={songs} />);
    const sheet = container.querySelector("[data-testid='master-poster-sheet']");
    expect(sheet?.getAttribute("data-metal")).toBe("neon-magenta");
    expect(sheet?.getAttribute("data-atmosphere")).toBe("retro-grid-neon");
    expect(sheet?.getAttribute("style") ?? "").toContain("rgb(18, 8, 31)"); // retro bg

    // Layout stays identical — same grid panels.
    expect(screen.getByTestId("wave-panel")).toBeInTheDocument();
  });
});
