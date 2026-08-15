/**
 * Server-only Companion Conversation — bridges the Companion UI to the
 * TypeScript Orchestra with a persistent conversation.
 *
 * IDENTITY HARDENING:
 *   The authoritative user identity is derived from the CURRENT authenticated
 *   Supabase session, NOT from a browser-supplied userId. The browser presents
 *   its access token (a credential, not an identity claim); the server verifies
 *   it via `getCurrentUser(accessToken)` (Supabase `auth.getUser(token)`) and
 *   derives `user.id` from the verified result. A forged/expired token yields
 *   null and the operation is rejected before any database access. Anonymous
 *   users remain valid.
 *
 * Flow:
 *   current request (accessToken + conversationId + message)
 *     ↓ verify access token → derive userId (server-authoritative)
 *     ↓ verify conversation ownership (owned by derived userId)
 *     ↓ persist user turn (BEFORE the LLM call)
 *     ↓ load recent conversation turns
 *     ↓ build grounded prompt (recent turns + explicitly-relevant context only)
 *     ↓ call Orchestra (orchestrator role)
 *     ↓ persist assistant turn (ONLY on success)
 *     ↓ return assistant response
 *
 * SECURITY:
 *   - TanStack Start server function (`createServerFn`); server-side only.
 *   - Browser input may identify: conversationId, message text, accessToken
 *     (credential), existingUserTurnId (retry anchor). Browser input must NOT
 *     determine: userId, ownership, or another user's access scope.
 *   - Provider keys are read inside orchestra.ts from server-only env vars
 *     (never `VITE_`-prefixed). No key is returned or logged here.
 *   - The browser NEVER calls the provider directly; it only calls this server
 *     function.
 *
 * FAILURE HANDLING:
 *   - If the LLM call fails, the user turn MAY remain saved (it is a real
 *     historical message); the assistant turn is NOT fabricated. The function
 *     returns a safe failure state and the user can retry. Retry does NOT
 *     duplicate the user turn because the retry path re-uses the existing
 *     user turn (existingUserTurnId).
 *
 * ROLE: `orchestrator` ("Decompose the task, assign sub-tasks to roles, and
 * synthesize results.") is used because this is an actual Companion
 * conversation where the model must process current conversation context and
 * decide what relevant supplied context matters. No role mapping is modified.
 *
 * NON-GOALS (this phase):
 *   - No companion_memories table, no significance classifier, no automatic
 *     memory extraction. The response is normal conversation text only. No
 *     memoryCandidate / significance / saveMemory / rememberThis fields.
 */
import { createServerFn } from "@tanstack/react-start";

import { runRole, listRoles } from "@/lib/llm/orchestra";
import { inferProviderFromModel, latencyBucketMs } from "@/lib/telemetry";
import { recordAiUsage } from "@/lib/aiUsage";
import type { CompanionContextSlice } from "@/lib/llm/companionConversation";
import { classifySignificantInteractionLogic } from "@/lib/llm/classifySignificantInteraction.server";
import type { SerializableSignificantInteraction } from "@/lib/llm/classifySignificantInteraction.server";
import { orchestrate } from "@/lib/llm/companionOrchestrator";
import { planCapability } from "@/lib/llm/companionCapabilities";
import {
  retrieveCompanionContextForIntentLogic,
  type RetrieveCompanionContextForIntentRequest,
} from "@/lib/llm/retrieveCompanionContext.server";
import type { CompanionContextItem } from "@/lib/memory/companionRetrieval";
import type { Memory } from "@/lib/memory/types";
import type { CompanionTurn, SignificantInteraction } from "@/lib/memory/types";
import {
  createTurn,
  listTurns,
  loadConversation,
  loadRecentTurns,
} from "@/lib/supabase/companion-remote";
import { getCurrentUser } from "@/lib/supabase/server-auth";

export type CompanionConversationRequest = {
  /**
   * The browser's Supabase access token (a credential). The server verifies
   * this against Supabase Auth and derives the authoritative user.id. This is
   * NOT a userId — the browser cannot assert ownership via this field.
   */
  accessToken: string;
  conversationId: string;
  message: string;
  /**
   * Optional explicitly-relevant domain context slices, supplied by the caller
   * ONLY when the current message clearly references a specific record (e.g. a
   * memory). The server does NOT fetch the whole database; it trusts only
   * these small, caller-assembled, ownership-verified slices.
   */
  contextSlices?: CompanionContextSlice[];
  /**
   * If provided, this is the id of an already-saved user turn to continue
   * from (retry path). When absent, a new user turn is persisted.
   */
  existingUserTurnId?: string;
};

