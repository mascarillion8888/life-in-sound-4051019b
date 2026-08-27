/**
 * Live API integration smoke-probe.
 *
 * This module is the *single* place that reaches out to the real providers
 * during a smoke run. It is deliberately env-gated:
 *
 *   - Every probe first checks whether its required credential/URL is set.
 *   - If it is NOT set, the probe returns `{ status: "skipped" }` — it never
 *     throws, never fabricates a success, and never pretends a live call ran.
 *   - If it IS set, the probe performs a real, authenticated HTTPS request and
 *     reports a healthy/unhealthy response.
 *
 * We intentionally never log the secret values; we only expose booleans and
 * HTTP status numbers so a smoke report can never leak a token.
 *
 * The detection reads `import.meta.env` for the VITE_-prefixed browser vars
 * (Supabase anon pair, HF inference token) and `process.env` for the server
 * secret (GROQ). Any of these may be absent in a credential-less sandbox —
 * that is a *skip*, not a failure.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProbeStatus =
  | { status: "passed"; detail: string }
  | { status: "failed"; detail: string }
  | { status: "skipped"; detail: string };

export type SmokeReport = {
  generatedAt: string;
  probes: {
    supabase: ProbeStatus;
    groq: ProbeStatus;
    huggingFace: ProbeStatus;
  };
};

const HF_AUTH_ENDPOINT = "https://huggingface.co/api/whoami-v2";
const GROQ_MODELS_ENDPOINT = "https://api.groq.com/openai/v1/models";

function envUrl(name: string): string | null {
  const value = import.meta.env?.[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function processSecret(name: string): string | null {
  const value = (process as { env?: Record<string, string | undefined> }).env?.[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Minimal authenticated GET probe. Resolves with status text; never throws. */
async function ping(
  url: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<{ ok: boolean; status: number; detail: string }> {
  try {
    const res = await fetchImpl(url, { headers, method: "GET" });
    return { ok: res.ok, status: res.status, detail: `HTTP ${res.status}` };
  } catch (cause) {
    return {
      ok: false,
      status: 0,
      detail: cause instanceof Error ? cause.message : "network error",
    };
  }
}

async function probeSupabase(
  client: SupabaseClient | null,
  fetchImpl: typeof fetch,
): Promise<ProbeStatus> {
  const url = envUrl("VITE_SUPABASE_URL");
  const anon = envUrl("VITE_SUPABASE_ANON_KEY");
  if (!url || !anon || !client) {
    return { status: "skipped", detail: "VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY unset" };
  }
  // Key-validating REST ping (no row reads — cannot be blocked by RLS). A 2xx
  // (or a 400/401) proves the URL + anon key are wired to a live project.
  const root = url.replace(/\/$/, "");
  const { ok, status, detail } = await ping(
    `${root}/rest/v1/`,
    { apikey: anon, Authorization: `Bearer ${anon}` },
    fetchImpl,
  );
  return { status: ok ? "passed" : "failed", detail: `HTTP ${status}` };
}

async function probeGroq(fetchImpl: typeof fetch): Promise<ProbeStatus> {
  const key = processSecret("GROQ_API_KEY");
  if (!key) return { status: "skipped", detail: "GROQ_API_KEY unset" };
  const { ok, status, detail } = await ping(
    GROQ_MODELS_ENDPOINT,
    { Authorization: `Bearer ${key}` },
    fetchImpl,
  );
  return { status: ok ? "passed" : "failed", detail };
}

async function probeHuggingFace(fetchImpl: typeof fetch): Promise<ProbeStatus> {
  const token = envUrl("VITE_HF_TOKEN") ?? processSecret("HF_TOKEN");
  if (!token) return { status: "skipped", detail: "VITE_HF_TOKEN / HF_TOKEN unset" };
  const { ok, status, detail } = await ping(
    HF_AUTH_ENDPOINT,
    { Authorization: `Bearer ${token}` },
    fetchImpl,
  );
  return { status: ok ? "passed" : "failed", detail };
}

function defaultFetch(): typeof fetch {
  if (typeof globalThis.fetch === "function") return globalThis.fetch.bind(globalThis);
  return (() => Promise.reject(new Error("fetch unavailable"))) as unknown as typeof fetch;
}

/**
 * Run the full live smoke suite. `options` shine the dependencies so tests can
 * drive it without touching the network (overriding fetch / client / now).
 *
 * IMPORTANT: this only issues real network requests when the corresponding
 * secret/URL is actually present in the environment. In a credential-less
 * sandbox every probe reports `skipped`.
 */
export async function runLiveSmoke(
  options: {
    supabaseClient?: SupabaseClient | null;
    fetchImpl?: typeof fetch;
    now?: () => string;
  } = {},
): Promise<SmokeReport> {
  const fetchImpl = options.fetchImpl ?? defaultFetch();
  const now = options.now ?? (() => new Date().toISOString());
  const client = options.supabaseClient === undefined ? null : options.supabaseClient;

  const [supabase, groq, huggingFace] = await Promise.all([
    probeSupabase(client, fetchImpl),
    probeGroq(fetchImpl),
    probeHuggingFace(fetchImpl),
  ]);

  return {
    generatedAt: now(),
    probes: { supabase, groq, huggingFace },
  };
}

/** Convenience: is every probe present (i.e. wiring is complete to test)? */
export function allProbesPresent(report: SmokeReport): boolean {
  return Object.values(report.probes).every((p) => p.status !== "skipped");
}
