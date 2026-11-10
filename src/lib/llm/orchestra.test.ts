import { afterEach, describe, expect, it, vi } from "vitest";

import { runRole } from "./orchestra";

/** A fetch that only settles when its AbortSignal fires. */
function hangingFetch() {
  return vi.fn(
    (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
      }),
  );
}

describe("runRole timeouts", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns null (fallback) after the default budget elapses", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    vi.useFakeTimers();
    const fetchImpl = hangingFetch();

    const promise = runRole("summarizer", "A short test prompt", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await vi.advanceTimersByTimeAsync(20_001);

    await expect(promise).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("honours a per-call timeoutMs override and still degrades to null", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchImpl = hangingFetch();

    const result = await runRole("summarizer", "A short test prompt", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 5,
    });

    expect(result).toBeNull();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("keeps the success path unchanged", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "  the answer  " } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    const result = await runRole("summarizer", "A short test prompt", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBe("the answer");
  });

  it("never logs the provider response body on a non-OK response", async () => {
    vi.stubEnv("GROQ_API_KEY", "test-key");
    const secret = "GROQ_BODY_SECRET_must_not_be_logged";
    const fetchImpl = vi.fn(async () => new Response(secret, { status: 500 }));
    const spies = [vi.spyOn(console, "log"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
    for (const spy of spies) spy.mockImplementation(() => {});

    const result = await runRole("summarizer", "A short test prompt", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBeNull();
    const logged = spies
      .flatMap((spy) => spy.mock.calls)
      .flat()
      .join(" ");
    expect(logged).not.toContain(secret);
  });
});
