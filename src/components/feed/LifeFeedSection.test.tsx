import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { questions } from "@/lib/questions";
import type { JourneyProgress } from "@/lib/journey-storage";
import { loadLifeFeed } from "@/lib/life-feed";
import { deterministicEntryInsight } from "@/lib/llm/poetic-analyzer";
import type { Song } from "@/lib/song/types";
import { LifeFeedSection, type EntryInsightFetcher } from "./LifeFeedSection";

function makeSong(title: string, artist = ""): Song {
  return {
    provider: "manual",
    providerId: `id-${title}`,
    title,
    artist,
    album: null,
    artworkUrl: null,
    isrc: null,
  };
}

function completeProgress(): JourneyProgress {
  const answers: Record<number, string> = {};
  const songs: Record<number, Song> = {};
  for (const q of questions) {
    answers[q.id] = `Song ${q.id}`;
    songs[q.id] = makeSong(`Song ${q.id}`, `Artist ${q.id}`);
  }
  return { current: questions.length + 1, answers, songs };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("LifeFeedSection", () => {
  it("locks the feed while the journey is incomplete", () => {
    const partial = completeProgress();
    delete partial.answers[8];
    render(<LifeFeedSection journey={partial} />);
    expect(screen.getByText(/complete your 8-song journey/i)).toBeInTheDocument();
  });

  it("graduates a completed journey into an empty persisted feed", async () => {
    const onFeedChange = vi.fn();
    render(<LifeFeedSection journey={completeProgress()} onFeedChange={onFeedChange} />);

    // Input unlocked, empty timeline hint, graduation persisted.
    expect(screen.getByRole("button", { name: /haritaya ekle/i })).toBeInTheDocument();
    expect(screen.getByText(/the map is listening/i)).toBeInTheDocument();
    const stored = loadLifeFeed();
    expect(stored).not.toBeNull();
    expect(Object.keys(stored?.baseAnswers ?? {})).toHaveLength(questions.length);
    await waitFor(() => expect(onFeedChange).toHaveBeenCalled());
  });

  it("state sync: add → deterministic insight instantly, gemini upgrade after, all persisted", async () => {
    // Deferred fetcher so the instant deterministic line is observable first.
    let resolveFetch: (value: string | null) => void = () => {};
    const insightFetcher: EntryInsightFetcher = vi
      .fn()
      .mockImplementation(() => new Promise<string | null>((resolve) => (resolveFetch = resolve)));
    const onFeedChange = vi.fn();
    const user = userEvent.setup();
    render(
      <LifeFeedSection
        journey={completeProgress()}
        onFeedChange={onFeedChange}
        insightFetcher={insightFetcher}
      />,
    );

    await user.type(screen.getByLabelText("Bellek notu (optional)"), "gece sürüşü");
    await user.type(screen.getByLabelText("Şarkı ara"), "Nightcall");
    await user.click(screen.getByRole("button", { name: /haritaya ekle/i }));

    // Instant deterministic insight — the friend answers immediately.
    const expectedFallback = deterministicEntryInsight({
      songTitle: "Nightcall",
      note: "gece sürüşü",
    });
    expect(screen.getByText(expectedFallback)).toBeInTheDocument();

    // The Gemini upgrade replaces it in place, and everything persists.
    resolveFetch("A gemini whisper.");
    await waitFor(() => expect(screen.getByText("A gemini whisper.")).toBeInTheDocument());
    expect(screen.queryByText(expectedFallback)).not.toBeInTheDocument();

    const stored = loadLifeFeed();
    expect(stored?.entries).toHaveLength(1);
    expect(stored?.entries[0].song.title).toBe("Nightcall");
    expect(stored?.entries[0].note).toBe("gece sürüşü");
    expect(stored?.entries[0].insight).toBe("A gemini whisper.");

    // The poster's data source (onFeedChange) saw the expanded map.
    const last = onFeedChange.mock.calls.at(-1)?.[0];
    expect(last?.entries).toHaveLength(1);
  });

  it("keeps the deterministic line when the fetcher returns null", async () => {
    const insightFetcher: EntryInsightFetcher = vi.fn().mockResolvedValue(null);
    const user = userEvent.setup();
    render(<LifeFeedSection journey={completeProgress()} insightFetcher={insightFetcher} />);

    await user.type(screen.getByLabelText("Şarkı ara"), "Silent Song");
    await user.click(screen.getByRole("button", { name: /haritaya ekle/i }));

    const expected = deterministicEntryInsight({ songTitle: "Silent Song", note: null });
    await waitFor(() => expect(loadLifeFeed()?.entries).toHaveLength(1));
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("delete updates the timeline and the persisted feed", async () => {
    const insightFetcher: EntryInsightFetcher = vi.fn().mockResolvedValue(null);
    const user = userEvent.setup();
    render(<LifeFeedSection journey={completeProgress()} insightFetcher={insightFetcher} />);

    await user.type(screen.getByLabelText("Şarkı ara"), "Temporary");
    await user.click(screen.getByRole("button", { name: /haritaya ekle/i }));
    await waitFor(() => expect(loadLifeFeed()?.entries).toHaveLength(1));

    await user.click(screen.getByLabelText("Delete Temporary"));
    expect(screen.queryByLabelText("Life Feed entry: Temporary")).not.toBeInTheDocument();
    expect(loadLifeFeed()?.entries).toHaveLength(0);
  });
});
