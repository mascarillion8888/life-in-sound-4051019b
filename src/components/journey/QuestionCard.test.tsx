import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { QuestionCard } from "./QuestionCard";
import type { Song } from "@/lib/song/types";

// The QuestionCard imports searchSongs from the server module. We mock the
// module so no network call is made and tests are deterministic.
vi.mock("@/lib/song/searchSong.server", () => ({
  searchSongs: vi.fn(),
}));

// Import AFTER the mock so the mocked binding is used.
import { searchSongs } from "@/lib/song/searchSong.server";

const SONG_A: Song = {
  provider: "musicbrainz",
  providerId: "11111111-2222-3333-4444-555555555555",
  title: "Yesterday",
  artist: "The Beatles",
  album: "Help!",
  artworkUrl: null,
  isrc: null,
};

const SONG_B: Song = {
  provider: "musicbrainz",
  providerId: "22222222-3333-4444-5555-666666666666",
  title: "Imagine",
  artist: "John Lennon",
  album: null,
  artworkUrl: null,
  isrc: null,
};

function renderCard(
  overrides: {
    selected?: Song | null;
    answer?: string;
    onChoose?: (song: Song) => void;
  } = {},
) {
  const onChoose = overrides.onChoose ?? vi.fn();
  render(
    <QuestionCard
      number={1}
      title="What song reminds you of your childhood?"
      description="Think of a track that takes you back."
      answer={overrides.answer}
      selected={overrides.selected}
      onChoose={onChoose}
    />,
  );
  return { onChoose };
}

describe("QuestionCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the question number, title, and description", () => {
    renderCard();
    expect(screen.getByText("Question 1")).toBeInTheDocument();
    expect(screen.getByText("What song reminds you of your childhood?")).toBeInTheDocument();
    expect(screen.getByText(/takes you back/i)).toBeInTheDocument();
  });

  it('shows "Choose Song" when nothing is selected', () => {
    renderCard();
    expect(screen.getByRole("button", { name: /choose song/i })).toBeInTheDocument();
  });

  it('shows "Change Song" when a structured Song is selected', () => {
    renderCard({ selected: SONG_A });
    expect(screen.getByRole("button", { name: /change song/i })).toBeInTheDocument();
  });

  it("shows the selected song as 'title — artist'", () => {
    renderCard({ selected: SONG_A });
    expect(screen.getByText("Yesterday — The Beatles")).toBeInTheDocument();
  });

  it("falls back to the answer title string when no structured Song exists", () => {
    renderCard({ answer: "Yesterday" });
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
  });

  it("opens the picker, runs a search, and lists results", async () => {
    vi.mocked(searchSongs).mockResolvedValue({ results: [SONG_A, SONG_B] });
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /choose song/i }));

    const input = await screen.findByLabelText("Search for a song");
    fireEvent.change(input, { target: { value: "yesterday" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText("Yesterday")).toBeInTheDocument();
      expect(screen.getByText("Imagine")).toBeInTheDocument();
    });

    expect(searchSongs).toHaveBeenCalledWith({ data: { query: "yesterday" } });
  });

  it("does not search for queries shorter than 2 characters", async () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /choose song/i }));

    const input = await screen.findByLabelText("Search for a song");
    fireEvent.change(input, { target: { value: "y" } });

    expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
    expect(searchSongs).not.toHaveBeenCalled();
  });

  it("shows the empty state when no results come back", async () => {
    vi.mocked(searchSongs).mockResolvedValue({ results: [] });
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /choose song/i }));
    const input = await screen.findByLabelText("Search for a song");
    fireEvent.change(input, { target: { value: "zzznothing" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText(/no results/i)).toBeInTheDocument();
    });
  });

  it("shows the error state when the search call throws", async () => {
    vi.mocked(searchSongs).mockRejectedValue(new Error("network down"));
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /choose song/i }));
    const input = await screen.findByLabelText("Search for a song");
    fireEvent.change(input, { target: { value: "beatles" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByText(/unavailable right now/i)).toBeInTheDocument();
    });
  });

  it("calls onChoose with the selected song and closes the picker", async () => {
    vi.mocked(searchSongs).mockResolvedValue({ results: [SONG_A] });
    const { onChoose } = renderCard();

    fireEvent.click(screen.getByRole("button", { name: /choose song/i }));
    const input = await screen.findByLabelText("Search for a song");
    fireEvent.change(input, { target: { value: "yesterday" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("Yesterday")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Yesterday"));

    expect(onChoose).toHaveBeenCalledWith(SONG_A);
    // Picker closes → the picker's Search input is gone.
    await waitFor(() => {
      expect(screen.queryByLabelText("Search for a song")).not.toBeInTheDocument();
    });
  });
});
