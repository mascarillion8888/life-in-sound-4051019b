/**
 * Server-only Companion Memory promotion — promotes a CONFIRMED Significant
 * Interaction into a durable Companion Memory.
 *
 * PROMOTION RULE (the ONLY creation path in v1):
 *   confirmed Significant Interaction
 *       ↓ promoteSignificantInteraction()
 *   Companion Memory (status='active', source='user_confirmed')
 *
 * The operation is atomic with respect to duplicates: a DB UNIQUE index on
 * significant_interaction_id guarantees a Significant Interaction is promoted
 * at most once. A retry after a partial failure reuses the existing row.
 *
 * OWNERSHIP (server-derived, never browser-supplied):
 *   1. current user — derived from getCurrentUser(accessToken)
 *   2. Significant Interaction belongs to current user
 *   3. Significant Interaction status == 'confirmed'
 *   4. referenced turn belongs to current user
 *   5. referenced turn role == 'user'
 *   6. related Memory/Event/Chapter (if supplied) belong to current user
 *   Only then is a Companion Memory created.
 *
 * FAILURE BEHAVIOR:
 *   - If confirmation succeeded but promotion fails, the Significant
 *     Interaction remains confirmed; the user can retry. No duplicate is
 *     created on retry (dedup via loadCompanionMemoryBySignificantInteraction
 *     + the DB UNIQUE index). The response distinguishes confirmation-ok from
 *     promotion-ok so the UI does NOT silently report complete success.
 *   - This fn does NOT confirm the interaction; it expects an already-confirmed
 *     one. The confirm+promote composition lives in confirmSignificantInteraction.
 *
 * SECURITY:
 *   - TanStack Start server function; server-side only.
 *   - No LLM call is needed for Companion Memory creation.
 *   - No service-role/admin auth; no provider keys; nothing logged/returned.
 *
 * NON-GOALS (this phase):
 *   - No semantic/vector retrieval, no embeddings, no auto-promotion, no
 *     ai_generated source. Editing is user-only (separate fn).
 */
import { createServerFn } from "@tanstack/react-start";

import type { CompanionMemory, SignificantInteraction } from "@/lib/memory/types";
import { getCurrentUser } from "@/lib/supabase/server-auth";
import { loadTurn } from "@/lib/supabase/companion-remote";
import { loadSignificantInteraction } from "@/lib/supabase/significant-remote";
import {
  createCompanionMemory,
  loadCompanionMemoryBySignificantInteraction,
} from "@/lib/supabase/companion-memory-remote";
import { loadMemory } from "@/lib/supabase/memory-remote";
import { loadEvent, loadChapter } from "@/lib/supabase/life-remote";

export type PromoteSignificantInteractionRequest = {
  /** The browser's Supabase access token (credential). Server verifies it. */
  accessToken: string;
  /** The CONFIRMED Significant Interaction to promote. */
  significantInteractionId: string;
  /** Optional related Memory/Event/Chapter ids — must be owned by the user. */
  relatedMemoryId?: string | null;
  relatedEventId?: string | null;
  relatedChapterId?: string | null;
};

type SerializableCompanionMemory = Omit<CompanionMemory, never>;

export type PromoteSignificantInteractionResponse = {
  /** The Companion Memory created (or the existing one on dedup/retry), or null. */
  companionMemory: SerializableCompanionMemory | null;
  /** Whether the Significant Interaction was verified confirmed + owned. */
  interactionVerified: boolean;
  /** Whether the Companion Memory was created (or already existed). */
  promoted: boolean;
  /** True when a Companion Memory already existed for this interaction (dedup). */
  alreadyExisted: boolean;
  ok: boolean;
};

type LogicResult = {
  companionMemory: CompanionMemory | null;
  interactionVerified: boolean;
  promoted: boolean;
  alreadyExisted: boolean;
  ok: boolean;
};

/**
 * Pure promotion logic, separated from the server fn wrapper so it can be
 * unit-tested without the TanStack Start runtime context. Never throws.
 *
 * @param getCurrentUserImpl injectable identity resolver (defaults to getCurrentUser).
 */
