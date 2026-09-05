import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MusicUniverseHero } from "./MusicUniverseHero";
import type { MusicDNA } from "@/types/musicDna";

describe("MusicUniverseHero", () => {
  const mockDna: MusicDNA = {
    temporalPattern: {
      primaryEra: "1980s",
      spanYears: 32,
      eraDistribution: { "1980s": 5, "1990s": 2, "2000s": 1 },
      earliestReleaseYear: 1982,
      latestReleaseYear: 2014,
    },
    musicalIdentity: {
      topArtists: ["The Cure", "Depeche Mode", "New Order"],
      diversityScore: 88,
      dominantVibe: "Eclectic Explorer",
      hasVerifiedTracks: true,
    },
    songCount: 8,
    isGrounded: true,
    analyzedAt: "2026-09-05T00:00:00.000Z",
  };

  it("renders primary era and dominant vibe from DNA", () => {
    render(<MusicUniverseHero dna={mockDna} songCount={8} />);

    expect(screen.getByTestId("music-universe-hero")).toBeInTheDocument();
    expect(screen.getByText(/1980s Era/i)).toBeInTheDocument();
    expect(screen.getByText("Eclectic Explorer")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
  });

  it("renders top artists when provided", () => {
    render(<MusicUniverseHero dna={mockDna} songCount={8} />);
    expect(screen.getByText(/The Cure, Depeche Mode, New Order/i)).toBeInTheDocument();
  });

  it("handles null DNA gracefully", () => {
    render(<MusicUniverseHero dna={null} songCount={0} />);

    expect(screen.getByTestId("music-universe-hero")).toBeInTheDocument();
    expect(screen.getByText(/Timeless Era/i)).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
