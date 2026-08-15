/**
 * Server-only Significant Interaction user confirmation / dismissal.
 *
 * PRODUCT RULE:
 *   User confirmation is mandatory. No significant_interaction may become
 *   'confirmed' without explicit user action. The classifier may create a
 *   'candidate' row; it may NOT confirm it. This server fn is the ONLY path
 *   that sets status='confirmed' or status='dismissed', and only on explicit
 *   user action (browser button click).
 *
 * IDENTITY:
 *   Derives userId from getCurrentUser(accessToken); never trusts a browser
 *   userId. The candidate must be owned by the current user (owner-scoped
 *   update + RLS). Cross-user confirmation is a safe no-op (returns not-ok).
 *
 * NON-GOAL (this phase):
 *   A 'confirmed' candidate STOPS here. Promotion to a durable Companion
 *   Memory is a later phase. No companion_memories table is touched.
 */
import { createServerFn } from "@tanstack/react-start";

import type { SignificantInteraction, SignificantInteractionStatus } from "@/lib/memory/types";
import {
  confirmSignificantInteraction,
  dismissSignificantInteraction,
  loadSignificantInteraction,
} from "@/lib/supabase/significant-remote";
import { getCurrentUser } from "@/lib/supabase/server-auth";

export type ConfirmSignificantInteractionRequest = {
  /** The browser's Supabase access token (credential). Server verifies it. */
  accessToken: string;
  /** The candidate id to confirm or dismiss. */
  candidateId: string;
};

export type ConfirmSignificantInteractionResponse = {
  /** The updated interaction, or null if not found / not owned. */
  interaction: SerializableSignificantInteraction | null;
  /** The resulting status, or null on failure. */
  status: SignificantInteractionStatus | null;
  ok: boolean;
};

type SerializableSignificantInteraction = Omit<SignificantInteraction, "reason" | "confidence"> & {
  reason: string | null;
  confidence: number | null;
};

function toSerializable(
  interaction: SignificantInteraction | null,
): SerializableSignificantInteraction | null {
  if (!interaction) return null;
  return { ...interaction };
}

/**
 * Pure confirmation/dismissal logic, separated from the server fn wrapper so
 * it can be unit-tested. Never throws.
 *
 * Verifies the candidate is owned by the current authenticated user and is
 * currently a 'candidate' (you cannot confirm/dismiss an already-confirmed or
 * already-dismissed row — idempotent safety, no state regressions).
 */
async function setCandidateStatusLogic(
  input: ConfirmSignificantInteractionRequest,
  target: "confirmed" | "dismissed",
  getCurrentUserImpl: typeof getCurrentUser = getCurrentUser,
): Promise<SerializableSignificantInteraction | null> {
  const current = await getCurrentUserImpl(input.accessToken);
  if (!current) return null;
  const userId = current.id;

  // Load (ownership-verified) and ensure it is still a candidate.
  const existing = await loadSignificantInteraction(userId, input.candidateId);
  if (!existing || existing.status !== "candidate") return null;

  const updated =
    target === "confirmed"
      ? await confirmSignificantInteraction(userId, input.candidateId)
      : await dismissSignificantInteraction(userId, input.candidateId);
  return toSerializable(updated);
}

/** "Remember this" — explicit user confirmation. */
export const confirmSignificantInteractionFn = createServerFn({ method: "POST" })
  .validator(
    (input: ConfirmSignificantInteractionRequest): ConfirmSignificantInteractionRequest => input,
  )
  .handler(async ({ data }) => {
    const interaction = await setCandidateStatusLogic(data, "confirmed");
    return {
      interaction,
      status: interaction?.status ?? null,
      ok: interaction !== null,
    } satisfies ConfirmSignificantInteractionResponse;
  });

/** "Not now" — explicit user dismissal. */
export const dismissSignificantInteractionFn = createServerFn({ method: "POST" })
  .validator(
    (input: ConfirmSignificantInteractionRequest): ConfirmSignificantInteractionRequest => input,
  )
  .handler(async ({ data }) => {
    const interaction = await setCandidateStatusLogic(data, "dismissed");
    return {
      interaction,
      status: interaction?.status ?? null,
      ok: interaction !== null,
    } satisfies ConfirmSignificantInteractionResponse;
  });

// Exported for tests.
export { setCandidateStatusLogic };
