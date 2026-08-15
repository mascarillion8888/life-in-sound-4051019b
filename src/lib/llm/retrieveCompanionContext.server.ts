/**
 * Server-only Companion Retrieval — assembles a bounded, trust-labelled
 * context set for the Companion prompt.
 *
 * IDENTITY HARDENING (mirrors companionConversation.server.ts):
 *   The authoritative user identity is derived from the CURRENT authenticated
 *   Supabase session, NOT from a browser-supplied userId. The browser presents
 *   its access token (a credential); the server verifies it via
 *   `getCurrentUser(accessToken)` and derives `user.id`. A forged/expired token
 *   yields null and the operation is rejected before any database access.
 *
 * Flow:
 *   current request (accessToken + conversationId + message)
 *     ↓ verify access token → derive userId (server-authoritative)
 *     ↓ verify conversation ownership (owned by derived userId)
 *     ↓ load bounded candidate data owned by current user
 *     ↓ run pure retrieval planner (deterministic, no LLM, no network)
 *     ↓ return bounded CompanionContextItem[]
 *
 * SECURITY:
 *   - TanStack Start server function (`createServerFn`); server-side only.
 *   - Browser input may identify: conversationId, message text, accessToken.
 *     Browser input must NOT determine: userId, ownership, or scope.
 *   - Never returns another user's data: every loader is owner-scoped + RLS.
 *   - Never calls the provider directly. No provider keys here.
 *
 * COST CONTROL:
 *   - Retrieval is deterministic. No LLM call decides what to retrieve.
 *   - No extra Orchestra call is added for ordinary conversation.
 *   - The Significant Interaction gate remains independent of this layer.
 *
 * RETRIEVAL FAILURE:
 *   - If any loader fails, that source is simply empty — the conversation
 *     still works with whatever context was loaded. No fabricated context.
 *   - If the whole retrieval fails, the caller falls back to recent turns only.
 */
import { createServerFn } from "@tanstack/react-start";

import {
  applyRetrievalBudgets,
  planRetrieval,
  type CompanionContextItem,
  type IntentBudget,
  type RetrievalCandidates,
  type RetrievalPlan,
} from "@/lib/memory/companionRetrieval";
import { getCurrentUser } from "@/lib/supabase/server-auth";
import { loadConversation } from "@/lib/supabase/companion-remote";
import {
  loadChaptersForRetrieval,
  loadCompanionMemoriesForRetrieval,
  loadEventsForRetrieval,
  loadMemoriesForRetrieval,
  loadPatternsForRetrieval,
  loadRecentTurnsForRetrieval,
  loadReflectionsForRetrieval,
} from "@/lib/supabase/companion-retrieval-remote";
import type {
  CompanionTurn,
  LifeChapter,
  LifeEvent,
  Memory,
  Pattern,
  Reflection,
} from "@/lib/memory/types";
import type { CompanionMemory } from "@/lib/memory/types";

export type RetrieveCompanionContextRequest = {
  /** The browser's Supabase access token (a credential, NOT a userId). */
  accessToken: string;
  conversationId: string;
  message: string;
};

export type RetrieveCompanionContextResponse = {
  /** Bounded, trust-labelled, deduplicated context items (may be empty). */
  items: CompanionContextItem[];
  /** False when identity/ownership failed; items will be empty. */
  ok: boolean;
};

/** Internal logic result (uses live domain types). */
type LogicResult = {
  items: CompanionContextItem[];
  ok: boolean;
};

/**
 * Pure retrieval logic, separated from the `createServerFn` wrapper so it can
 * be unit-tested. Never throws. On any failure returns `{ items: [], ok: false }`.
 *
 * @param getCurrentUserImpl injectable identity resolver (defaults to
 *   `getCurrentUser`) so tests can mock the authenticated server context.
 */
