/**
 * Significant Interaction persistence layer.
 *
 * One table (migration 0008): significant_interactions.
 *
 * Safety conventions mirror companion-remote.ts / memory-remote.ts:
 *   - Only the browser anon client is used (see supabase/client.ts).
 *   - Every query is owner-scoped (`.eq('user_id', userId)`); RLS is the
 *     final enforcement on auth.uid() = user_id.
 *   - No service-role credentials ever reach the browser.
 *   - Failures are contained: return `null` / empty rather than throwing.
 *
 * PROVENANCE:
 *   Every candidate points back to conversation_id + turn_id. The original
 *   turn is NEVER mutated here; candidate_content is an explicitly-marked
 *   PROPOSED normalized memory statement.
 *
 * CONFIRMATION:
 *   The classifier may create a 'candidate' row. It may NOT confirm it.
 *   Only the explicit user-confirmation path (confirmSignificantInteraction)
 *   sets status='confirmed'. No automatic confirmation exists here.
 *
 * This is still an interaction record, NOT a durable Companion Memory.
 */
import { getSupabase } from "./client";
import type { SignificantInteractionRow } from "./types";
import type {
  SignificantInteraction,
  SignificantInteractionKind,
  SignificantInteractionSource,
  SignificantInteractionStatus,
} from "@/lib/memory/types";

const TABLE = "significant_interactions";

function rowToInteraction(row: SignificantInteractionRow): SignificantInteraction {
  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    turnId: row.turn_id,
    kind: row.kind,
    candidateContent: row.candidate_content,
    reason: row.reason,
    status: row.status,
    source: row.source,
    confidence: row.confidence,
    fingerprint: row.fingerprint,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Stable dedup fingerprint for a candidate: turn_id + normalized candidate
 * content. Two candidates for the same turn with the same normalized statement
 * share a fingerprint, preventing duplicate active candidates per turn.
 */
export function candidateFingerprint(turnId: string, candidateContent: string): string {
  const norm = candidateContent.trim().toLowerCase().replace(/\s+/g, " ");
  return `${turnId}:${norm}`;
}

export type CreateCandidateInput = {
  userId: string;
  conversationId: string;
  turnId: string;
  kind: SignificantInteractionKind;
  candidateContent: string;
  reason: string | null;
  source: SignificantInteractionSource;
  confidence: number | null;
};

/**
 * Create a 'candidate' significant interaction. Returns null on failure or
 * when an active candidate already exists for the turn (the partial unique
 * index significant_interactions_active_per_turn_uniq prevents duplicates).
 * The classifier NEVER confirms; rows are inserted as 'candidate'.
 */
export async function createCandidate(
  input: CreateCandidateInput,
): Promise<SignificantInteraction | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  if (!input.candidateContent || input.candidateContent.trim().length === 0) return null;

  const fingerprint = candidateFingerprint(input.turnId, input.candidateContent);
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: input.userId,
      conversation_id: input.conversationId,
      turn_id: input.turnId,
      kind: input.kind,
      candidate_content: input.candidateContent,
      reason: input.reason,
      status: "candidate",
      source: input.source,
      confidence: input.confidence,
      fingerprint,
    })
    .select()
    .single();
  if (error || !data) return null;
  return rowToInteraction(data as SignificantInteractionRow);
}

/**
 * Load a single significant interaction owned by `userId`. Returns null if
 * not found / not owned (cross-user → safe "not found", no existence leakage).
 */
export async function loadSignificantInteraction(
  userId: string,
  id: string,
): Promise<SignificantInteraction | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select()
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return rowToInteraction(data as SignificantInteractionRow);
}

/**
 * List the active (candidate | confirmed) significant interactions for a
 * conversation, newest first. Used by the UI to show pending candidates.
 */
export async function listActiveCandidatesForConversation(
  userId: string,
  conversationId: string,
): Promise<SignificantInteraction[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select()
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .in("status", ["candidate", "confirmed"])
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as SignificantInteractionRow[]).map(rowToInteraction);
}

/**
 * List the active candidate(s) for a specific turn. Used to detect duplicates
 * before classification and to surface the pending candidate after a turn.
 */
export async function listCandidatesForTurn(
  userId: string,
  turnId: string,
): Promise<SignificantInteraction[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select()
    .eq("user_id", userId)
    .eq("turn_id", turnId)
    .in("status", ["candidate", "confirmed"])
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as SignificantInteractionRow[]).map(rowToInteraction);
}

/**
 * Set the status of a significant interaction owned by `userId`. Used by the
 * user-confirmation path: 'confirmed' (Remember this) or 'dismissed' (Not now).
 * Returns the updated interaction, or null if not found / not owned.
 */
export async function setSignificantInteractionStatus(
  userId: string,
  id: string,
  status: SignificantInteractionStatus,
): Promise<SignificantInteraction | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error || !data) return null;
  return rowToInteraction(data as SignificantInteractionRow);
}

/** Convenience: user confirmed they want to remember this candidate. */
export function confirmSignificantInteraction(
  userId: string,
  id: string,
): Promise<SignificantInteraction | null> {
  return setSignificantInteractionStatus(userId, id, "confirmed");
}

/** Convenience: user dismissed this candidate for now. */
export function dismissSignificantInteraction(
  userId: string,
  id: string,
): Promise<SignificantInteraction | null> {
  return setSignificantInteractionStatus(userId, id, "dismissed");
}