export type CompanionConversationResponse = {
  /** The persisted user turn (newly created or the existing one on retry). */
  userTurn: SerializableTurn | null;
  /** The persisted assistant turn, or null if the LLM call failed. */
  assistantTurn: SerializableTurn | null;
  /**
   * A significant-interaction candidate surfaced from this user turn, or null.
   * The candidate is status='candidate' — NOT confirmed. The UI offers
   * "Remember this" / "Not now"; only explicit user action confirms it.
   */
  candidate: SerializableSignificantInteraction | null;
  /** False when the LLM failed; the UI may offer retry. */
  ok: boolean;
};

/** Internal logic result (uses the live CompanionTurn type). */
type LogicResult = {
  userTurn: CompanionTurn | null;
  assistantTurn: CompanionTurn | null;
  candidate: SignificantInteraction | null;
  ok: boolean;
  /**
   * Content-free observability for development/test instrumentation. NEVER
   * reaches the browser: `toResponse` does not serialize it. Contains no user
   * content — only categorical signals (intent, capability, retrieval domains,
   * provider call count, significance gate result). Useful for the Golden
   * Conversation Test Suite's structural assertions.
   */
  telemetry?: CompanionTelemetry;
};

/**
 * Lightweight, content-free telemetry produced by the conversation logic.
 * Contains NO conversation text, NO memory content, NO PII — only categorical
 * signals about what the orchestration did this turn.
 */
export type CompanionTelemetry = {
  /** Deterministic intent the message was classified as. */
  intent: string;
  /** Existing capability dispatched. */
  capability: string;
  /** Retrieval domains actually loaded (per the policy plan). */
  retrievalDomains: string[];
  /** Number of retrieved context items after budget caps. */
  retrievalCount: number;
  /** Trust levels present in the retrieved context (deduped). */
  trustLevels: string[];
  /** Number of Orchestra (LLM) calls made this turn (≤1 unless a capability
   *  explicitly requires otherwise; v1 always 1 or 0). */
  providerCalls: number;
  /** Result of the cheap deterministic significance gate. */
  significanceGate: "ran" | "skipped" | "failed";
  /**
   * Provider-neutral AI usage signal for this turn's LLM call (or null when no
   * call was made). Content-free: capability, provider, model, success,
   * fallback, latency bucket. No prompt/response text, no tokens (the Orchestra
   * bridge does not expose usage in v1). Recorded via the telemetry sink.
   */
  aiUsage?: AiUsageSummary | null;
};

/** Content-free AI usage summary attached to Companion telemetry. */
export type AiUsageSummary = {
  capability: string;
  provider: string;
  model: string | null;
  success: boolean;
  fallback: boolean;
  latencyBucket: string;
};

function toResponse(r: LogicResult): CompanionConversationResponse {
  return {
    userTurn: toSerializableTurn(r.userTurn),
    assistantTurn: toSerializableTurn(r.assistantTurn),
    candidate: r.candidate ? { ...r.candidate } : null,
    ok: r.ok,
  };
}

/**
 * A serialization-safe turn shape for the server-fn boundary. The live
 * `CompanionTurn.metadata` is `Record<string, unknown>`, which TanStack
 * Start's serializer cannot prove is serializable. We narrow to a JSON object
 * (string-keyed values) for transport; the UI reads the same fields.
 */
type SerializableTurn = Omit<CompanionTurn, "metadata"> & {
  metadata: Record<string, string | number | boolean | null> | null;
};

function toSerializableTurn(turn: CompanionTurn | null): SerializableTurn | null {
  if (!turn) return null;
  const raw = turn.metadata;
  let safe: Record<string, string | number | boolean | null> | null = null;
  if (raw) {
    safe = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        safe[k] = v;
      } else if (v === null) {
        safe[k] = null;
      } else {
        safe[k] = JSON.stringify(v);
      }
    }
  }
  return { ...turn, metadata: safe };
}

/**
 * Pure conversation logic, separated from the `createServerFn` wrapper so it
 * can be unit-tested without the TanStack Start runtime context. The server fn
 * below is a thin shell that delegates here.
 *
 * Never throws. On any failure returns `{ userTurn, assistantTurn: null, ok: false }`.
 *
 * @param getCurrentUserImpl injectable identity resolver (defaults to
 *   `getCurrentUser`) so tests can mock the authenticated server context.
 */