export async function promoteSignificantInteractionLogic(
  input: PromoteSignificantInteractionRequest,
  getCurrentUserImpl: typeof getCurrentUser = getCurrentUser,
): Promise<LogicResult> {
  // 1. Derive the authoritative user identity.
  const current = await getCurrentUserImpl(input.accessToken);
  if (!current) {
    return {
      companionMemory: null,
      interactionVerified: false,
      promoted: false,
      alreadyExisted: false,
      ok: false,
    };
  }
  const userId = current.id;

  // 2. Verify the Significant Interaction belongs to the current user.
  const interaction: SignificantInteraction | null = await loadSignificantInteraction(
    userId,
    input.significantInteractionId,
  );
  if (!interaction) {
    return {
      companionMemory: null,
      interactionVerified: false,
      promoted: false,
      alreadyExisted: false,
      ok: false,
    };
  }

  // 3. Verify status == 'confirmed'. No unconfirmed interaction may be promoted.
  if (interaction.status !== "confirmed") {
    return {
      companionMemory: null,
      interactionVerified: false,
      promoted: false,
      alreadyExisted: false,
      ok: false,
    };
  }

  // 4. Verify the referenced turn belongs to the current user and role == 'user'.
  const turn = await loadTurn(userId, interaction.turnId);
  if (!turn || turn.role !== "user") {
    return {
      companionMemory: null,
      interactionVerified: false,
      promoted: false,
      alreadyExisted: false,
      ok: false,
    };
  }

  // 5. Verify related Memory/Event/Chapter ownership (if supplied).
  if (input.relatedMemoryId) {
    const m = await loadMemory(userId, input.relatedMemoryId);
    if (!m)
      return {
        companionMemory: null,
        interactionVerified: false,
        promoted: false,
        alreadyExisted: false,
        ok: false,
      };
  }
  if (input.relatedEventId) {
    const e = await loadEvent(userId, input.relatedEventId);
    if (!e)
      return {
        companionMemory: null,
        interactionVerified: false,
        promoted: false,
        alreadyExisted: false,
        ok: false,
      };
  }
  if (input.relatedChapterId) {
    const c = await loadChapter(userId, input.relatedChapterId);
    if (!c)
      return {
        companionMemory: null,
        interactionVerified: false,
        promoted: false,
        alreadyExisted: false,
        ok: false,
      };
  }

  // Interaction is verified at this point.
  const interactionVerified = true;

  // 6. Dedup: if a Companion Memory already exists for this interaction
  //    (e.g. a previous successful promotion, or a retry after partial
  //    failure), return it. No duplicate is created.
  const existing = await loadCompanionMemoryBySignificantInteraction(
    userId,
    input.significantInteractionId,
  );
  if (existing) {
    return {
      companionMemory: existing,
      interactionVerified,
      promoted: true,
      alreadyExisted: true,
      ok: true,
    };
  }

  // 7. Create the Companion Memory. content is copied from the confirmed
  //    candidate_content (a concise user-approved representation). source is
  //    always user_confirmed in v1.
  const memory = await createCompanionMemory({
    userId,
    significantInteractionId: input.significantInteractionId,
    kind: interaction.kind,
    content: interaction.candidateContent,
    source: "user_confirmed",
    relatedMemoryId: input.relatedMemoryId ?? null,
    relatedEventId: input.relatedEventId ?? null,
    relatedChapterId: input.relatedChapterId ?? null,
  });
  if (!memory) {
    // Promotion failed (e.g. unique violation raced, or DB error). The
    // interaction remains confirmed; the user can retry. Not a silent success.
    return {
      companionMemory: null,
      interactionVerified,
      promoted: false,
      alreadyExisted: false,
      ok: false,
    };
  }

  return {
    companionMemory: memory,
    interactionVerified,
    promoted: true,
    alreadyExisted: false,
    ok: true,
  };
}

/**
 * Server function — the browser-facing entry point. Server-side only.
 */
export const promoteSignificantInteraction = createServerFn({ method: "POST" })
  .validator(
    (input: PromoteSignificantInteractionRequest): PromoteSignificantInteractionRequest => input,
  )
  .handler(async ({ data }) => {
    const result = await promoteSignificantInteractionLogic(data);
    return {
      companionMemory: result.companionMemory,
      interactionVerified: result.interactionVerified,
      promoted: result.promoted,
      alreadyExisted: result.alreadyExisted,
      ok: result.ok,
    } satisfies PromoteSignificantInteractionResponse;
  });
