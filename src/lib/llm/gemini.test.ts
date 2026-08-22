import { afterEach, describe, expect, it, vi } from "vitest";

import { getGeminiApiKey, isGeminiConfigured } from "./gemini";

describe("gemini env access", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports unconfigured when no key is set", () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "");
    expect(isGeminiConfigured()).toBe(false);
    expect(getGeminiApiKey()).toBeNull();
  });

  it("exposes the key when configured", () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "test-gemini-key-123");
    expect(isGeminiConfigured()).toBe(true);
    expect(getGeminiApiKey()).toBe("test-gemini-key-123");
  });

  it("trims surrounding whitespace", () => {
    vi.stubEnv("VITE_GEMINI_API_KEY", "   ");
    expect(isGeminiConfigured()).toBe(false);
  });
});