export async function companionConversationLogic(
  input: CompanionConversationRequest,
  runRoleImpl: typeof runRole = runRole,
  getCurrentUserImpl: typeof getCurrentUser = getCurrentUser,
): Promise<LogicResult> {
  // 0. Derive the authoritative user identity from the verified access token.
  //    The browser's userId is NEVER trusted; only the server-verified id is
  //    used for ownership.
  const current = await getCurrentUserImpl(input.accessToken);
  if (!current) {
    return { userTurn: null, assistantTurn: null, candidate: null, ok: false };
  }
  const userId = current.id;
  const { conversationId, message } = input;

  // 1. Verify conversation ownership (owned by the derived userId).
  const conversation = await loadConversation(userId, conversationId);
  if (!conversation) {
    return { userTurn: null, assistantTurn: null, candidate: null, ok: false };
  }

  // 2. Persist user turn BEFORE the LLM call. On retry, reuse the existing
  //    user turn so we do not duplicate it.
  let userTurn: CompanionTurn | null = null;
  if (input.existingUserTurnId) {
    const all = await listTurns(userId, conversationId);
    userTurn = all.find((t) => t.id === input.existingUserTurnId) ?? null;
  } else {
    userTurn = await createTurn(userId, conversationId, "user", message);
  }
  if (!userTurn) {
    return { userTurn: null, assistantTurn: null, candidate: null, ok: false };
  }

  // 3. Load recent conversation turns (context boundary: NOT the whole DB).
  const recent = await loadRecentTurns(userId, conversationId);

  // 4. DETERMINISTIC orchestration policy — classify WHAT kind of request this
  //    is and WHICH existing capability should handle it. This is pure (no LLM,
  //    no network, no Supabase) — it does NOT add an extra LLM call to classify
  //    intent. The current user message is always the highest-priority
  //    instruction for this turn (it overrides stored Companion Memories for
  //    this turn only; the stored memory is never modified here).
  const policy = orchestrate(message);

  // Telemetry: categorical, content-free signals. Built incrementally and
  // returned on the LogicResult; never serialized to the browser.
  const retrievalDomains = Object.entries(policy.retrievalPlan)
    .filter(([, v]) => v === true)
    .map(([k]) => k);

  // 5. Intent-scoped retrieval. Load ONLY the domains the policy requested
  //    (bounded, owner-scoped), run the pure planner, then apply the per-intent
  //    budget caps. An ordinary chat loads conversation turns only (cost win);
  //    a chapter request never loads Media binaries. Retrieval failure is
  //    contained — we fall back to recent turns only and NEVER fabricate
  //    context.
  let retrievedContext: CompanionContextItem[] = [];
  let retrievalOk = true;
  try {
    const retrievalReq: RetrieveCompanionContextForIntentRequest = {
      accessToken: input.accessToken,
      conversationId,
      message,
      plan: policy.retrievalPlan,
      budgets: policy.budgets,
    };
    const retrieval = await retrieveCompanionContextForIntentLogic(
      retrievalReq,
      getCurrentUserImpl,
    );
    if (retrieval.ok) retrievedContext = retrieval.items;
    else retrievalOk = false;
  } catch {
    retrievalOk = false;
    retrievedContext = [];
  }

  // For the reflection capability, identify a single memory from the retrieved
  // context so the existing reflection prompt builder can be reused. Otherwise
  // the capability falls back to grounded chat.
  let identifiedMemory: Memory | null = null;
  if (policy.intent === "reflection" && retrievedContext.length > 0) {
    const memItem = retrievedContext.find((i) => i.sourceType === "memory");
    if (memItem) {
      // The retrieved context is a slice; the existing reflection builder
      // accepts a Memory-shaped object. We reconstruct a minimal Memory from
      // the retrieved slice (content is the rendered user note + song).
      identifiedMemory = {
        id: memItem.sourceId,
        userId,
        recordedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        originalUserNote: memItem.content,
        userNote: memItem.content,
        feeling: null,
        lifeEvent: null,
        location: null,
        weather: null,
        eventTime: { granularity: undefined, start: null, end: null, label: null },
        aiContext: null,
        aiContextStaleAt: null,
        musicExperiences: [],
      };
    }
  }

  // 6. Capability dispatch — turn the policy into a single runRole call +
  //    prompt. Exactly ONE LLM call per turn; no capability calls multiple
  //    roles. Provider/model selection stays inside the Orchestra bridge.
  const capabilityPlan = planCapability(policy.intent, {
    message,
    recentTurns: recent,
    retrievedContext,
    identifiedMemory,
    contextSlices: input.contextSlices,
  });

  // 7. Call Orchestra (the capability's single role + prompt). Timed so a
  //    content-free AI usage summary can be recorded (telemetry hook only;
  //    behaviour is unchanged — success/failure paths are identical).
  let response: string | null = null;
  const roleModels = listRoles();
  const model = roleModels[capabilityPlan.role] ?? null;
  const provider = inferProviderFromModel(model);
  const callStart = Date.now();
  try {
    response = await runRoleImpl(capabilityPlan.role, capabilityPlan.prompt, {
      temperature: capabilityPlan.temperature,
      maxTokens: capabilityPlan.maxTokens,
    });
  } catch {
    response = null;
  }
  const callMs = Date.now() - callStart;
  const providerCalls = response ? 1 : 0;
  const aiUsage: AiUsageSummary = {
    capability: policy.capability,
    provider,
    model,
    success: !!response,
    fallback: !response,
    latencyBucket: latencyBucketMs(callMs),
  };
  // Record the content-free AI usage event via the cost-governor/telemetry
  // sink. Never throws; never records prompts/responses.
  recordAiUsage({
    event: "ai_call",
    capability: policy.capability,
    provider,
    model: model ?? undefined,
    success: !!response,
    fallback: !response,
    latencyBucket: aiUsage.latencyBucket,
  });
  if (!response) {
    // LLM failed: user turn remains saved; assistant turn NOT fabricated.
    return {
      userTurn,
      assistantTurn: null,
      candidate: null,
      ok: false,
      telemetry: {
        intent: policy.intent,
        capability: policy.capability,
        retrievalDomains,
        retrievalCount: retrievedContext.length,
        trustLevels: dedupTrust(retrievedContext),
        providerCalls: 0,
        significanceGate: retrievalOk ? "skipped" : "failed",
        aiUsage,
      },
    };
  }

  // 7. Persist assistant turn (ONLY on success).
  const assistantTurn = await createTurn(userId, conversationId, "assistant", response, {
    model: "orchestrator",
  });
  if (!assistantTurn) {
    return {
      userTurn,
      assistantTurn: null,
      candidate: null,
      ok: false,
      telemetry: {
        intent: policy.intent,
        capability: policy.capability,
        retrievalDomains,
        retrievalCount: retrievedContext.length,
        trustLevels: dedupTrust(retrievedContext),
        providerCalls,
        significanceGate: retrievalOk ? "skipped" : "failed",
        aiUsage,
      },
    };
  }

  // 8. Significant-interaction candidate analysis. This runs AFTER the
  //    assistant turn so the conversation flow is never blocked. The classifier
  //    runs the cheap deterministic gate server-side FIRST (cost control); the
  //    Orchestra is called only if the gate says shouldAnalyze. Any failure is
  //    contained — the conversation remains intact and a null candidate is a
  //    safe no-op. The candidate (if any) is status='candidate' and is NEVER
  //    confirmed here; the user confirms/dismisses via a separate fn.
  let candidate: SignificantInteraction | null = null;
  let significanceGate: "ran" | "skipped" | "failed" = "ran";
  try {
    const cls = await classifySignificantInteractionLogic(
      { accessToken: input.accessToken, conversationId, turnId: userTurn.id },
      runRoleImpl,
      getCurrentUserImpl,
    );
    candidate = cls.candidate;
  } catch {
    significanceGate = "failed";
    candidate = null;
  }

  return {
    userTurn,
    assistantTurn,
    candidate,
    ok: true,
    telemetry: {
      intent: policy.intent,
      capability: policy.capability,
      retrievalDomains,
      retrievalCount: retrievedContext.length,
      trustLevels: dedupTrust(retrievedContext),
      providerCalls,
      significanceGate,
      aiUsage,
    },
  };
}

/** Dedupe trust levels present in the retrieved context, preserving order. */
function dedupTrust(items: CompanionContextItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    if (!seen.has(it.trustLevel)) {
      seen.add(it.trustLevel);
      out.push(it.trustLevel);
    }
  }
  return out;
}

/**
 * Server function — the browser-facing entry point. Server-side only; the
 * framework routes the client call to here. The browser never calls
 * orchestra.runRole directly.
 */
export const companionConversation = createServerFn({ method: "POST" })
  .validator((input: CompanionConversationRequest): CompanionConversationRequest => input)
  .handler(async ({ data }) => {
    const result = await companionConversationLogic(data);
    return toResponse(result);
  });
