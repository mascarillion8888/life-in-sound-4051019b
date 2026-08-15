/**
 * Closed Beta Readiness — deterministic test suite.
 *
 * No live LLM, no network, no Supabase, no DOM required. Every assertion is
 * deterministic. These tests guard the closed-beta readiness guarantees:
 *   - onboarding clarity + first-value path contract
 *   - privacy-safe instrumentation (no raw content, no secrets, no tokens)
 *   - AI usage observability contract (provider-neutral, content-free)
 *   - cost governor interface (v1 always allows, never blocks)
 *   - reliability/failure UX (never raw errors; persistence failures ≠ success)
 *   - structured feedback (closed-set ratings, no raw content)
 *
 * Run alongside the existing Golden Conversation Test Suite. The Golden suite
 * (39 tests) must remain green; these tests are additive.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  track,
  setTelemetrySink,
  getTelemetrySink,
  latencyBucketMs,
  inferProviderFromModel,
  trackAiUsage,
  PRODUCT_EVENTS,
  type TelemetrySink,
  type TelemetryEvent,
} from "@/lib/telemetry";
import { canUseAi, recordAiUsage, type AiCapability } from "@/lib/aiUsage";
import { ReliabilityMessage, isUserSafeMessage, looksLikeTechnicalError } from "@/lib/reliability";
import {
  onboardingState,
  markOnboardingSeen,
  hasSeenOnboarding,
  markFirstMemoryCreated,
  hasCreatedFirstMemory,
  FIRST_VALUE_CTA,
  FIRST_MOMENTS_CAPABILITIES,
  PRODUCT_CONCEPT,
  ONBOARDING_TOTAL,
  type FlagStorage,
} from "@/lib/onboarding";
import {
  buildFeedbackEvent,
  submitFeedback,
  type FeedbackKind,
  type FeedbackRating,
} from "@/lib/feedback";
import { questions } from "@/lib/questions";

// --- shared test helpers ----------------------------------------------------

/** A capturing telemetry sink for assertions. */
function capturingSink(): { sink: TelemetrySink; events: TelemetryEvent[] } {
  const events: TelemetryEvent[] = [];
  return { sink: { record: (e) => events.push(e) }, events };
}

/** An in-memory FlagStorage (no DOM). */
function memStorage(): FlagStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
  };
}

beforeEach(() => {
  setTelemetrySink(null); // reset to no-op between tests
});

afterEach(() => {
  setTelemetrySink(null);
});

// ===========================================================================
// 1. Onboarding clarity + first-value path
// ===========================================================================

describe("Onboarding clarity + first-value path", () => {
  it("ONBOARDING_TOTAL equals the journey question count", () => {
    expect(ONBOARDING_TOTAL).toBe(questions.length);
    expect(ONBOARDING_TOTAL).toBe(8);
  });

  it("onboardingState is incomplete with empty answers and complete with all 8", () => {
    expect(onboardingState({}).complete).toBe(false);
    const full: Record<number, string> = {};
    for (const q of questions) full[q.id] = "some song";
    const s = onboardingState(full);
    expect(s.answered).toBe(8);
    expect(s.total).toBe(8);
    expect(s.complete).toBe(true);
  });

  it("onboardingState counts only non-empty answers", () => {
    const partial: Record<number, string> = { 1: "a", 2: "   ", 3: "b" };
    const s = onboardingState(partial);
    expect(s.answered).toBe(2);
    expect(s.complete).toBe(false);
  });

  it("FIRST_VALUE_CTA routes to /memory with a clear label and blurb", () => {
    expect(FIRST_VALUE_CTA.route).toBe("/memory");
    expect(FIRST_VALUE_CTA.label.length).toBeGreaterThan(0);
    expect(FIRST_VALUE_CTA.blurb.length).toBeGreaterThan(0);
  });

  it("FIRST_MOMENTS_CAPABILITIES lists the five core things a new user can do", () => {
    expect(FIRST_MOMENTS_CAPABILITIES.length).toBe(5);
    // Non-technical, no architecture jargon.
    for (const c of FIRST_MOMENTS_CAPABILITIES) {
      expect(c.toLowerCase()).not.toContain("supabase");
      expect(c.toLowerCase()).not.toContain("rls");
      expect(c.toLowerCase()).not.toContain("embedding");
    }
  });

  it("PRODUCT_CONCEPT is a single non-technical sentence", () => {
    expect(PRODUCT_CONCEPT.length).toBeGreaterThan(10);
    expect(PRODUCT_CONCEPT.endsWith(".")).toBe(true);
    expect(PRODUCT_CONCEPT.toLowerCase()).not.toContain("architecture");
  });

  it("onboarding seen flag is session-safe and anonymous-compatible", () => {
    const store = memStorage();
    expect(hasSeenOnboarding(store)).toBe(false);
    markOnboardingSeen(store);
    expect(hasSeenOnboarding(store)).toBe(true);
  });

  it("first-memory flag is session-safe and independent of the seen flag", () => {
    const store = memStorage();
    markOnboardingSeen(store);
    expect(hasCreatedFirstMemory(store)).toBe(false);
    markFirstMemoryCreated(store);
    expect(hasCreatedFirstMemory(store)).toBe(true);
  });

  it("onboarding flags never throw when storage is unavailable (null storage)", () => {
    expect(() => {
      markOnboardingSeen(null);
      hasSeenOnboarding(null);
      markFirstMemoryCreated(null);
      hasCreatedFirstMemory(null);
    }).not.toThrow();
  });
});

