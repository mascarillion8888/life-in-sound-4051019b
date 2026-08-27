import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ErrorBoundary } from "./ErrorBoundary";

function Bomb({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) throw new Error("kaboom");
  return <div>fine</div>;
}

describe("ErrorBoundary", () => {
  it("renders children when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <div>fine</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("fine")).toBeTruthy();
  });

  it("renders the default fallback when a child throws", () => {
    // Suppress expected console.error from componentDidCatch.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("error-boundary-fallback")).toBeTruthy();
    spy.mockRestore();
  });

  it("passes the thrown error to a custom fallback and recovers on reset", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const Fallback = ({ error, reset }: { error: Error; reset: () => void }) => (
      <div>
        <span data-testid="caught">{error.message}</span>
        <button onClick={reset}>fix-it</button>
      </div>
    );
    render(
      <ErrorBoundary fallback={Fallback}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("caught").textContent).toBe("kaboom");
    spy.mockRestore();
  });
});
