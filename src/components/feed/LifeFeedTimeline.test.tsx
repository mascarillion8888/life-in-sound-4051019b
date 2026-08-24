import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { LifeFeedEntry } from "@/lib/life-feed";
import type { Song } from "@/lib/song/types";
import { LifeFeedTimeline } from "./LifeFeedTimeline";

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

function makeEntry(title: string, addedAt: string, overrides: Partial<LifeFeedEntry> = {}) {
  return {
    id: `e-${title}`,
    song: makeSong(title, overrides.song?.artist ?? ""),
    note: overrides.note ?? null,
    insight: overrides.insight ?? null,
    addedAt,
    ...overrides,
  } as LifeFeedEntry;
}

describe("LifeFeedTimeline", () => {
  it("shows an empty-state hint with no entries", () => {
    render(<LifeFeedTimeline entries={[]} onDelete={() => {}} onEditNote={() => {}} />);
    expect(screen.getByText(/the map is listening/i)).toBeInTheDocument();
  });

  it("groups entries into weekly chapters with moment cards", () => {
    const entries = [
      makeEntry("Alpha", "2026-08-03T09:00:00.000Z"),
      makeEntry("Beta", "2026-08-20T09:00:00.000Z"),
    ];
    render(<LifeFeedTimeline entries={entries} onDelete={() => {}} onEditNote={() => {}} />);

    // Weekly chapter labels (two distinct weeks in August 2026).
    const labels = screen.getAllByText(/^Week \d+, 2026/);
    expect(labels.length).toBe(2);

    // Moment cards carry title, date, note and insight.
    const card = screen.getByLabelText("Life Feed entry: Alpha");
    expect(within(card).getByText("Alpha")).toBeInTheDocument();
    expect(within(card).getByText(/3 Aug 2026/)).toBeInTheDocument();
  });

  it("renders notes and poetic insights on the card", () => {
    const entries = [
      makeEntry("Alpha", "2026-08-03T09:00:00.000Z", {
        note: "a quiet room",
        insight: "The friend wrote this line.",
      }),
    ];
    render(<LifeFeedTimeline entries={entries} onDelete={() => {}} onEditNote={() => {}} />);
    expect(screen.getByText("“a quiet room”")).toBeInTheDocument();
    expect(screen.getByText("The friend wrote this line.")).toBeInTheDocument();
  });

  it("delete flows the entry id back", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <LifeFeedTimeline
        entries={[makeEntry("Doomed", "2026-08-03T09:00:00.000Z")]}
        onDelete={onDelete}
        onEditNote={() => {}}
      />,
    );
    await user.click(screen.getByLabelText("Delete Doomed"));
    expect(onDelete).toHaveBeenCalledWith("e-Doomed");
  });

  it("edit note saves through onEditNote and closes", async () => {
    const onEditNote = vi.fn();
    const user = userEvent.setup();
    render(
      <LifeFeedTimeline
        entries={[makeEntry("Editable", "2026-08-03T09:00:00.000Z", { note: "old" })]}
        onDelete={() => {}}
        onEditNote={onEditNote}
      />,
    );

    await user.click(screen.getByLabelText("Edit note for Editable"));
    const editor = screen.getByLabelText("Edit note");
    await user.clear(editor);
    await user.type(editor, "new words");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onEditNote).toHaveBeenCalledWith("e-Editable", "new words");
    expect(screen.queryByLabelText("Edit note")).not.toBeInTheDocument();
  });

  it("edit note with empty text passes null (clears the note)", async () => {
    const onEditNote = vi.fn();
    const user = userEvent.setup();
    render(
      <LifeFeedTimeline
        entries={[makeEntry("Clearable", "2026-08-03T09:00:00.000Z", { note: "old" })]}
        onDelete={() => {}}
        onEditNote={onEditNote}
      />,
    );

    await user.click(screen.getByLabelText("Edit note for Clearable"));
    const editor = screen.getByLabelText("Edit note");
    await user.clear(editor);
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(onEditNote).toHaveBeenCalledWith("e-Clearable", null);
  });
});
