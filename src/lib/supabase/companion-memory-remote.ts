/**
 * Companion Memory persistence layer.
 *
 * One table (migration 0009): companion_memories.
 *
 * Safety conventions mirror significant-remote.ts / companion-remote.ts:
 *   - Only the browser anon client is used (see supabase/client.ts).
 *   - Every query is owner-scoped (`.eq('user_id', userId)`); RLS is the
 *     final enforcement on auth.uid() = user_id.
 *   - No service-role credentials ever reach the browser.
 *   - Failures are contained: return `null` / empty / false rather than throwing.
 *
 * PROMOTION:
 *   The ONLY creation path in v1 is promoteSignificantInteraction() — a
 *   confirmed Significant Interaction is promoted into a Companion Memory.
 *   createCompanionMemory() is a lower-level helper that assumes the caller has
 *   ALREADY verified: ownership, status=='confirmed', turn ownership, turn
 *   role=='user', and related-object ownership. It exists so the promotion
 *   logic can be unit-tested; it is not a public entry point for arbitrary
 *   creation. No unconfirmed interaction may become Companion Memory.
 *
 * ATOMICITY / DEDUP:
 *   A DB UNIQUE index on significant_interaction_id guarantees a Significant
 *   Interaction is promoted at most once. The persistence layer surfaces a
 *   unique-violation as a safe `null` (no duplicate). A retry after a partial
 *   failure reuses the existing row (loadCompanionMemoryBySignificantInteraction).
 *
 * PROVENANCE:
 *   Every Companion Memory references exactly one significant_interaction_id.
 *   The original conversation turn is NEVER mutated here; `content` is copied
 *   from the confirmed candidate_content at promotion time.
 *
 * RELATED OBJECTS:
 *   related_memory_id / related_event_id / related_chapter_id are optional and
 *   reference EXISTING user-owned objects. They use ON DELETE SET NULL —
 *   deleting a related object detaches the link but preserves the Companion
 *   Memory. Their ownership is verified by the promotion server fn BEFORE
 *   linking, not by this layer alone.
 *
 * This is NOT AI interpretation and NOT conversation history. It is a durable,
 * user-approved record. The Companion cannot silently rewrite it.
 */
import { getSupabase } from "./client";
import type { CompanionMemoryRow } from "./types";
import type {
  CompanionMemory,
  CompanionMemoryKind,
  CompanionMemoryProvenance,
  CompanionMemorySource,
  CompanionMemoryStatus,
  SignificantInteraction,
} from "@/lib/memory/types";
import { loadConversation, loadTurn } from "./companion-remote";
import { loadSignificantInteraction } from "./significant-remote";

const TABLE = "companion_memories";

function rowToMemory(row: CompanionMemoryRow): CompanionMemory {
  return {
    id: row.id,
    userId: row.user_id,
    significantInteractionId: row.significant_interaction_id,
    kind: row.kind,
    content: row.content,
    status: row.status,
    source: row.source,
    relatedMemoryId: row.related_memory_id,
    relatedEventId: row.related_event_id,
    relatedChapterId: row.related_chapter_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

/**
 * Low-level create. Assumes the caller (promotion logic) has ALREADY verified:
 *   - current user owns the Significant Interaction
 *   - Significant Interaction status == 'confirmed'
 *   - the referenced turn belongs to the current user and role == 'user'
 *   - related Memory/Event/Chapter (if any) belong to the current user
 * Returns null on failure or duplicate promotion (unique violation).
 */
export async function createCompanionMemory(input: {
  userId: string;
  significantInteractionId: string;
  kind: CompanionMemoryKind;
  content: string;
  source: CompanionMemorySource;
  relatedMemoryId?: string | null;
  relatedEventId?: string | null;
  relatedChapterId?: string | null;
}): Promise<CompanionMemory | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  if (!input.content || input.content.trim().length === 0) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: input.userId,
      significant_interaction_id: input.significantInteractionId,
      kind: input.kind,
      content: input.content,
      status: "active",
      source: input.source,
      related_memory_id: input.relatedMemoryId ?? null,
      related_event_id: input.relatedEventId ?? null,
      related_chapter_id: input.relatedChapterId ?? null,
    })
    .select()
    .single();
  if (error || !data) return null;
  return rowToMemory(data as CompanionMemoryRow);
}

/**
 * Load a single Companion Memory owned by `userId`. Returns null if not found
 * / not owned (cross-user → safe "not found", no existence leakage).
 */
export async function loadCompanionMemory(
  userId: string,
  id: string,
): Promise<CompanionMemory | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select()
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return rowToMemory(data as CompanionMemoryRow);
}

