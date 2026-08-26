import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { analyzeUserJourney } from "@/lib/ai/pipeline";
import { feedEntryIntensity, type LifeFeedEntry } from "@/lib/life-feed";
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
  it("renders manifesto, chapters, insights, duality and export action", () => {
    const analysis = makeAnalysis();
    render(<MasterPosterCanvas analysis={analysis} songs={SONGS} />);

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
    render(<MasterPosterCanvas analysis={analysis} songs={SONGS} />);

    expect(screen.getByText(/life phase roadmap/i)).toBeInTheDocument();
    expect(screen.getAllByText("DISCOVERY & WONDER").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("MENTAL AWAKENING").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("STRENGTH & TRIUMPH").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("THRESHOLD PORTALS").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("PURE ENERGY & JOY").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("IDENTITY & SYNTHESIS").length).toBeGreaterThanOrEqual(1);
    // These age ranges also appear as badges on the MTG life cards below.
    expect(screen.getAllByText("Ages 9-12").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ages 12-18").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ages 18-24").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ages 24-30").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ages 30-35").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Ages 35+")).toBeInTheDocument();
  });

  it("renders the 8 MTG-style life cards in a 4×2 grid section", () => {
    const analysis = makeAnalysis();
    render(<MasterPosterCanvas analysis={analysis} songs={SONGS} />);

    expect(screen.getByText("LIFE CARDS")).toBeInTheDocument();
    const cards = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => screen.getByTestId(`quiz-card-${i + 1}`));
    expect(cards).toHaveLength(8);
    // Each card carries its era frame: dynamic per-track title, type line,
    // score shield, narrative — no static placeholder copy.
    expect(screen.getAllByText(/DISCOVERY & [A-Z]+/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/ACCEPTANCE & [A-Z]+/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Legendary Life Era")).toHaveLength(8);
  });

  it("Grand Finale — cosmic backdrop harmonizes all era themes + cards unframe into grid", () => {
    const analysis = makeAnalysis();
    render(<MasterPosterCanvas analysis={analysis} songs={SONGS} />);

    // Cosmic gallery wall — one blended layer per distinct scene family.
    const backdrop = screen.getByTestId("cosmic-backdrop");
    const layers = [...backdrop.querySelectorAll(":scope > div")];
    expect(layers.length).toBeGreaterThanOrEqual(2);
    // Metal journey lives mostly in the gothic room.
    expect(layers.map((l) => (l as HTMLElement).style.backgroundImage).join(" ")).toContain(
      "room-backdrop-gothic",
    );
    // Layers blend additively into a single cosmic wall.
    expect((layers[0] as HTMLElement).style.mixBlendMode).toBe("screen");

    // Unframing — every life card wrapped in a motion container, still in
    // the exact 4×2 grid matrix with its wooden-frame flash overlay.
    for (let i = 1; i <= 8; i++) {
      const card = screen.getByTestId(`quiz-card-${i}`);
      const wrapper = card.parentElement;
      expect(wrapper).not.toBeNull();
      // The card itself keeps its MTG frame chrome; the wrapper carries the
      // dissolving wooden-border flash (aria-hidden).
      expect(wrapper!.querySelector("[aria-hidden]")).not.toBeNull();
    }
  });

  it("makes every album art clickable — a Spotify search deep link", () => {
    const analysis = makeAnalysis();
    render(<MasterPosterCanvas analysis={analysis} songs={SONGS} />);

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
    render(<MasterPosterCanvas analysis={analysis} songs={SONGS} />);

    const svg = document.querySelector("svg[aria-label='Emotional intensity waveform']");
    expect(svg).toBeInTheDocument();
    expect(svg?.querySelector("path")).toBeInTheDocument();

    // The emotional graph is cast in the journey's metal (posterTheme).
    const stops = svg?.querySelectorAll("linearGradient stop");
    expect(stops?.length).toBeGreaterThanOrEqual(2);
    expect(stops?.[0].getAttribute("stop-color")).toBe("#a97142"); // bronze
    expect(stops?.[1].getAttribute("stop-color")).toBe("#d09a68"); // bronze highlight
  });

  it("binds the master theme: metal cast, atmosphere and sky shift with genre & emotion", () => {
    const analysis = makeAnalysis();
    render(<MasterPosterCanvas analysis={analysis} songs={SONGS} />);

    // The fixture is an all-metal journey → bronze frame, gothic thunder,
    // stormy sky (high-intensity arc).
    const section = screen.getByLabelText("Dynamic Music Map poster");
    expect(section.getAttribute("data-metal")).toBe("bronze");
    expect(section.getAttribute("data-atmosphere")).toBe("gothic-thunder");
    expect(section.getAttribute("data-scene")).toBe("stormy");
    const style = section.getAttribute("style") ?? "";
    expect(style).toContain("rgb(11, 11, 16)"); // gothic primaryBg
    expect(style).toContain("rgba(169, 113, 66"); // bronze border

    const sky = screen.getByTestId("poster-background-scene");
    expect(sky.getAttribute("data-scene")).toBe("stormy");
  });

  it("a synthpop journey recasts the template in neon magenta with a retro grid atmosphere", () => {
    const synthTitles = [
      "A-ha - Take On Me synthpop",
      "Depeche Mode - Enjoy the Silence synth",
      "Pet Shop Boys - West End Girls synthpop",
      "Eurythmics - Sweet Dreams synthpop",
      "Duran Duran - Rio new wave",
      "Gary Numan - Cars synth",
      "Soft Cell - Tainted Love synthpop",
      "OMD - Enola Gay synthpop",
    ];
    const answers: Record<number, string> = {};
    synthTitles.forEach((s, i) => {
      answers[i + 1] = s;
    });
    const profile = analyzeUserJourney(answers);
    if (!profile) throw new Error("fixture profile must exist");
    const synthAnalysis = deterministicPoeticAnalysis(profile, synthTitles);
    const synthSongs: Song[] = synthTitles.map((title, i) => ({
      provider: "manual" as const,
      providerId: `synth-${i}`,
      title,
      artist: title.split(" - ")[0] ?? "",
      album: null,
      artworkUrl: null,
      isrc: null,
    }));
    render(<MasterPosterCanvas analysis={synthAnalysis} songs={synthSongs} />);

    const section = screen.getByLabelText("Dynamic Music Map poster");
    expect(section.getAttribute("data-metal")).toBe("neon-magenta");
    expect(section.getAttribute("data-atmosphere")).toBe("retro-grid-neon");
    expect(section.getAttribute("style") ?? "").toContain("rgb(18, 8, 31)"); // retro bg
    // The grid layout is untouched — the emotional graph still renders.
    expect(
      document.querySelector("svg[aria-label='Emotional intensity waveform']"),
    ).toBeInTheDocument();
  });

  it("renders poetic footer quotes", () => {
    const analysis = makeAnalysis();
    render(<MasterPosterCanvas analysis={analysis} songs={SONGS} />);

    expect(screen.getByText(/first i tried to understand/i)).toBeInTheDocument();
    expect(
      screen.getByText(/music changes\. we change\. but it always stays with us\./i),
    ).toBeInTheDocument();
  });

  it("applies the dynamic theme palette to the poster surface", () => {
    const analysis = makeAnalysis();
    render(<MasterPosterCanvas analysis={analysis} songs={SONGS} />);

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

    render(<MasterPosterCanvas analysis={analysis} songs={SONGS} feedEntries={feedEntries} />);

    // Playlist section lists the new entries.
    expect(screen.getByText(/the map keeps growing/i)).toBeInTheDocument();
    expect(screen.getByText("Nightcall")).toBeInTheDocument();
    expect(screen.getByText("Sunset Runner")).toBeInTheDocument();

    // The emotional curve grew from 8 to 10 points: "+1"/"+2" markers exist
    expect(screen.getAllByText("+1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("+2").length).toBeGreaterThanOrEqual(1);
  });

  it("without feed entries there is no playlist section", () => {
    render(<MasterPosterCanvas analysis={makeAnalysis()} songs={SONGS} />);
    expect(screen.queryByText(/the map keeps growing/i)).not.toBeInTheDocument();
  });
});
