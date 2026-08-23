import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { QuestionCard } from "./QuestionCard";
import type { Song } from "@/lib/song/types";

const SONG_A: Song = {
  provider: "musicbrainz",
  providerId: "11111111-2222-3333-4444-555555555555",
  title: "Yesterday",
  artist: "The Beatles",
  album: "Help!",
  artworkUrl: null,
  isrc: null,
};

function renderCard(
  overrides: {
    selected?: Song | null;
    answer?: string;
    draft?: string;
    verified?: boolean;
    suggestions?: import("@/lib/song/types").Song[];
    onSelectSuggestion?: (song: import("@/lib/song/types").Song) => void;
    onDraftChange?: (text: string) => void;
    onChoose?: (song: Song) => void;
  } = {},
) {
  const onChoose = overrides.onChoose ?? vi.fn();
  const onDraftChange = overrides.onDraftChange ?? vi.fn();
  const onSelectSuggestion = overrides.onSelectSuggestion ?? vi.fn();
  render(
    <QuestionCard
      number={1}
      title="What song reminds you of your childhood?"
      description="Think of a track that takes you back."
      answer={overrides.answer}
      selected={overrides.selected}
      verified={overrides.verified}
      suggestions={overrides.suggestions}
      onSelectSuggestion={onSelectSuggestion}
      draft={overrides.draft ?? ""}
      onDraftChange={onDraftChange}
      onChoose={onChoose}
    />,
  );
  return { onChoose, onDraftChange, onSelectSuggestion };
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
    expect(screen.getByRole("button", { name: /ritüele ekle/i })).toBeDisabled();
  });

  it("enables the Onayla button once draft text is present", () => {
    const { onDraftChange } = renderCard({ draft: "Sting - Fragile" });
    // draft is controlled by the parent; the card reflects it.
    expect(onDraftChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /ritüele ekle/i })).not.toBeDisabled();
  });

  it("shows the selected song as 'title — artist'", () => {
    renderCard({ selected: SONG_A });
    expect(screen.getByText("Yesterday — The Beatles")).toBeInTheDocument();
  });

  it("falls back to the answer title string when no structured Song exists", () => {
    renderCard({ answer: "Yesterday" });
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
  });

  it("renders no search/lookup UI — only the free-text input and Onayla", () => {
    renderCard();
    // The only song-entry affordances are the text box and Onayla.
    expect(screen.getByLabelText("Şarkı ve sanatçı adını yaz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ritüele ekle/i })).toBeInTheDocument();
    // No MusicBrainz search link or modal is present.
    expect(
      screen.queryByRole("button", { name: /kapak görseli için ara/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Search for a song")).not.toBeInTheDocument();
  });

  it("commits the typed text as a manual Song via the Onayla button", () => {
    const { onChoose } = renderCard({ draft: "Sting - Fragile" });
    fireEvent.click(screen.getByRole("button", { name: /ritüele ekle/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /ritüele ekle/i }));
    expect(vi.mocked(onChoose).mock.calls[0][0].title).toBe("Yesterday");
  });

  it("forwards draft edits to onDraftChange", () => {
    const { onDraftChange } = renderCard();
    const input = screen.getByLabelText("Şarkı ve sanatçı adını yaz");
    fireEvent.change(input, { target: { value: "Imagine" } });
    expect(onDraftChange).toHaveBeenCalledWith("Imagine");
  });
});

describe("QuestionCard — manual song entry (only path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders no search/lookup UI anywhere — no link, no modal, no search input", () => {
    renderCard();
    expect(
      screen.queryByRole("button", { name: /kapak görseli için ara/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Search for a song")).not.toBeInTheDocument();
    expect(screen.queryByText(/bulamadım, kendim yazacağım/i)).not.toBeInTheDocument();
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

describe("QuestionCard — ghost text & soft verification badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders no hard verification text anywhere", () => {
    renderCard({ draft: "Sting - Fragile" });
    expect(screen.queryByText(/doğrulanıyor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/doğrulandı/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/doğrulanamadı/i)).not.toBeInTheDocument();
  });

  it("shows the green check only for a verified entry", () => {
    renderCard({ draft: "Sting - Fragile", verified: true });
    expect(screen.getByLabelText("tanındı")).toBeInTheDocument();
  });

  it("shows no green check for an unverified manual entry", () => {
    renderCard({ draft: "Stnig Fragile" });
    expect(screen.queryByLabelText("tanındı")).not.toBeInTheDocument();
  });

  it("renders the suggestion dropdown with artwork, title, artist, and year", () => {
    renderCard({
      draft: "Fragile",
      suggestions: [
        {
          provider: "spotify",
          providerId: "sp-1",
          title: "Fragile",
          artist: "Sting",
          album: "...Nothing Like the Sun",
          artworkUrl: "https://i.scdn.co/image/fragile",
          releaseYear: 1987,
          isrc: null,
        },
      ],
    });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("Fragile")).toBeInTheDocument();
    expect(screen.getByText("Sting · 1987")).toBeInTheDocument();
    expect(screen.getByRole("listbox").querySelector("img")).toHaveAttribute("src", "https://i.scdn.co/image/fragile");
  });

  it("hides the dropdown when there are no suggestions", () => {
    renderCard({ draft: "zzzz", suggestions: [] });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("selecting a suggestion commits that structured Song", () => {
    const song = {
      provider: "itunes" as const,
      providerId: "it-1",
      title: "Dönence",
      artist: "Barış Manço",
      album: "Dönence",
      artworkUrl: null,
      releaseYear: 1982,
      isrc: null,
    };
    const { onSelectSuggestion } = renderCard({ draft: "dön", suggestions: [song] });
    fireEvent.click(screen.getByText("Dönence"));
    expect(onSelectSuggestion).toHaveBeenCalledWith(song);
  });

  it("manual entry still commits with no check and no ghost text", () => {
    const { onChoose } = renderCard({ draft: "Stnig Fragile" });
    expect(screen.queryByLabelText("tanındı")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ritüele ekle/i }));
    expect(onChoose).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(onChoose).mock.calls[0][0];
    expect(arg.provider).toBe("manual");
    expect(arg.title).toBe("Stnig Fragile");
    expect(arg.verified).toBeUndefined();
  });
});
