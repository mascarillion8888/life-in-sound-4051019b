import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runRole, DEFAULT_REQUEST_TIMEOUT_MS } from "@/lib/llm/orchestra";

/**
 * Orchestra Latency Safety v1 — focused verification of the bounded request
 * timeout added to the TypeScript Orchestra bridge (`src/lib/llm/orchestra.ts`).
 *
 * Covers the five required scenarios:
 *   1. provider success
 *   2. provider timeout (bounded request must not wait indefinitely; null; non-fatal)
 *   3. provider parse failure (non-fatal)
 *   4. provider HTTP failure (non-fatal)
 *   5. orchestration continues after a provider failure
 *
 * No real provider calls: every request is routed through a `fetchImpl`
 * override. No network, no LLM, no Python/LiteLLM. Routing is untouched — the
 * `summarizer` role (Groq) is used purely as a stand-in for these unit tests.
 */

const PROVIDER_KEY = "GROQ_API_KEY";
const originalEnv = { ...process.env };

function okFetch(content: string): typeof fetch {
  return (async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content } }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as unknown as typeof fetch;
}

describe("Orchestra latency safety — bounded request timeout", () => {
  beforeEach(() => {
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    process.env[PROVIDER_KEY] = "test-key";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("exposes a positive default bounded timeout", () => {
    expect(DEFAULT_REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
  });

  // 1. provider success — the bounded timeout must not interfere with a prompt response.
  it("1. provider success returns the assistant text", async () => {
    const result = await runRole("summarizer", "hello", {
      fetchImpl: okFetch("  Compressed summary.  "),
    });
    expect(result).toBe("Compressed summary.");
  });

  // 2. provider timeout — a request that never resolves must be aborted by the
  //    bounded timeout and resolve to `null` (non-fatal, never throws).
  it("2. provider timeout returns null without throwing and without waiting indefinitely", async () => {
    const started = Date.now();
    const hangingFetch = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        // Mirror real fetch: reject when the request signal aborts. The bounded
        // timeout signal passed by runRole aborts after `timeoutMs`, ending the
        // wait instead of hanging indefinitely.
        const signal = init?.signal;
        if (signal) {
          if (signal.aborted) reject(new DOMException("Aborted", "AbortError"));
          else
            signal.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
        }
      })) as unknown as typeof fetch;

    const result = await runRole("summarizer", "hello", {
      fetchImpl: hangingFetch,
      timeoutMs: 50,
    });

    const elapsed = Date.now() - started;
    expect(result).toBeNull();
    // Bounded: well below the 30s default, proving it did not wait indefinitely.
    expect(elapsed).toBeLessThan(2_000);
  });

  // 2b. caller-supplied abort signal is honoured too (non-fatal).
  it("2b. caller abort resolves to null without throwing", async () => {
    const ac = new AbortController();
    const hangingFetch = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal) {
          if (signal.aborted) reject(new DOMException("Aborted", "AbortError"));
          else
            signal.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
        }
      })) as unknown as typeof fetch;

    const pending = runRole("summarizer", "hello", {
      fetchImpl: hangingFetch,
      timeoutMs: 0, // disable bounded timeout; rely on caller signal
      signal: ac.signal,
    });
    ac.abort();
    const result = await pending;
    expect(result).toBeNull();
  });

  // 3. provider parse failure — well-formed HTTP but empty/malformed body → null, non-fatal.
  it("3. provider parse failure returns null without throwing", async () => {
    const malformedFetch = (async () =>
      new Response(JSON.stringify({ choices: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;
    const result = await runRole("summarizer", "hello", {
      fetchImpl: malformedFetch,
    });
    expect(result).toBeNull();
  });

  // 4. provider HTTP failure — non-OK status → null, non-fatal.
  it("4. provider HTTP failure returns null without throwing", async () => {
    const errorFetch = (async () =>
      new Response("upstream error", { status: 503 })) as unknown as typeof fetch;
    const result = await runRole("summarizer", "hello", {
      fetchImpl: errorFetch,
    });
    expect(result).toBeNull();
  });

  // 5. orchestration continues after a provider failure — a sequence of role
  //    calls where an earlier failure does not prevent a later call from
  //    succeeding. Mirrors the companion flow's graceful-degradation contract:
  //    a failed provider call yields `null` and the next turn proceeds.
  it("5. orchestration continues after a provider failure", async () => {
    // First call fails (timeout), second call succeeds.
    const calls: string[] = [];
    let first = true;
    const hangingThenOk: typeof fetch = (async (_url: string, init?: RequestInit) => {
      if (first) {
        first = false;
        calls.push("attempt-1");
        // Hang until the bounded timeout aborts the request signal.
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            if (signal.aborted) reject(new DOMException("Aborted", "AbortError"));
            else
              signal.addEventListener(
                "abort",
                () => reject(new DOMException("Aborted", "AbortError")),
                { once: true },
              );
          }
        });
      }
      calls.push("attempt-2");
      return new Response(JSON.stringify({ choices: [{ message: { content: "recovered" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const firstResult = await runRole("summarizer", "hello", {
      fetchImpl: hangingThenOk,
      timeoutMs: 50,
    });
    expect(firstResult).toBeNull();

    const second = await runRole("summarizer", "hello", {
      fetchImpl: hangingThenOk,
    });
    expect(second).toBe("recovered");

    expect(calls).toEqual(["attempt-1", "attempt-2"]);
  });
});
