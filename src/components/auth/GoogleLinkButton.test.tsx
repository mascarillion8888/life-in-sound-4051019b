import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";

import type { SessionState } from "@/lib/supabase/use-session";
import { GoogleLinkButton } from "./GoogleLinkButton";

/*
 * The Supabase browser client is the only mocked boundary: it is a network
 * dependency that does not exist in the test environment. Every other code
 * path (state branching, the linkIdentity handler) runs for real.
 */
vi.mock("@/lib/supabase/client", () => ({
  getSupabase: vi.fn(),
}));

import { getSupabase } from "@/lib/supabase/client";

const getClient = vi.mocked(getSupabase);

/** Minimal user shaped only by the fields the component reads. */
function user(over: Partial<User>): User {
  return over as User;
}

beforeEach(() => {
  getClient.mockReset();
});

describe("GoogleLinkButton", () => {
  it("warns instead of hiding when no server session is available", () => {
    render(<GoogleLinkButton session={{ status: "unavailable" }} />);
    expect(screen.getByText("Account sync is off (no server session).")).toBeTruthy();
    expect(screen.queryByTestId("google-link")).toBeNull();
  });

  it("renders nothing while the session is still loading", () => {
    render(<GoogleLinkButton session={{ status: "loading" }} />);
    expect(screen.queryByTestId("google-link")).toBeNull();
    expect(screen.queryByText(/account sync/i)).toBeNull();
  });

  it("shows the signed-in email when the account is not anonymous", () => {
    render(
      <GoogleLinkButton
        session={{
          status: "anonymous",
          user: user({ is_anonymous: false, email: "fan@example.com" }),
        }}
      />,
    );
    expect(screen.getByText("Signed in as fan@example.com")).toBeTruthy();
    expect(screen.queryByTestId("google-link")).toBeNull();
  });

  it("shows a generic line when signed in without an email", () => {
    render(
      <GoogleLinkButton session={{ status: "anonymous", user: user({ is_anonymous: false }) }} />,
    );
    expect(screen.getByText("Already signed in")).toBeTruthy();
    expect(screen.queryByTestId("google-link")).toBeNull();
  });

  it("offers the Google button for a real anonymous user", () => {
    render(
      <GoogleLinkButton session={{ status: "anonymous", user: user({ is_anonymous: true }) }} />,
    );
    expect(screen.getByTestId("google-link").textContent).toBe("Save my cards with Google");
    expect(screen.queryByText(/signed in|account sync/i)).toBeNull();
  });

  it("links the identity when the anonymous button is clicked", async () => {
    const linkIdentity = vi.fn().mockResolvedValue({ error: null });
    getClient.mockReturnValue({ auth: { linkIdentity } } as unknown as ReturnType<
      typeof getSupabase
    >);

    render(
      <GoogleLinkButton session={{ status: "anonymous", user: user({ is_anonymous: true }) }} />,
    );
    fireEvent.click(screen.getByTestId("google-link"));

    await waitFor(() =>
      expect(linkIdentity).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: window.location.origin },
      }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("surfaces an error and never logs the session when linking fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const linkIdentity = vi.fn().mockResolvedValue({ error: { message: "nope" } });
    getClient.mockReturnValue({ auth: { linkIdentity } } as unknown as ReturnType<
      typeof getSupabase
    >);

    render(
      <GoogleLinkButton session={{ status: "anonymous", user: user({ is_anonymous: true }) }} />,
    );
    fireEvent.click(screen.getByTestId("google-link"));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "Google sign-in is not available right now.",
      ),
    );
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
