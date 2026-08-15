/**
 * Privacy-safe product + AI usage instrumentation.
 *
 * Design rules (enforced structurally):
 *   - Only event names + low-risk categorical metadata are recorded.
 *   - NEVER raw user messages, raw Memory/Reflection content, photographs,
 *     signed URLs, provider secrets, access tokens, full prompts, or full LLM
 *     responses.
 *   - No third-party analytics SDK. This is a tiny internal abstraction safe to
 *     call from UI and server code.
 *   - Deterministic in tests: callers pass a `TelemetrySink` (default is a
 *     no-op) so assertions can capture events without global state.
 *
 * The sink is intentionally minimal. v1 defaults to a no-op so nothing is
 * persisted unless a sink is installed; the closed beta may log structured
 * events to the server console for dev review. No new database table is
 * required for v1 (see docs/BETA/README.md).
 */

/** Coarse latency bucket label (deterministic, privacy-safe). */
export function latencyBucketMs(ms: number): string {
  if (ms < 0) return "unknown";
  if (ms < 250) return "<250ms";
  if (ms < 500) return "250-500ms";
  if (ms < 1000) return "500-1000ms";
  if (ms < 2000) return "1000-2000ms";
  if (ms < 4000) return "2000-4000ms";
  return ">4000ms";
}

/**
 * A recorded telemetry event. Fields are deliberately categorical/coarse.
 * `userId` is included only because the existing privacy model already treats
 * the Supabase user id as an owner identifier (RLS); it is never combined with
 * raw content. No field here may hold user-authored text or credentials.
 */
export type TelemetryEvent = {
  event: string;
  timestamp: string;
  userId?: string;
  /** Coarse result/status, e.g. "ok" | "fallback" | "failed". */
  result?: string;
  providerCallCount?: number;
  latencyBucket?: string;
  fallback?: boolean;
  /** Optional structured sub-payload (must itself be content-free). */
  detail?: Record<string, string | number | boolean | null>;
};

/**
 * Keys that must NEVER appear in a telemetry payload. `track()` strips any
 * field whose name matches (case-insensitive) before recording, as a defence
 * in depth — the structured field types already forbid raw strings, but this
 * guards against a future caller passing a detail object.
 */
const FORBIDDEN_KEYS = new Set([
  "message",
  "rawnote",
  "usernote",
  "note",
  "content",
  "prompt",
  "response",
  "text",
  "body",
  "password",
  "token",
  "accesstoken",
  "apikey",
  "key",
  "secret",
  "url",
  "signedurl",
  "photo",
  "image",
  "reflection",
  "memorytext",
]);

function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(key.toLowerCase().replace(/[^a-z]/g, ""));
}

/** Deep-redact any forbidden keys from a detail object (returns a copy). */
function redactDetail(
  detail: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(detail)) {
    if (isForbiddenKey(k)) continue;
    // Values must remain categorical; string values are allowed only as
    // coarse labels (event names, statuses). A long string is a smell — we
    // cap length so no raw prose can leak through a detail field.
    if (typeof v === "string" && v.length > 64) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Telemetry sink — receives recorded events. The default sink is a no-op so
 * production is silent unless a sink is installed. Tests inject a capturing
 * sink. A sink must never throw (instrumentation must never break the product).
 */
export type TelemetrySink = {
  record(event: TelemetryEvent): void;
};

const NOOP_SINK: TelemetrySink = { record() {} };

let activeSink: TelemetrySink = NOOP_SINK;

/** Install the global sink (server-side dev instrumentation). */
export function setTelemetrySink(sink: TelemetrySink | null): void {
  activeSink = sink ?? NOOP_SINK;
}

/** @internal current sink (for tests). */
export function getTelemetrySink(): TelemetrySink {
  return activeSink;
}

/**
 * Record a telemetry event. Never throws. Strips forbidden keys. Safe to call
 * from UI (via a server fn) or server code.
 */
export function track(event: TelemetryEvent): void {
  try {
    const safe: TelemetryEvent = {
      event: String(event.event),
      timestamp: event.timestamp,
      userId: event.userId,
      result: event.result,
      providerCallCount: event.providerCallCount,
      latencyBucket: event.latencyBucket,
      fallback: event.fallback,
      detail: event.detail ? redactDetail(event.detail) : undefined,
    };
    activeSink.record(safe);
  } catch {
    // Instrumentation must never break the product.
  }
}

// ---------------------------------------------------------------------------
// Product event names (closed set). Adding a name here is the only way a new
// product event should be introduced.
// ---------------------------------------------------------------------------

export const PRODUCT_EVENTS = {
  appOpened: "app_opened",
  onboardingStarted: "onboarding_started",
  onboardingCompleted: "onboarding_completed",
  memoryCreated: "memory_created",
  reflectionCreated: "reflection_created",
  connectionCreated: "connection_created",
  patternOpened: "pattern_opened",
  eventCreated: "event_created",
  chapterCreated: "chapter_created",
  companionStarted: "companion_started",
  companionTurn: "companion_turn",
  companionMemoryConfirmed: "companion_memory_confirmed",
  storyRequested: "story_requested",
  feedbackSubmitted: "feedback_submitted",
} as const;

export type ProductEventName = (typeof PRODUCT_EVENTS)[keyof typeof PRODUCT_EVENTS];

// ---------------------------------------------------------------------------
// AI usage event contract (provider-neutral).
// ---------------------------------------------------------------------------

/**
 * Provider-neutral AI usage event. Records WHAT was called and the outcome,
 * never the prompt/response. Token counts are optional (only if the provider
 * already returns them safely); v1 omits them because the Orchestra bridge
 * does not expose usage.
 */
export type AiUsageEvent = {
  event: "ai_call";
  capability: string;
  /** Provider label inferred from the model name (never the API key). */
  provider: string;
  /** Model identifier (model names are not secrets). */
  model?: string;
  success: boolean;
  fallback: boolean;
  latencyBucket?: string;
  inputTokens?: number;
  outputTokens?: number;
};

/**
 * Infer a provider label from a model name, without importing Orchestra
 * internals. This keeps `orchestra.ts` untouched while still recording a
 * provider-neutral usage signal.
 */
export function inferProviderFromModel(model: string | undefined): string {
  if (!model) return "unknown";
  const m = model.toLowerCase();
  if (m.startsWith("gemini")) return "gemini";
  if (m.startsWith("gpt") || m.includes("openai")) return "openai";
  if (m.startsWith("claude") || m.includes("anthropic")) return "anthropic";
  if (m.startsWith("llama") || m.startsWith("qwen")) return "groq";
  if (m.startsWith("mistral")) return "mistral";
  if (m.includes("openrouter")) return "openrouter";
  return "unknown";
}

/** Record an AI usage event via the telemetry sink (content-free). */
export function trackAiUsage(usage: AiUsageEvent): void {
  track({
    event: "ai_call",
    timestamp: new Date().toISOString(),
    result: usage.success ? "ok" : usage.fallback ? "fallback" : "failed",
    fallback: usage.fallback,
    latencyBucket: usage.latencyBucket,
    detail: {
      capability: usage.capability,
      provider: usage.provider,
      model: usage.model ?? null,
      success: usage.success,
      fallback: usage.fallback,
      ...(usage.inputTokens != null ? { inputTokens: usage.inputTokens } : {}),
      ...(usage.outputTokens != null ? { outputTokens: usage.outputTokens } : {}),
    },
  });
}
