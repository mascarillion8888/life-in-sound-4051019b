/**
 * Server-only Significant Interaction classification — bridges the candidate
 * gate to the TypeScript Orchestra, then persists a CANDIDATE row.
 *
 * COST GATE:
 *   The deterministic gate runs FIRST (cheap, pure). Only when it says
 *   shouldAnalyze=true does this server fn call the Orchestra. The gate runs
 *   again server-side (defense-in-depth) so a browser cannot force an LLM call
 *   by bypassing the client gate.
 *
 * IDENTITY:
 *   The authoritative user identity is derived from the CURRENT authenticated
 *   Supabase session (getCurrentUser(accessToken)), NOT from a browser-supplied
 *   userId. The server then verifies:
 *     - conversation belongs to current user
 *     - turn belongs to current user
 *     - turn belongs to that conversation
 *     - supplied turn is a USER turn (role == 'user')
 *   Only then can classification occur. Assistant turns are NEVER classified.
 *
 * CONFIRMATION:
 *   The classifier creates a 'candidate' row ONLY. It may NOT confirm it.
 *   Confirmation requires explicit user action (confirmSignificantInteraction).
 *
 * FAILURE BEHAVIOR:
 *   - gate false → no LLM call, no candidate row.
 *   - gate true but Orchestra fails → conversation continues normally; no
 *     candidate row required.
 *   - classifier returns malformed output → ignore candidate safely; no row.
 *   - candidate persistence fails → conversation remains intact; no fabrication.
 *   - duplicate active candidate for the turn → returns the existing candidate
 *     (no duplication, no second LLM call persisting a dup).
 *
 * SECURITY:
 *   - TanStack Start server function; server-side only.
 *   - Provider keys read inside orchestra.ts from server-only env vars.
 *   - The browser NEVER calls orchestra.runRole directly; it calls this fn.
 *   - No key is returned or logged.
 *
 * ROLE: `orchestrator` ("Decompose the task, assign sub-tasks to roles, and
 * synthesize results.") — the task is determining whether a user turn contains
 * a durable, user-expressed preference/boundary/directive/confirmed_context/
 * decision and structuring the candidate. No role mapping is modified.
 *
 * NON-GOALS (this phase):
 *   - No companion_memories table, no promotion to durable memory.
 *   - No automatic confirmation.
 */
import { createServerFn } from "@tanstack/react-start";

import { runRole } from "@/lib/llm/orchestra";
import {
  buildSignificancePrompt,
  parseSignificanceResponse,
  type SignificanceClassification,
} from "@/lib/llm/significantInteraction";
import { evaluateSignificanceGate } from "@/lib/memory/significanceGate";
import type { CompanionTurn, SignificantInteraction } from "@/lib/memory/types";
import { loadConversation, loadTurn } from "@/lib/supabase/companion-remote";
import { createCandidate, listCandidatesForTurn } from "@/lib/supabase/significant-remote";
import { getCurrentUser } from "@/lib/supabase/server-auth";

export type ClassifySignificantInteractionRequest = {
  /** The browser's Supabase access token (credential). Server verifies it. */
  accessToken: string;
  conversationId: string;
  turnId: string;
};

export type SerializableSignificantInteraction = Omit<
  SignificantInteraction,
  "reason" | "confidence"
> & {
  reason: string | null;
  confidence: number | null;
};

export type ClassifySignificantInteractionResponse = {
  /** The candidate created (or the existing active one), or null. */
  candidate: SerializableSignificantInteraction | null;
  /** Whether the deterministic gate triggered analysis. */
  gateTriggered: boolean;
  /** Whether the Orchestra was called. */
  llmCalled: boolean;
  ok: boolean;
};

type LogicResult = {
  candidate: SignificantInteraction | null;
  gateTriggered: boolean;
  llmCalled: boolean;
  ok: boolean;
};

/**
 * Pure classification logic, separated from the `createServerFn` wrapper so it
 * can be unit-tested without the TanStack Start runtime context. Never throws.
 *
 * @param runRoleImpl injectable Orchestra call (defaults to runRole).
 * @param getCurrentUserImpl injectable identity resolver (defaults to getCurrentUser).
 */