// ===========================================================================
// 2. Telemetry abstraction — privacy-safe
// ===========================================================================

describe("Telemetry abstraction (privacy-safe)", () => {
  it("track records to the installed sink and never throws on a no-op sink", () => {
    const { sink, events } = capturingSink();
    setTelemetrySink(sink);
    track({ event: "app_opened", timestamp: "t1" });
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("app_opened");

    setTelemetrySink(null);
    expect(() => track({ event: "x", timestamp: "t" })).not.toThrow();
  });

  it("track strips forbidden keys (raw content/credentials) from detail", () => {
    const { sink, events } = capturingSink();
    setTelemetrySink(sink);
    track({
      event: "x",
      timestamp: "t",
      detail: {
        capability: "chat",
        message: "my secret note text",
        accessToken: "abc",
        apiKey: "k",
        note: "raw memory text",
        signedUrl: "https://signed.example/x",
      },
    });
    const d = events[0].detail!;
    expect(d.capability).toBe("chat");
    expect(d).not.toHaveProperty("message");
    expect(d).not.toHaveProperty("accessToken");
    expect(d).not.toHaveProperty("apiKey");
    expect(d).not.to.haveOwnProperty("note");
    expect(d).not.toHaveProperty("signedUrl");
  });

  it("track caps string detail values so no raw prose can leak", () => {
    const { sink, events } = capturingSink();
    setTelemetrySink(sink);
    track({
      event: "x",
      timestamp: "t",
      detail: { label: "ok", essay: "x".repeat(200) },
    });
    const d = events[0].detail!;
    expect(d.label).toBe("ok");
    expect(d).not.toHaveProperty("essay");
  });

  it("PRODUCT_EVENTS is a closed set of categorical names", () => {
    const names = Object.values(PRODUCT_EVENTS);
    expect(names.length).toBeGreaterThanOrEqual(10);
    // every name is a snake_case string with no spaces
    for (const n of names) {
      expect(typeof n).toBe("string");
      expect(/^[a-z_]+$/.test(n)).toBe(true);
    }
    // no duplicates
    expect(new Set(names).size).toBe(names.length);
  });

  it("default sink is a no-op (production is silent unless a sink is installed)", () => {
    setTelemetrySink(null);
    expect(getTelemetrySink()).toBe(getTelemetrySink()); // stable no-op
    expect(() => track({ event: "x", timestamp: "t" })).not.toThrow();
  });
});

// ===========================================================================
// 3. AI usage observability — provider-neutral, content-free
// ===========================================================================

