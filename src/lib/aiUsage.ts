/**
 * Cost governor preparation (v1).
 *
 * NOT billing. NOT quotas. NOT blocking. This is a small internal interface
 * structured so a FUTURE governor can ask `canUseAi(userId, capability)` and
 * later become: daily call limit, monthly budget, capability-specific budget,
 * or provider fallback. In v1 it ALWAYS allows — the closed beta is
 * unmetered. No user is blocked in this phase.
 *
 * The interface is pure and deterministic so tests can exercise it without a
 * live LLM, network, or database. A future governor can replace
 * `canUseAi` / `recordAiUsage` with policy-backed implementations without
 * changing call sites.
 *
 * No provider-specific billing API is used. No keys. No raw content.
 */
import { trackAiUsage, type AiUsageEvent } from "@/lib/telemetry";

/** A capability the system knows how to route (mirrors CompanionIntent). */
export type AiCapability =
  | "chat"
  | "memory_recall"
  | "companion_memory_recall"
  | "memory_creation"
  | "reflection"
  | "pattern_exploration"
  | "story_request"
  | "event_chapter_recall"
  | "memory_extraction"
  | "significance_classification"
  | "pattern_interpretation"
  | "connection_suggestion"
  | "structure_suggestion"
  | "story_generation";

/** The decision returned by the governor. */
export type UsageDecision = {
  allowed: boolean;
  /** Machine-readable reason (never user content). */
  reason: string;
  /**
   * v1: unlimited. A future governor may set this to a budget label so the UI
   * can hint at remaining usage without exposing exact counts.
   */
  budget?: string;
};

/**
 * Can the user use AI for this capability right now?
 *
 * v1: ALWAYS allowed. The closed beta is unmetered. This exists so future
 * policies (daily/monthly/capability budgets, provider fallback) can be added
 * here without touching call sites.
 */
export function canUseAi(_userId: string, _capability: AiCapability): UsageDecision {
  return { allowed: true, reason: "beta-unlimited", budget: "unlimited" };
}

/**
 * Record an AI usage outcome so a future governor can consult it. v1 forwards
 * the content-free usage event to the telemetry sink; no per-user persistent
 * ledger is kept in this phase.
 *
 * Never throws. Never records prompts/responses.
 */
export function recordAiUsage(usage: AiUsageEvent): void {
  trackAiUsage(usage);
}
