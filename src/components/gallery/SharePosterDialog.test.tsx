import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import type { CardRow } from "@/lib/supabase/cards-remote";
import { SharePosterDialog } from "./SharePosterDialog";

/** The share button starts disabled while the poster canvas renders async. */
async function shareButton() {
  const button = (await screen.findByRole("button", {
    name: /Download \/ Share to Story/,
  })) as HTMLButtonElement;
  await waitFor(() => expect(button.disabled).toBe(false));
  return button;
}

vi.mock("@/lib/soundmap/sharePoster", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/soundmap/sharePoster")>();
  return {
    ...actual,
    renderSharePoster: vi.fn(async () => {
      /* jsdom has no 2D context — the canvas stays untouched. */
      return document.createElement("canvas");
    }),
    exportSharePoster: vi.fn(async () => "downloaded" as const),
  };
});

function card(): CardRow {
  return {
    id: "id",
    trackKey: "itunes:123",
    title: "Fragile",
    artist: "Sting",
    genre: null,
    releaseYear: 1987,
    birthYear: 1978,
    encounterAge: 9,
    eraYear: 1987,
    userMemory: null,
    scene: "gothic",
    lore: null,
    imagePath: null,
    createdAt: "2026-08-26T00:00:00Z",
  };
}

describe("SharePosterDialog", () => {
  it("renders the poster canvas and the share button", () => {
    render(<SharePosterDialog card={card()} open onOpenChange={() => {}} />);
    expect(screen.getByTestId("share-poster-canvas")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Download \/ Share to Story/ })).toBeTruthy();
  });

  it("is disabled without a card", () => {
    render(<SharePosterDialog card={null} open onOpenChange={() => {}} />);
    expect(
      (screen.getByRole("button", { name: /Download \/ Share to Story/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("shows a busy spinner while exporting and a success toast on download", async () => {
    const { exportSharePoster } = await import("@/lib/soundmap/sharePoster");
    let resolveExport: (value: "downloaded") => void = () => {};
    vi.mocked(exportSharePoster).mockImplementationOnce(
      () => new Promise<"downloaded">((res) => (resolveExport = res)),
    );

    render(<SharePosterDialog card={card()} open onOpenChange={() => {}} />);
    fireEvent.click(await shareButton());

    // Busy spinner shown while the (mock) export is in flight.
    expect(await screen.findByRole("button", { name: /Preparing…/ })).toBeTruthy();

    resolveExport("downloaded");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Downloaded/ })).toBeTruthy();
    });
  });

  it("shows an inline error fallback when export fails", async () => {
    const { exportSharePoster } = await import("@/lib/soundmap/sharePoster");
    let resolveExport: (value: "failed") => void = () => {};
    vi.mocked(exportSharePoster).mockImplementationOnce(
      () => new Promise<"failed">((res) => (resolveExport = res)),
    );

    render(<SharePosterDialog card={card()} open onOpenChange={() => {}} />);
    fireEvent.click(await shareButton());

    // Resolve the mocked export to "failed" so the inline fallback renders.
    resolveExport("failed");
    expect(await screen.findByTestId("share-poster-error")).toBeTruthy();
  });

  it("shows a rendering overlay while the poster preview renders, then hides it", async () => {
    const { renderSharePoster } = await import("@/lib/soundmap/sharePoster");
    let resolveRender: () => void = () => {};
    vi.mocked(renderSharePoster).mockImplementationOnce(
      () =>
        new Promise<HTMLCanvasElement>((res) => {
          resolveRender = () => res(document.createElement("canvas"));
        }),
    );

    render(<SharePosterDialog card={card()} open onOpenChange={() => {}} />);
    expect(await screen.findByTestId("share-poster-rendering")).toBeTruthy();

    // Render resolves → overlay hides.
    resolveRender();
    await waitFor(() => expect(screen.queryByTestId("share-poster-rendering")).toBeNull());
    const button = (await screen.findByRole("button", {
      name: /Download \/ Share to Story/,
    })) as HTMLButtonElement;
    await waitFor(() => expect(button.disabled).toBe(false));
  });

  it("hides the rendering overlay and stays usable when the poster render rejects", async () => {
    const { renderSharePoster } = await import("@/lib/soundmap/sharePoster");
    vi.mocked(renderSharePoster).mockImplementationOnce(() => Promise.reject(new Error("boom")));

    // The preview effect swallows the rejection, so the overlay clears.
    render(<SharePosterDialog card={card()} open onOpenChange={() => {}} />);
    await waitFor(() => expect(screen.queryByTestId("share-poster-rendering")).toBeNull());
    const button = (await screen.findByRole("button", {
      name: /Download \/ Share to Story/,
    })) as HTMLButtonElement;
    await waitFor(() => expect(button.disabled).toBe(false));
  });
});