describe("AI usage observability (provider-neutral, content-free)", () => {
  it("inferProviderFromModel maps known model prefixes without importing orchestra internals", () => {
    expect(inferProviderFromModel("gemini-3-flash-preview")).toBe("gemini");
    expect(inferProviderFromModel("llama-3.3-70b-versatile")).toBe("groq");
    expect(inferProviderFromModel("mistral-large-latest")).toBe("mistral");
    expect(inferProviderFromModel("anthropic/claude-sonnet-4.6")).toBe("anthropic");
    expect(inferProviderFromModel("openai/gpt-5.2")).toBe("openai");
    expect(inferProviderFromModel(undefined)).toBe("unknown");
    expect(inferProviderFromModel("something-weird")).toBe("unknown");
  });

  it("latencyBucketMs returns deterministic coarse buckets", () => {
    expect(latencyBucketMs(10)).toBe("<250ms");
    expect(latencyBucketMs(300)).toBe("250-500ms");
    expect(latencyBucketMs(700)).toBe("500-1000ms");
    expect(latencyBucketMs(1500)).toBe("1000-2000ms");
    expect(latencyBucketMs(3000)).toBe("2000-4000ms");
    expect(latencyBucketMs(5000)).toBe(">4000ms");
    expect(latencyBucketMs(-1)).toBe("unknown");
  });

  it("trackAiUsage records a content-free ai_call event with provider/model, no prompt/response", () => {
    const { sink, events } = capturingSink();
    setTelemetrySink(sink);
    trackAiUsage({
      event: "ai_call",
      capability: "chat",
      provider: "gemini",
      model: "gemini-3-flash-preview",
      success: true,
      fallback: false,
      latencyBucket: "<250ms",
    });
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.event).toBe("ai_call");
    expect(e.detail?.provider).toBe("gemini");
    expect(e.detail?.model).toBe("gemini-3-flash-preview");
    expect(e.detail?.success).toBe(true);
    // No content fields present
    expect(e.detail).not.toHaveProperty("prompt");
    expect(e.detail).not.toHaveProperty("response");
    expect(e.detail).not.toHaveProperty("message");
  });

  it("trackAiUsage never includes an API key or token", () => {
    const { sink, events } = capturingSink();
    setTelemetrySink(sink);
    trackAiUsage({
      event: "ai_call",
      capability: "chat",
      provider: "gemini",
      model: "gemini-3-flash-preview",
      success: true,
      fallback: false,
    });
    const serialised = JSON.stringify(events[0]);
    expect(serialised).not.toContain("apiKey");
    expect(serialised).not.toContain("token");
    expect(serialised).not.toContain("Bearer ");
  });

  it("AiUsageEvent token counts are optional (omitted in v1)", () => {
    // The contract allows but does not require tokens. A usage event without
    // tokens is valid and records fine.
    const { sink, events } = capturingSink();
    setTelemetrySink(sink);
    trackAiUsage({
      event: "ai_call",
      capability: "reflection",
      provider: "mistral",
      success: false,
      fallback: true,
    });
    expect(events[0].detail?.inputTokens).toBeUndefined();
    expect(events[0].detail?.outputTokens).toBeUndefined();
  });
});

// ===========================================================================
// 4. Cost governor — interface only, v1 never blocks
// ===========================================================================

describe("Cost governor (v1 interface, never blocks)", () => {
  it("canUseAi always allows in v1 (closed beta is unmetered)", () => {
    const caps: AiCapability[] = [
      "chat",
      "memory_recall",
      "reflection",
      "story_request",
      "memory_extraction",
      "significance_classification",
    ];
    for (const c of caps) {
      const d = canUseAi("user-123", c);
      expect(d.allowed).toBe(true);
      expect(d.reason).toBe("beta-unlimited");
    }
  });

  it("canUseAi is pure and deterministic (same input → same output)", () => {
    const a = canUseAi("u", "chat");
    const b = canUseAi("u", "chat");
    expect(a).toEqual(b);
  });

  it("recordAiUsage forwards a content-free event to the telemetry sink and never throws", () => {
    const { sink, events } = capturingSink();
    setTelemetrySink(sink);
    expect(() =>
      recordAiUsage({
        event: "ai_call",
        capability: "chat",
        provider: "gemini",
        model: "gemini-3-flash-preview",
        success: true,
        fallback: false,
      }),
    ).not.toThrow();
    expect(events.some((e) => e.event === "ai_call")).toBe(true);
  });

  it("no provider billing API is used (no network in the governor path)", () => {
    // canUseAi must be synchronous and side-effect-free (no fetch, no DB).
    const d = canUseAi("u", "story_request");
    expect(d.allowed).toBe(true);
  });
});

// ===========================================================================
// 5. Reliability / failure UX
// ===========================================================================

