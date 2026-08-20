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
    draft?: string;
    onDraftChange?: (text: string) => void;
    onChoose?: (song: Song) => void;
  } = {},
) {
  const onChoose = overrides.onChoose ?? vi.fn();
  const onDraftChange = overrides.onDraftChange ?? vi.fn();
  render(
    <QuestionCard
      number={1}
      title="What song reminds you of your childhood?"
      description="Think of a track that takes you back."
      answer={overrides.answer}
      selected={overrides.selected}
      draft={overrides.draft ?? ""}
      onDraftChange={onDraftChange}
      onChoose={onChoose}
    />,
  );
  return { onChoose, onDraftChange };
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

  it("renders the primary free-text input with the song-entry placeholder", () => {
    renderCard();
    expect(screen.getByLabelText("Şarkı ve sanatçı adını yaz")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("örn. Bad - Michael Jackson")).toBeInTheDocument();
  });

  it("disables the Onayla button until the user types text", () => {
    renderCard();
    expect(screen.getByRole("button", { name: /onayla/i })).toBeDisabled();
  });

  it("enables the Onayla button once draft text is present", () => {
    const { onDraftChange } = renderCard({ draft: "Sting - Fragile" });
    // draft is controlled by the parent; the card reflects it.
    expect(onDraftChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /onayla/i })).not.toBeDisabled();
  });

  it("shows the selected song as 'title — artist'", () => {
    renderCard({ selected: SONG_A });
    expect(screen.getByText("Yesterday — The Beatles")).toBeInTheDocument();
  });

  it("falls back to the answer title string when no structured Song exists", () => {
    renderCard({ answer: "Yesterday" });
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
  });

  it("exposes the optional MusicBrainz search link (secondary path)", () => {
    renderCard();
    expect(
      screen.getByRole("button", { name: /kapak görseli için ara \(opsiyonel\)/i }),
    ).toBeInTheDocument();
  });

  it("commits the typed text as a manual Song via the Onayla button", () => {
    const { onChoose } = renderCard({ draft: "Sting - Fragile" });
    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));
    expect(onChoose).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(onChoose).mock.calls[0][0];
    expect(arg.provider).toBe("manual");
    expect(arg.title).toBe("Sting - Fragile");
    expect(arg.artist).toBe("");
    expect(arg.album).toBeNull();
    expect(arg.artworkUrl).toBeNull();
    expect(arg.isrc).toBeNull();
    expect(typeof arg.providerId).toBe("string");
    expect(arg.providerId.length).toBeGreaterThan(0);
  });

  it("commits a manual Song when the user presses Enter in the text box", () => {
    const { onChoose, onDraftChange } = renderCard({ draft: "Fragile" });
    const input = screen.getByLabelText("Şarkı ve sanatçı adını yaz");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(vi.mocked(onChoose).mock.calls[0][0].title).toBe("Fragile");
    // onDraftChange must NOT be triggered by Enter (commit goes through onChoose).
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  it("does not commit on Enter when the draft is empty", () => {
    const { onChoose } = renderCard({ draft: "   " });
    const input = screen.getByLabelText("Şarkı ve sanatçı adını yaz");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("trims the draft before building the manual Song title", () => {
    const { onChoose } = renderCard({ draft: "  Yesterday  " });
    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));
    expect(vi.mocked(onChoose).mock.calls[0][0].title).toBe("Yesterday");
  });

  it("forwards draft edits to onDraftChange", () => {
    const { onDraftChange } = renderCard();
    const input = screen.getByLabelText("Şarkı ve sanatçı adını yaz");
    fireEvent.change(input, { target: { value: "Imagine" } });
    expect(onDraftChange).toHaveBeenCalledWith("Imagine");
  });
});

describe("QuestionCard — manual song entry (primary path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not require the MusicBrainz modal to enter a manual song", () => {
    renderCard();
    // The primary free-text input and Onayla are present directly on the card.
    expect(screen.getByLabelText("Şarkı ve sanatçı adını yaz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /onayla/i })).toBeInTheDocument();
    // The old in-modal manual-entry button is gone.
    expect(screen.queryByText(/bulamadım, kendim yazacağım/i)).not.toBeInTheDocument();
    // And the modal is not open by default.
    expect(screen.queryByLabelText("Search for a song")).not.toBeInTheDocument();
  });

  it("commits a manual Song from the primary input without a MusicBrainz search", () => {
    vi.mocked(searchSongs).mockResolvedValue({ results: [] });
    const { onChoose } = renderCard({ draft: "Bad - Michael Jackson" });

    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));

    expect(searchSongs).not.toHaveBeenCalled();
    expect(onChoose).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(onChoose).mock.calls[0][0];
    expect(arg.provider).toBe("manual");
    expect(arg.title).toBe("Bad - Michael Jackson");
    expect(arg.artist).toBe("");
    expect(arg.album).toBeNull();
    expect(arg.artworkUrl).toBeNull();
    expect(arg.isrc).toBeNull();
    expect(typeof arg.providerId).toBe("string");
    expect(arg.providerId.length).toBeGreaterThan(0);
  });

  it("trims the typed text before building the manual Song title", () => {
    const { onChoose } = renderCard({ draft: "  Yesterday  " });
    fireEvent.click(screen.getByRole("button", { name: /onayla/i }));
    expect(vi.mocked(onChoose).mock.calls[0][0].title).toBe("Yesterday");
  });

  it("opens the optional MusicBrainz search via the secondary link", async () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: /kapak görseli için ara \(opsiyonel\)/i }));

    // The modal search input is now present (modal opened).
    expect(await screen.findByLabelText("Search for a song")).toBeInTheDocument();
  });

  it("selecting a result from the optional search fills the primary input and commits the structured song", async () => {
    vi.mocked(searchSongs).mockResolvedValue({ results: [SONG_A] });
    const { onChoose, onDraftChange } = renderCard({ draft: "" });

    fireEvent.click(screen.getByRole("button", { name: /kapak görseli için ara \(opsiyonel\)/i }));
    const searchInput = await screen.findByLabelText("Search for a song");
    fireEvent.change(searchInput, { target: { value: "yesterday" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => expect(screen.getByText("Yesterday")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Yesterday"));

    expect(onChoose).toHaveBeenCalledWith(SONG_A);
    // The primary text box is prefilled with "title — artist" from the selection.
    expect(onDraftChange).toHaveBeenCalledWith("Yesterday — The Beatles");
    // Modal closes after selection.
    await waitFor(() => {
      expect(screen.queryByLabelText("Search for a song")).not.toBeInTheDocument();
    });
  });

  it("renders a manual selection without a trailing dash in the card", () => {
    const manualSong: Song = {
      provider: "manual",
      providerId: "manual-uuid",
      title: "Bad - Michael Jackson",
      artist: "",
      album: null,
      artworkUrl: null,
      isrc: null,
    };
    renderCard({ selected: manualSong });
    // No trailing " — " when artist is empty.
    expect(screen.getByText("Bad - Michael Jackson")).toBeInTheDocument();
    expect(screen.queryByText(/^Bad - Michael Jackson — $/)).not.toBeInTheDocument();
  });
});
