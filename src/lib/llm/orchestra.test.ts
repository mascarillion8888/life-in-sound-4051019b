import { afterEach, describe, expect, it, vi } from "vitest";

import { runRole } from "./orchestra";

describe("runRole provider timeout", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("aborts a summarizer request after the default time budget", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.useFakeTimers();

    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
        }),
    );

    const result = runRole("summarizer", "A short test prompt", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await vi.advanceTimersByTimeAsync(12_001);

    await expect(result).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