export async function retrieveCompanionContextLogic(
  input: RetrieveCompanionContextRequest,
  getCurrentUserImpl: typeof getCurrentUser = getCurrentUser,
): Promise<LogicResult> {
  // 0. Derive the authoritative user identity from the verified access token.
  const current = await getCurrentUserImpl(input.accessToken);
  if (!current) return { items: [], ok: false };
  const userId = current.id;

  // 1. Verify conversation ownership (owned by the derived userId). This is
  //    defense-in-depth before loading any candidate data.
  const conversation = await loadConversation(userId, input.conversationId);
  if (!conversation) return { items: [], ok: false };

  // 2. Load bounded candidate data owned by the current user. Each loader is
  //    owner-scoped + RLS-enforced and applies a hard DB-level limit so the
  //    user's entire corpus is never fetched. Loader failures are contained
  //    (they return []), so a failing source does not break the others.
  let recentTurns: CompanionTurn[] = [];
  let companionMemories: CompanionMemory[] = [];
  let memories: Memory[] = [];
  let reflections: Reflection[] = [];
  let patterns: Pattern[] = [];
  let events: LifeEvent[] = [];
  let chapters: LifeChapter[] = [];
  try {
    [recentTurns, companionMemories, memories, reflections, patterns, events, chapters] =
      await Promise.all([
        loadRecentTurnsForRetrieval(userId, input.conversationId),
        loadCompanionMemoriesForRetrieval(userId),
        loadMemoriesForRetrieval(userId),
        loadReflectionsForRetrieval(userId),
        loadPatternsForRetrieval(userId),
        loadEventsForRetrieval(userId),
        loadChaptersForRetrieval(userId),
      ]);
  } catch {
    // Any loader failure → fall back to whatever was loaded (possibly empty).
    // No fabricated context.
  }

  const candidates: RetrievalCandidates = {
    recentTurns,
    companionMemories,
    memories,
    reflections,
    patterns,
    events,
    chapters,
  };

  // 3. Run the pure retrieval planner (deterministic, no LLM, no network).
  const items = planRetrieval({ message: input.message, candidates });

  return { items, ok: true };
}

/**
 * Server function — the browser-facing entry point. Server-side only.
 */
export const retrieveCompanionContext = createServerFn({ method: "POST" })
  .validator((input: RetrieveCompanionContextRequest): RetrieveCompanionContextRequest => input)
  .handler(async ({ data }) => {
    const result = await retrieveCompanionContextLogic(data);
    return { items: result.items, ok: result.ok };
  });

// ===========================================================================
// Intent-scoped retrieval (Companion Contextual Orchestration v1)
//
// The orchestration layer (companionOrchestrator.ts) decides WHICH domains to
// load for a given intent. This function loads ONLY those domains (bounded,
// owner-scoped) and runs the pure planner, then applies the per-intent budget
// caps from the orchestration policy. It does NOT load unrelated domains (so an
// ordinary chat never fetches the user's memories/patterns/etc., and a chapter
// request never loads Media binaries).
//
// This is ADDITIVE: the existing `retrieveCompanionContextLogic` above is
// unchanged and remains the whole-domain retrieval path for backward
// compatibility.
// ===========================================================================

export type RetrieveCompanionContextForIntentRequest = RetrieveCompanionContextRequest & {
  /** Which domains to load, per the orchestration policy. */
  plan: RetrievalPlan;
  /** Per-intent budget caps (≤ global defaults). */
  budgets: IntentBudget;
};

export async function retrieveCompanionContextForIntentLogic(
  input: RetrieveCompanionContextForIntentRequest,
  getCurrentUserImpl: typeof getCurrentUser = getCurrentUser,
): Promise<LogicResult> {
  const current = await getCurrentUserImpl(input.accessToken);
  if (!current) return { items: [], ok: false };
  const userId = current.id;

  // Verify conversation ownership (defense-in-depth before loading data).
  const conversation = await loadConversation(userId, input.conversationId);
  if (!conversation) return { items: [], ok: false };

  const plan = input.plan;

  // Load ONLY the domains the orchestration policy requested, each bounded at
  // the DB level. Promise.allSettled-style containment: a failing domain is
  // simply empty and never breaks the others.
  const safe = <T>(p: Promise<T>): Promise<T | []> => p.catch(() => [] as [] as T);

  const [recentTurns, companionMemories, memories, reflections, patterns, events, chapters] =
    await Promise.all([
      plan.conversation
        ? safe(loadRecentTurnsForRetrieval(userId, input.conversationId))
        : Promise.resolve([]),
      plan.companionMemories
        ? safe(loadCompanionMemoriesForRetrieval(userId))
        : Promise.resolve([]),
      plan.memories ? safe(loadMemoriesForRetrieval(userId)) : Promise.resolve([]),
      plan.reflections ? safe(loadReflectionsForRetrieval(userId)) : Promise.resolve([]),
      plan.patterns ? safe(loadPatternsForRetrieval(userId)) : Promise.resolve([]),
      plan.events ? safe(loadEventsForRetrieval(userId)) : Promise.resolve([]),
      plan.chapters ? safe(loadChaptersForRetrieval(userId)) : Promise.resolve([]),
    ]);

  const candidates: RetrievalCandidates = {
    recentTurns: recentTurns as CompanionTurn[],
    companionMemories: companionMemories as CompanionMemory[],
    memories: memories as Memory[],
    reflections: reflections as Reflection[],
    patterns: patterns as Pattern[],
    events: events as LifeEvent[],
    chapters: chapters as LifeChapter[],
  };

  // Pure planner (deterministic, no LLM, no network).
  const items = planRetrieval({ message: input.message, candidates });

  // Apply per-intent budget caps so the total context stays bounded per intent.
  const capped = applyRetrievalBudgets(items, input.budgets);

  return { items: capped, ok: true };
}
