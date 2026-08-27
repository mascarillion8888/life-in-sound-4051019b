import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { GothicArtError } from "@/services/huggingFaceService";
import { GothicArtFallback, GothicArtSkeleton, gothicArtFallbackContent } from "./gothicArt";

const t = {
  generating: "Etching your gothic art…",
  rateLimitTitle: "Ink Supply Exhausted",
  rateLimitMessage: "limit msg",
  networkTitle: "The Void Swallowed It",
  networkMessage: "net msg",
  genericTitle: "The Canvas Split",
  genericMessage: "gen msg",
  retry: "Try Again",
  retrying: "Resurrecting…",
  sectionError: "This section could not be rendered",
  brokenArtwork: "A lost etching",
};

describe("GothicArtSkeleton", () => {
  it("renders a generating chiaroscuro frame with shimmer and caption", () => {
    render(<GothicArtSkeleton generating caption={t.generating} />);
    expect(screen.getByTestId("gothic-art-skeleton")).toBeTruthy();
    expect(screen.getByTestId("gothic-art-skeleton").getAttribute("data-generating")).toBe("true");
    expect(screen.getByTestId("gothic-art-shimmer")).toBeTruthy();
    expect(screen.getByText(t.generating)).toBeTruthy();
  });

  it("omits shimmer and caption when not generating", () => {
    render(<GothicArtSkeleton generating={false} caption={t.generating} />);
    expect(screen.getByTestId("gothic-art-skeleton").getAttribute("data-generating")).toBe("false");
    expect(screen.queryByTestId("gothic-art-shimmer")).toBeNull();
    expect(screen.queryByText(t.generating)).toBeNull();
  });
});

describe("GothicArtFallback", () => {
  it("renders a doom fallback with the given copy", () => {
    render(<GothicArtFallback title={t.genericTitle} message={t.brokenArtwork} />);
    expect(screen.getByTestId("gothic-art-fallback")).toBeTruthy();
    expect(screen.getByText(t.genericTitle)).toBeTruthy();
    expect(screen.getByText(t.brokenArtwork)).toBeTruthy();
  });

  it("no retry button when onRetry is absent", () => {
    render(<GothicArtFallback title={t.genericTitle} message={t.brokenArtwork} />);
    expect(screen.queryByRole("button", { name: t.retry })).toBeNull();
  });

  it("invokes onRetry and shows a retrying state", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <GothicArtFallback title={t.genericTitle} message={t.brokenArtwork} onRetry={onRetry} />,
    );
    fireEvent.click(screen.getByRole("button", { name: t.retry }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(
      <GothicArtFallback
        title={t.genericTitle}
        message={t.brokenArtwork}
        onRetry={onRetry}
        retrying
      />,
    );
    expect(screen.getByRole("button", { name: t.retrying })).toBeTruthy();
  });
});

describe("gothicArtFallbackContent", () => {
  it("maps rate-limit/auth to the ink-exhausted copy", () => {
    expect(gothicArtFallbackContent("rate-limit", t)).toMatchObject({
      title: t.rateLimitTitle,
      message: t.rateLimitMessage,
    });
    expect(gothicArtFallbackContent("auth", t)).toMatchObject({ title: t.rateLimitTitle });
  });

  it("maps network/missing-token to the void copy", () => {
    expect(gothicArtFallbackContent("network", t)).toMatchObject({
      title: t.networkTitle,
      message: t.networkMessage,
    });
    expect(gothicArtFallbackContent("missing-token", t)).toMatchObject({ title: t.networkTitle });
  });

  it("falls back to the generic copy for provider/unknown/undefined", () => {
    expect(gothicArtFallbackContent("provider", t)).toMatchObject({ title: t.genericTitle });
    expect(gothicArtFallbackContent("unknown", t)).toMatchObject({ title: t.genericTitle });
    expect(gothicArtFallbackContent(undefined, t)).toMatchObject({ title: t.genericTitle });
  });

  it("resolves a classification from a GothicArtError", () => {
    const err = new GothicArtError("rate-limit", "too many");
    expect(gothicArtFallbackContent(err.kind, t).title).toBe(t.rateLimitTitle);
  });
});
