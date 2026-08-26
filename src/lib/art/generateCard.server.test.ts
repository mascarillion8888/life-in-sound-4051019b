import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  generateCardLoreCore,
  persistCardCore,
  type GenerateCardInput,
} from "./generateCard.server";

const ENCOUNTER: GenerateCardInput = {
  trackKey: "itunes:123",
  artist: "Sting",
  songTitle: "Fragile",
  genre: "Gothic Folk",
  releaseYear: 1987,
  birthYear: 1978,
  encounterAge: 9,
  userMemory: null,
  accessToken: null,
};

describe("generateCardLoreCore", () => {
  beforeEach(() => {
    vi.stubEnv("GROQ_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("falls back to the deterministic 2-sentence lore without a provider key", async () => {
    const lore = await generateCardLoreCore(ENCOUNTER);
    const sentences = lore.split(/(?<=[.!?])\s+/).filter(Boolean);
    expect(sentences).toHaveLength(2);
  });

  it("uses the LLM snippet when the provider answers", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const llmText = "A child hums along in the lamplight. The song never leaves the room.";
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: llmText } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const lore = await generateCardLoreCore(ENCOUNTER, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(lore).toBe(llmText);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string);
    expect(body.messages[1].content).toContain("Fragile");
    expect(body.messages[1].content).toContain("Sting");
    expect(body.messages[1].content).toContain("age 9");
    expect(body.messages[1].content).toContain("1987");
  });

  it("rejects degenerate LLM output and falls back", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const lore = await generateCardLoreCore(ENCOUNTER, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(lore).not.toBe("ok");
    expect(lore.length).toBeGreaterThan(40);
  });

  it("falls back when the provider call fails", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const lore = await generateCardLoreCore(ENCOUNTER, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(lore.length).toBeGreaterThan(40);
  });
});

describe("persistCardCore", () => {
  it("skips silently without an access token", async () => {
    const ok = await persistCardCore(ENCOUNTER, "lore", "gothic", null, {
      supabaseUrl: "https://example.supabase.co",
      anonKey: "anon",
    });
    expect(ok).toBe(false);
  });

  it("skips silently without Supabase env config", async () => {
    const ok = await persistCardCore(
      { ...ENCOUNTER, accessToken: "token" },
      "lore",
      "gothic",
      null,
      { supabaseUrl: undefined, anonKey: undefined },
    );
    expect(ok).toBe(false);
  });
});
