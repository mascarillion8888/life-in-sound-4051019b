import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MusicUniverseHero } from "./MusicUniverseHero";
import type { MusicDNA } from "@/types/musicDna";
import type { PersonalityProfile } from "@/lib/ai/types";
import type { Song } from "@/lib/song/types";

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
      topGenres: [],
      genreCoverage: 0,
      topMoods: [],
      moodCoverage: 0,
    },
    songCount: 8,
    isGrounded: true,
    analyzedAt: "2026-09-05T00:00:00.000Z",
  };

  const mockSongs: Song[] = Array.from({ length: 8 }, (_, i) => ({
    provider: "manual" as const,
    providerId: `manual-${i}`,
    title: `Song ${i + 1}`,
    artist: "Artist",
    album: null,
    artworkUrl: null,
    isrc: null,
  }));

  it("renders primary era and dominant vibe from grounded DNA", () => {
    render(<MusicUniverseHero profile={null} grounded={{ dna: mockDna }} songs={mockSongs} />);

    expect(screen.getByTestId("music-universe-hero")).toBeInTheDocument();
    expect(screen.getByText("1980s")).toBeInTheDocument();
    expect(screen.getByText("Eclectic Explorer")).toBeInTheDocument();
    expect(screen.getByText(/8 songs discovered/i)).toBeInTheDocument();
    expect(screen.getByText(/88% artist diversity/i)).toBeInTheDocument();
  });

  it("renders the profile archetype when provided", () => {
    // The component only reads `profile.archetype` — a partial mock is enough.
    const mockProfile = { archetype: "The Curator" } as unknown as PersonalityProfile;
    render(<MusicUniverseHero profile={mockProfile} grounded={null} songs={[]} />);

    expect(screen.getByText("The Curator")).toBeInTheDocument();
  });

  it("handles null grounded DNA gracefully", () => {
    render(<MusicUniverseHero profile={null} grounded={null} songs={[]} />);

    expect(screen.getByTestId("music-universe-hero")).toBeInTheDocument();
    expect(screen.getByText("Your Music Universe")).toBeInTheDocument();
  });
});
