/**
 * Tests for the env-gated live smoke harness.
 *
 * The harness issues NO real network calls unless the corresponding
 * credential/URL is present. These tests pin that contract:
 *
 *   - In a credential-less environment every probe reports `skipped` and the
 *     fetch mock is never called (no accidental live requests in CI).
 *   - With a specific credential injected (vi.stubEnv), only that probe reaches
 *     the (mocked) network, and a healthy/unhealthy status is mapped correctly.
 *   - Failure statuses (e.g. 401) are surfaced as `failed`, never flavored as
 *     success, and no secret material is ever included in the report detail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { allProbesPresent, runLiveSmoke, type ProbeStatus, type SmokeReport } from "./liveSmoke";

function okFetch(body: unknown = {}, status = 200): typeof fetch {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
  })) as unknown as typeof fetch;
}

function notCallableFetch(): typeof fetch {
  return vi.fn(async () => {
    throw new Error("network call attempted during a skip!");
  }) as unknown as typeof fetch;
}

function find<T extends ProbeStatus["status"]>(
  report: SmokeReport,
  key: keyof SmokeReport["probes"],
  status: T,
) {
  return report.probes[key].status === status;
}

describe("runLiveSmoke — credential-less sandbox", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VITE_HF_TOKEN", "");
    vi.stubEnv("HF_TOKEN", "");
    vi.stubEnv("GROQ_API_KEY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("reports every probe as skipped and never touches the network", async () => {
    const fetchImpl = notCallableFetch();
    const report = await runLiveSmoke({ fetchImpl, supabaseClient: null });
    expect(find(report, "supabase", "skipped")).toBe(true);
    expect(find(report, "groq", "skipped")).toBe(true);
    expect(find(report, "huggingFace", "skipped")).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(allProbesPresent(report)).toBe(false);
  });
});

describe("runLiveSmoke — per-provider injection", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("runs ONLY the GROQ probe when only GROQ_API_KEY is set", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VITE_HF_TOKEN", "");
    vi.stubEnv("HF_TOKEN", "");
    vi.stubEnv("GROQ_API_KEY", "sk-groq-live-secret");
    const fetchImpl = okFetch({}, 200);
    const report = await runLiveSmoke({
      fetchImpl,
      supabaseClient: null,
      now: () => "2026-08-27T00:00:00Z",
    });
    // exactly one network call, to the GROQ models endpoint
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(find(report, "groq", "passed")).toBe(true);
    expect(find(report, "supabase", "skipped")).toBe(true);
    // the mock never records the URL, but the detail must not echo the secret
    expect(report.probes.groq.detail).not.toContain("groq-live-secret");
  });

  it("maps a GROQ 401 to failed (auth) — never to success", async () => {
    vi.stubEnv("GROQ_API_KEY", "sk-bad");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VITE_HF_TOKEN", "");
    vi.stubEnv("HF_TOKEN", "");
    const report = await runLiveSmoke({ fetchImpl: okFetch({}, 401), supabaseClient: null });
    expect(find(report, "groq", "failed")).toBe(true);
    expect(report.probes.groq.detail).toContain("401");
  });

  it("runs ONLY the HF probe when VITE_HF_TOKEN is set and never leaks the token", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    vi.stubEnv("VITE_HF_TOKEN", "hf-live-token");
    vi.stubEnv("HF_TOKEN", "");
    vi.stubEnv("GROQ_API_KEY", "");
    const fetchImpl = okFetch({}, 200);
    const report = await runLiveSmoke({ fetchImpl, supabaseClient: null });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(find(report, "huggingFace", "passed")).toBe(true);
    expect(find(report, "groq", "skipped")).toBe(true);
    // the report detail never echoes the token
    expect(report.probes.huggingFace.detail).not.toContain("hf-live-token");
  });

  it("runs the Supabase probe only when URL+anon+client are all present", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("VITE_HF_TOKEN", "");
    vi.stubEnv("HF_TOKEN", "");
    vi.stubEnv("GROQ_API_KEY", "");
    const client = {} as never;
    const report = await runLiveSmoke({ fetchImpl: okFetch({}, 200), supabaseClient: client });
    expect(find(report, "supabase", "passed")).toBe(true);
    expect(find(report, "groq", "skipped")).toBe(true);
    expect(find(report, "huggingFace", "skipped")).toBe(true);
  });

  it("skips the Supabase probe when the URL/anon pair exists but the client is null", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("VITE_HF_TOKEN", "");
    vi.stubEnv("HF_TOKEN", "");
    const report = await runLiveSmoke({ fetchImpl: notCallableFetch(), supabaseClient: null });
    expect(find(report, "supabase", "skipped")).toBe(true);
  });
});