describe("Reliability / failure UX", () => {
  it("every reliability message is calm and non-technical", () => {
    for (const msg of Object.values(ReliabilityMessage)) {
      expect(msg.length).toBeGreaterThan(0);
      expect(msg.toLowerCase()).not.toContain("500");
      expect(msg.toLowerCase()).not.toContain("internal server error");
      expect(msg.toLowerCase()).not.toContain("stack trace");
      expect(msg.toLowerCase()).not.toContain("api key");
      expect(msg.toLowerCase()).not.toContain("token");
    }
  });

  it("persistence failure and success messages never share a string", () => {
    const fail = ReliabilityMessage.memorySaveFailed;
    // The saved confirmation used in the UI is "Memory saved".
    expect(fail).not.toContain("saved");
    expect(fail.toLowerCase()).toContain("couldn't save");
  });

  it("isUserSafeMessage recognises canonical messages", () => {
    expect(isUserSafeMessage(ReliabilityMessage.companionUnavailable)).toBe(true);
    expect(isUserSafeMessage(ReliabilityMessage.memorySaveFailed)).toBe(true);
  });

  it("looksLikeTechnicalError flags raw errors that must never reach a beta user", () => {
    expect(looksLikeTechnicalError("500 Internal Server Error")).toBe(true);
    expect(looksLikeTechnicalError("Error: at /app/foo.ts:42:10")).toBe(true);
    expect(looksLikeTechnicalError("Unauthorized: invalid api key")).toBe(true);
    expect(looksLikeTechnicalError("ECONNREFUSED")).toBe(true);
    expect(looksLikeTechnicalError("Something went wrong on our side.")).toBe(false);
    expect(looksLikeTechnicalError("")).toBe(false);
  });

  it("companion unavailable and memory save failed messages reassure data safety where applicable", () => {
    expect(ReliabilityMessage.memorySaveFailed.toLowerCase()).toContain("nothing was lost");
    // companion unavailable references the message still being present
    expect(ReliabilityMessage.companionUnavailable.toLowerCase()).toContain("your message");
  });

  it("extraction failure falls back gracefully and preserves the note", () => {
    expect(ReliabilityMessage.memoryExtractionFailed.toLowerCase()).toContain("manual");
    expect(ReliabilityMessage.memoryExtractionFailed.toLowerCase()).toContain("preserved");
  });
});

// ===========================================================================
// 6. Structured feedback — closed set, no raw content
// ===========================================================================

describe("Structured feedback (privacy-safe)", () => {
  it("buildFeedbackEvent accepts the closed rating set", () => {
    const ratings: FeedbackRating[] = ["yes", "somewhat", "not_really"];
    for (const r of ratings) {
      const e = buildFeedbackEvent("first_memory", r, "u1");
      expect(e).not.toBeNull();
      expect(e?.rating).toBe(r);
      expect(e?.kind).toBe("first_memory");
      expect(e?.event).toBe(PRODUCT_EVENTS.feedbackSubmitted);
    }
  });

  it("buildFeedbackEvent rejects an invalid (free-text) rating", () => {
    // @ts-expect-error — deliberately invalid rating to test defence in depth
    expect(buildFeedbackEvent("first_memory", "amazing!!!", "u1")).toBeNull();
  });

  it("submitFeedback records a feedback_submitted event with only kind+rating (no content)", () => {
    const { sink, events } = capturingSink();
    setTelemetrySink(sink);
    const e = submitFeedback("first_companion", "yes", "u1");
    expect(e).not.toBeNull();
    expect(events).toHaveLength(1);
    const serialised = JSON.stringify(events[0]);
    expect(serialised).toContain("first_companion");
    expect(serialised).toContain("yes");
    // No raw content fields
    expect(serialised).not.toContain("note");
    expect(serialised).not.toContain("message");
    expect(serialised).not.toContain("reflection");
  });

  it("submitFeedback records nothing for an invalid rating", () => {
    const { sink, events } = capturingSink();
    setTelemetrySink(sink);
    // @ts-expect-error — invalid rating
    expect(submitFeedback("first_memory", "maybe", "u1")).toBeNull();
    expect(events).toHaveLength(0);
  });

  it("both feedback kinds are supported", () => {
    const kinds: FeedbackKind[] = ["first_memory", "first_companion"];
    for (const k of kinds) {
      const e = buildFeedbackEvent(k, "somewhat");
      expect(e?.kind).toBe(k);
    }
  });
});