/**
 * Load the Companion Memory (if any) that was promoted from a given Significant
 * Interaction, owned by `userId`. Used for dedup: a retry after a partial
 * failure reuses the existing row instead of creating a duplicate.
 */
export async function loadCompanionMemoryBySignificantInteraction(
  userId: string,
  significantInteractionId: string,
): Promise<CompanionMemory | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select()
    .eq("user_id", userId)
    .eq("significant_interaction_id", significantInteractionId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToMemory(data as CompanionMemoryRow);
}

/**
 * Minimal retrieval for the next Companion phase. Returns ONLY the current
 * user's ACTIVE Companion Memories, newest first. No semantic/vector retrieval.
 */
export async function listActiveCompanionMemories(userId: string): Promise<CompanionMemory[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select()
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as CompanionMemoryRow[]).map(rowToMemory);
}

/**
 * List Companion Memories for the management UI. Returns ACTIVE only by
 * default; pass `includeArchived: true` to also return archived memories.
 * Always owner-scoped; newest first.
 */
export async function listCompanionMemories(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<CompanionMemory[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let query = supabase.from(TABLE).select().eq("user_id", userId);
  if (!options.includeArchived) {
    query = query.eq("status", "active");
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as CompanionMemoryRow[]).map(rowToMemory);
}

/**
 * Set the status of a Companion Memory owned by `userId`. Used by archive and
 * restore. Returns the updated memory, or null if not found / not owned.
 */
async function setCompanionMemoryStatus(
  userId: string,
  id: string,
  status: CompanionMemoryStatus,
): Promise<CompanionMemory | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, updated_at: now };
  if (status === "archived") patch.archived_at = now;
  else patch.archived_at = null; // restore clears archived_at
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq("user_id", userId)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error || !data) return null;
  return rowToMemory(data as CompanionMemoryRow);
}

/** Archive a Companion Memory (reversible). */
export function archiveCompanionMemory(
  userId: string,
  id: string,
): Promise<CompanionMemory | null> {
  return setCompanionMemoryStatus(userId, id, "archived");
}

/** Restore an archived Companion Memory to active. */
export function restoreCompanionMemory(
  userId: string,
  id: string,
): Promise<CompanionMemory | null> {
  return setCompanionMemoryStatus(userId, id, "active");
}

/**
 * Permanently delete a Companion Memory owned by `userId`. Returns true on
 * success, false if not found / not owned. The source Significant Interaction
 * is NOT deleted (it remains a confirmed record); only the Companion Memory
 * is removed. This is the real DELETE path (no soft marker).
 */
export async function deleteCompanionMemory(userId: string, id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from(TABLE).delete().eq("user_id", userId).eq("id", id);
  return !error;
}

/**
 * Edit a Companion Memory's content (user-initiated only). Preserves all
 * provenance fields; only `content` (and updated_at) change. The source
 * Significant Interaction and original conversation turn are NOT modified.
 * Returns the updated memory, or null if not found / not owned.
 *
 * Per the phase spec, editing is implemented minimally: only the user may edit,
 * the AI cannot silently rewrite active Companion Memories (no AI path calls
 * this). updateCompanionMemory does not change kind/status/source/provenance.
 */
export async function updateCompanionMemory(
  userId: string,
  id: string,
  content: string,
): Promise<CompanionMemory | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  if (!content || content.trim().length === 0) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .update({ content, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error || !data) return null;
  return rowToMemory(data as CompanionMemoryRow);
}

/**
 * Build the "Why do you remember this?" provenance detail for a Companion
 * Memory owned by `userId`. Loads the source Significant Interaction, its
 * source conversation, and the original user turn. Returns null if the
 * Companion Memory is not found / not owned, or if provenance cannot be
 * reconstructed (data integrity). Never throws.
 *
 * The original turn content is included verbatim (never mutated).
 */
export async function loadCompanionMemoryProvenance(
  userId: string,
  companionMemoryId: string,
): Promise<CompanionMemoryProvenance | null> {
  const memory = await loadCompanionMemory(userId, companionMemoryId);
  if (!memory) return null;

  const interaction: SignificantInteraction | null = await loadSignificantInteraction(
    userId,
    memory.significantInteractionId,
  );
  if (!interaction) return null;

  const conversation = await loadConversation(userId, interaction.conversationId);
  if (!conversation) return null;

  const turn = await loadTurn(userId, interaction.turnId);
  if (!turn) return null;

  return {
    companionMemoryId: memory.id,
    significantInteractionId: interaction.id,
    kind: memory.kind,
    source: memory.source,
    conversationId: conversation.id,
    conversationTitle: conversation.title,
    turnId: turn.id,
    turnContent: turn.content,
    confirmedAt: interaction.updatedAt,
    promotedAt: memory.createdAt,
  };
}
