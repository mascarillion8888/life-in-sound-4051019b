import { afterEach, describe, expect, it, vi } from "vitest";

import { callOpenRouter, DEFAULT_OPENROUTER_MODEL } from "./openrouter.server";

const MESSAGES = [{ role: "user" as const, content: "hello" }];

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

function okFetch(body: unknown) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
}

describe("callOpenRouter timeouts", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("returns null without a key — no request, no timer", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const fetchImpl = okFetch({ choices: [{ message: { content: "x" } }] });
    const result = await callOpenRouter(MESSAGES, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("aborts after the default budget and throws so the caller falls back", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    vi.useFakeTimers();
    const fetchImpl = hangingFetch();

    const promise = callOpenRouter(MESSAGES, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const assertion = expect(promise).rejects.toThrow(/timed out or was cancelled/i);
    await vi.advanceTimersByTimeAsync(20_001);
    await assertion;
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("honours a per-call timeoutMs override", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    const fetchImpl = hangingFetch();
    await expect(
      callOpenRouter(MESSAGES, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        timeoutMs: 5,
      }),
    ).rejects.toThrow(/timed out or was cancelled/i);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("keeps the success path unchanged", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    const fetchImpl = okFetch({ choices: [{ message: { content: "  the story  " } }] });
    const result = await callOpenRouter(MESSAGES, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toBe("the story");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe("callOpenRouter default model", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  /** Capture the JSON body of the (first) request the fetch mock received. */
  function captureBody(fetchImpl: ReturnType<typeof vi.fn>) {
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit | undefined;
    return JSON.parse(String(init?.body)) as { model?: string };
  }

  it("sends DEFAULT_OPENROUTER_MODEL when no env override is set", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    vi.stubEnv("OPENROUTER_PRIMARY_MODEL", "");
    const fetchImpl = okFetch({ choices: [{ message: { content: "x" } }] });
    await callOpenRouter(MESSAGES, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(captureBody(fetchImpl).model).toBe(DEFAULT_OPENROUTER_MODEL);
  });

  it("lets OPENROUTER_PRIMARY_MODEL override the default", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    vi.stubEnv("OPENROUTER_PRIMARY_MODEL", "some/other-model");
    const fetchImpl = okFetch({ choices: [{ message: { content: "x" } }] });
    await callOpenRouter(MESSAGES, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(captureBody(fetchImpl).model).toBe("some/other-model");
  });
});

describe("callOpenRouter never logs the provider response body", () => {
  const SECRET = "LEAKED_PROMPT_OR_USER_MEMORY_TEXT";

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function captureLogs() {
    const spies = [vi.spyOn(console, "log"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
    for (const spy of spies) spy.mockImplementation(() => {});
    return () =>
      spies
        .flatMap((spy) => spy.mock.calls)
        .flat()
        .join(" ");
  }

  it("logs only the status on a transient error, never the body", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    const fetchImpl = vi.fn(async () => new Response(SECRET, { status: 500 }));
    const readLogs = captureLogs();

    await expect(
      callOpenRouter(MESSAGES, { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/HTTP 500/);

    const logged = readLogs();
    expect(logged).not.toContain(SECRET);
    expect(logged).toContain("status=500");
    // 500 → fallback attempt, both attempts logged with a status only.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("never logs the body when the response is unparseable", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
    const fetchImpl = vi.fn(async () => new Response(SECRET, { status: 200 }));
    const readLogs = captureLogs();

    const result = await callOpenRouter(MESSAGES, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toBeNull();
    const logged = readLogs();
    expect(logged).not.toContain(SECRET);
    expect(logged).toContain("parse edilemeyen yanıt");
  });
});