export async function classifySignificantInteractionLogic(
  input: ClassifySignificantInteractionRequest,
  runRoleImpl: typeof runRole = runRole,
  getCurrentUserImpl: typeof getCurrentUser = getCurrentUser,
): Promise<LogicResult> {
  // 0. Derive the authoritative user identity from the verified access token.
  const current = await getCurrentUserImpl(input.accessToken);
  if (!current) return { candidate: null, gateTriggered: false, llmCalled: false, ok: false };
  const userId = current.id;

  // 1. Verify conversation ownership.
  const conversation = await loadConversation(userId, input.conversationId);
  if (!conversation) return { candidate: null, gateTriggered: false, llmCalled: false, ok: false };

  // 2. Verify turn ownership + that the turn belongs to this conversation.
  const turn = await loadTurn(userId, input.turnId);
  if (!turn || turn.conversationId !== input.conversationId) {
    return { candidate: null, gateTriggered: false, llmCalled: false, ok: false };
  }

  // 3. Only USER turns may be classified. Assistant/system turns never.
  if (turn.role !== "user") {
    return { candidate: null, gateTriggered: false, llmCalled: false, ok: false };
  }

  // 4. Duplicate check: if an active candidate already exists for this turn,
  //    return it without spending an LLM call (no duplication).
  const existing = await listCandidatesForTurn(userId, input.turnId);
  if (existing.length > 0) {
    return { candidate: existing[0], gateTriggered: true, llmCalled: false, ok: true };
  }

  // 5. Cheap deterministic gate (runs server-side, defense-in-depth).
  const gate = evaluateSignificanceGate(turn);
  if (!gate.shouldAnalyze) {
    return { candidate: null, gateTriggered: false, llmCalled: false, ok: true };
  }

  // 6. Build grounded prompt + call Orchestra.
  const prompt = buildSignificancePrompt({
    userTurn: turn,
    signals: gate.signals,
  });

  let response: string | null = null;
  try {
    response = await runRoleImpl("orchestrator", prompt, {
      temperature: 0.2,
      maxTokens: 256,
    });
  } catch {
    response = null;
  }
  // LLM failed → conversation continues normally; no candidate required.
  if (!response) {
    return { candidate: null, gateTriggered: true, llmCalled: true, ok: true };
  }

  // 7. Parse + validate the classifier output.
  const classification: SignificanceClassification | null = parseSignificanceResponse(
    response,
    turn,
  );
  if (!classification || !classification.significant) {
    // Malformed or not significant → ignore candidate safely; no row.
    return { candidate: null, gateTriggered: true, llmCalled: true, ok: true };
  }

  // 8. Persist a 'candidate' row (NEVER confirmed by the classifier).
  const candidate = await createCandidate({
    userId,
    conversationId: input.conversationId,
    turnId: input.turnId,
    kind: classification.kind!,
    candidateContent: classification.candidateContent!,
    reason: classification.reason,
    source: "ai_classified",
    confidence: classification.confidence,
  });
  if (!candidate) {
    // Persistence failed → conversation remains intact; no fabrication.
    return { candidate: null, gateTriggered: true, llmCalled: true, ok: true };
  }

  return { candidate, gateTriggered: true, llmCalled: true, ok: true };
}

function toSerializable(
  interaction: SignificantInteraction | null,
): SerializableSignificantInteraction | null {
  if (!interaction) return null;
  return { ...interaction };
}

/**
 * Server function — the browser-facing entry point. Server-side only.
 */
export const classifySignificantInteraction = createServerFn({ method: "POST" })
  .validator(
    (input: ClassifySignificantInteractionRequest): ClassifySignificantInteractionRequest => input,
  )
  .handler(async ({ data }) => {
    const result = await classifySignificantInteractionLogic(data);
    return {
      candidate: toSerializable(result.candidate),
      gateTriggered: result.gateTriggered,
      llmCalled: result.llmCalled,
      ok: result.ok,
    } satisfies ClassifySignificantInteractionResponse;
  });

// Re-export the gate for route-level use + the duplicate/active lookup.
export { evaluateSignificanceGate };
export { listCandidatesForTurn };
