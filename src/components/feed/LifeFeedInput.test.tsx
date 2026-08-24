import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Song } from "@/lib/song/types";
import { LifeFeedInput } from "./LifeFeedInput";

function itunesSong(title: string, artist: string): Song {
  return {
    provider: "itunes",
    providerId: `it-${title}`,
    title,
    artist,
    album: null,
    artworkUrl: null,
    isrc: null,
    verified: true,
  };
}

describe("LifeFeedInput", () => {
  it("renders the memory-note prompt and a disabled add button initially", () => {
    render(<LifeFeedInput onAdd={() => {}} />);
    expect(
      screen.getByPlaceholderText("Which song is speaking for you today?"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add to the map/i })).toBeDisabled();
  });

  it("adds a manual song from free text, with the note", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<LifeFeedInput onAdd={onAdd} debounceMs={0} />);

    await user.type(screen.getByLabelText("Search songs"), "Painkiller");
    await user.type(screen.getByLabelText(/memory note/i), "gece vardiyası");
    await user.click(screen.getByRole("button", { name: /add to the map/i }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    const { song, note } = onAdd.mock.calls[0][0];
    expect(song.provider).toBe("manual");
    expect(song.title).toBe("Painkiller");
    expect(note).toBe("gece vardiyası");

    // Fields reset after add.
    expect(screen.getByLabelText("Search songs")).toHaveValue("");
    expect(screen.getByLabelText(/memory note/i)).toHaveValue("");
  });

  it("passes null note when the textarea is empty", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(<LifeFeedInput onAdd={onAdd} debounceMs={0} />);

    await user.type(screen.getByLabelText("Search songs"), "Duster");
    await user.click(screen.getByRole("button", { name: /add to the map/i }));

    expect(onAdd.mock.calls[0][0].note).toBeNull();
  });

  it("offers iTunes suggestions and uses the picked song", async () => {
    const onAdd = vi.fn();
    const suggester = vi.fn().mockResolvedValue([itunesSong("Fragile", "Sting")]);
    const user = userEvent.setup();
    render(<LifeFeedInput onAdd={onAdd} suggester={suggester} debounceMs={0} />);

    await user.type(screen.getByLabelText("Search songs"), "frag");
    await waitFor(() => expect(screen.getByText("Fragile")).toBeInTheDocument());
    await user.click(screen.getByText("Fragile"));

    // Selected chip shows; submitting uses the verified song.
    expect(screen.getByLabelText("Remove selection")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /add to the map/i }));

    const { song } = onAdd.mock.calls[0][0];
    expect(song.provider).toBe("itunes");
    expect(song.title).toBe("Fragile");
    expect(song.artist).toBe("Sting");
  });

  it("removing the selection falls back to free-text entry", async () => {
    const onAdd = vi.fn();
    const suggester = vi.fn().mockResolvedValue([itunesSong("Fragile", "Sting")]);
    const user = userEvent.setup();
    render(<LifeFeedInput onAdd={onAdd} suggester={suggester} debounceMs={0} />);

    await user.type(screen.getByLabelText("Search songs"), "frag");
    await waitFor(() => expect(screen.getByText("Fragile")).toBeInTheDocument());
    await user.click(screen.getByText("Fragile"));
    await user.click(screen.getByLabelText("Remove selection"));

    await user.type(screen.getByLabelText("Search songs"), "manual tune");
    await user.click(screen.getByRole("button", { name: /add to the map/i }));

    const { song } = onAdd.mock.calls[0][0];
    expect(song.provider).toBe("manual");
    expect(song.title).toBe("manual tune");
  });

  it("disables the button while pending", () => {
    render(<LifeFeedInput onAdd={() => {}} pending />);
    expect(screen.getByRole("button", { name: /adding/i })).toBeDisabled();
  });
});
