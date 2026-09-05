import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SongUniverseCard } from "./SongUniverseCard";
import type { Song } from "@/lib/song/types";

describe("SongUniverseCard", () => {
  const mockSong: Song = {
    provider: "itunes",
    providerId: "12345",
    title: "Pictures of You",
    artist: "The Cure",
    album: "Disintegration",
    artworkUrl: "https://example.com/disintegration.jpg",
    releaseYear: 1989,
    isrc: null,
    verified: true,
  };

  it("renders song title, artist, year and stage name", () => {
    render(
      <SongUniverseCard
        song={mockSong}
        stageName="Childhood"
        vibeLabel="Nostalgic Spark"
        stepNumber={1}
        temporalArcPosition={0}
      />,
    );

    expect(screen.getByTestId("song-universe-card-1")).toBeInTheDocument();
    expect(screen.getByText("Stage 01")).toBeInTheDocument();
    expect(screen.getByText("Childhood")).toBeInTheDocument();
    expect(screen.getByText("Pictures of You")).toBeInTheDocument();
    expect(screen.getByText("The Cure")).toBeInTheDocument();
    expect(screen.getByText("1989")).toBeInTheDocument();
    expect(screen.getByText("Nostalgic Spark")).toBeInTheDocument();
    expect(screen.getByText("0% Arc")).toBeInTheDocument();
  });

  it("renders real album cover when artworkUrl is provided", () => {
    render(
      <SongUniverseCard
        song={mockSong}
        stageName="Childhood"
        vibeLabel="Nostalgic Spark"
        stepNumber={1}
      />,
    );

    const img = screen.getByRole("img", { name: /pictures of you cover/i });
    expect(img).toHaveAttribute("src", "https://example.com/disintegration.jpg");
  });

  it("renders fallback artwork placeholder when artworkUrl is null", () => {
    const songWithoutArt: Song = {
      ...mockSong,
      artworkUrl: null,
    };

    render(
      <SongUniverseCard
        song={songWithoutArt}
        stageName="First Signature"
        vibeLabel="Formative Discovery"
        stepNumber={2}
      />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("Original Artwork")).toBeInTheDocument();
  });
});
