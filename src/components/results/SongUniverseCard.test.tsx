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

  it("renders song title, artist, album and year with the universe index", () => {
    render(<SongUniverseCard song={mockSong} index={0} />);

    expect(screen.getByTestId("song-universe-card")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument(); // index 0 → badge "1"
    expect(screen.getByText("Pictures of You")).toBeInTheDocument();
    expect(screen.getByText("The Cure")).toBeInTheDocument();
    expect(screen.getByText("Disintegration")).toBeInTheDocument();
    expect(screen.getByText("1989")).toBeInTheDocument();
  });

  it("renders real album cover when artworkUrl is provided", () => {
    render(<SongUniverseCard song={mockSong} index={0} />);

    const img = screen.getByRole("img", { name: /pictures of you/i });
    expect(img).toHaveAttribute("src", "https://example.com/disintegration.jpg");
  });

  it("renders a disc placeholder instead of artwork when artworkUrl is null", () => {
    const songWithoutArt: Song = {
      ...mockSong,
      artworkUrl: null,
    };

    const { container } = render(<SongUniverseCard song={songWithoutArt} index={1} />);

    expect(screen.queryByTestId("organic-artwork")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".lucide-disc3")).not.toBeNull();
  });
});
