import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

import { authorizeCardGeneration } from "./generation-security.server";

describe("authorizeCardGeneration", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    mocks.getUser.mockReset().mockResolvedValue({
      data: { user: { id: "anonymous-user-1" } },
      error: null,
    });
    mocks.rpc.mockReset().mockResolvedValue({ data: true, error: null });
    mocks.createClient.mockReset().mockImplementation(() => ({
      auth: { getUser: mocks.getUser },
      rpc: mocks.rpc,
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a missing token without contacting Supabase", async () => {
    await expect(authorizeCardGeneration(null, "itunes:42")).resolves.toBeNull();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects an invalid or expired session before reserving quota", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("invalid token") });
    await expect(authorizeCardGeneration("bad-token", "itunes:42")).resolves.toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a user after the atomic quota reservation denies the request", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(
      authorizeCardGeneration("valid-token", "itunes:42", "private prompt"),
    ).resolves.toBeNull();
  });

  it("accepts anonymous Supabase identities and reserves a one-way prompt fingerprint", async () => {
    const access = await authorizeCardGeneration("valid-token", "itunes:42", "private prompt");
    expect(access?.userId).toBe("anonymous-user-1");
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_card_generation", {
      p_track_key: expect.stringMatching(/^itunes:42:[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain("private prompt");
  });
});
