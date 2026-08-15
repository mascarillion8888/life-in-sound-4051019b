/**
 * Companion Conversation persistence layer.
 *
 * Two tables (migration 0007):
 *   - companion_conversations  (one user, status active|archived)
 *   - companion_turns          (role user|assistant|system, content preserved
 *                               exactly as produced)
 *
 * Safety conventions mirror journey-remote.ts / memory-remote.ts:
 *   - Only the browser anon client is used (see supabase/client.ts).
 *   - Every query is owner-scoped (`.eq('user_id', userId)`); RLS is the
 *     final enforcement on auth.uid() = user_id.
 *   - No service-role credentials ever reach the browser.
 *   - Failures are contained: return `null` / empty rather than throwing.
 *
 * CONTENT PRESERVATION:
 *   Turns are stored exactly as produced. There is no rewrite, no summary, no
 *   in-place mutation of historical text. Any future summary must be additive
 *   and separately stored.
 *
 * SOURCE OF TRUTH:
 *   A turn is historical conversation context. It is NOT memory, pattern,
 *   event, chapter, or companion memory. No durable memory is inferred here.
 */
import { getSupabase } from "./client";
import type { CompanionConversationRow, CompanionTurnRow } from "./types";
import type {
  CompanionConversation,
  CompanionConversationStatus,
  CompanionTurn,
  CompanionTurnRole,
} from "@/lib/memory/types";

const CONVERSATIONS_TABLE = "companion_conversations";
const TURNS_TABLE = "companion_turns";

const RECENT_TURN_LIMIT = 20;

function rowToConversation(row: CompanionConversationRow): CompanionConversation {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    status: row.status,
    startedAt: row.started_at,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToTurn(row: CompanionTurnRow): CompanionTurn {
  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    metadata: row.metadata,
  };
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

/**
 * Create a conversation owned by `userId`. The title is optional and may be
 * set later. Returns the new conversation, or null on failure.
 */
export async function createConversation(
  userId: string,
  title: string | null = null,
): Promise<CompanionConversation | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .insert({ user_id: userId, title: title ?? null, status: "active" })
    .select()
    .single();
  if (error || !data) return null;
  return rowToConversation(data as CompanionConversationRow);
}

/**
 * List conversations owned by `userId`, most recently active first. Optionally
 * filter by status. Only the caller's conversations are visible (RLS + scope).
 */
export async function listConversations(
  userId: string,
  status?: CompanionConversationStatus,
): Promise<CompanionConversation[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  let query = supabase
    .from(CONVERSATIONS_TABLE)
    .select()
    .eq("user_id", userId)
    .order("last_activity_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error || !data) return [];
  return (data as CompanionConversationRow[]).map(rowToConversation);
}

/**
 * Load a single conversation owned by `userId`. Returns null if not found or
 * not owned (cross-user access → safe "not found").
 */
export async function loadConversation(
  userId: string,
  conversationId: string,
): Promise<CompanionConversation | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .select()
    .eq("user_id", userId)
    .eq("id", conversationId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToConversation(data as CompanionConversationRow);
}

/**
 * Archive or reactivate a conversation. Returns the updated conversation, or
 * null if not found / not owned. Archive preserves all historical turns.
 */
export async function setConversationStatus(
  userId: string,
  conversationId: string,
  status: CompanionConversationStatus,
): Promise<CompanionConversation | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(CONVERSATIONS_TABLE)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", conversationId)
    .select()
    .maybeSingle();
  if (error || !data) return null;
  return rowToConversation(data as CompanionConversationRow);
}

/** Convenience: archive a conversation. */
export function archiveConversation(
  userId: string,
  conversationId: string,
): Promise<CompanionConversation | null> {
  return setConversationStatus(userId, conversationId, "archived");
}

/** Convenience: reopen an archived conversation. */
export function reopenConversation(
  userId: string,
  conversationId: string,
): Promise<CompanionConversation | null> {
  return setConversationStatus(userId, conversationId, "active");
}

// ---------------------------------------------------------------------------
// Turns
// ---------------------------------------------------------------------------

/**
 * Create a turn in a conversation owned by `userId`. Ownership of the
 * conversation is verified (owner-scoped query) before insert; a cross-user
 * conversation id yields no insert (RLS + scope). Content is stored exactly as
 * provided — no rewrite, no summary.
 */
export async function createTurn(
  userId: string,
  conversationId: string,
  role: CompanionTurnRole,
  content: string,
  metadata: Record<string, unknown> | null = null,
): Promise<CompanionTurn | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  if (!content || content.trim().length === 0) return null;

  // Verify conversation ownership first (defense-in-depth before insert).
  const owner = await loadConversation(userId, conversationId);
  if (!owner) return null;

  const { data, error } = await supabase
    .from(TURNS_TABLE)
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      role,
      content,
      metadata,
    })
    .select()
    .single();
  if (error || !data) return null;
  return rowToTurn(data as CompanionTurnRow);
}

/**
 * List all turns for a conversation owned by `userId`, oldest first (chronological).
 */
export async function listTurns(userId: string, conversationId: string): Promise<CompanionTurn[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TURNS_TABLE)
    .select()
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as CompanionTurnRow[]).map(rowToTurn);
}

/**
 * Load the most recent turns (default 20) for a conversation, oldest-first so
 * the conversation reads naturally. Used to build grounded context for the
 * Companion LLM call WITHOUT sending the entire history.
 */
export async function loadRecentTurns(
  userId: string,
  conversationId: string,
  limit: number = RECENT_TURN_LIMIT,
): Promise<CompanionTurn[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const safeLimit = Math.max(1, Math.min(limit, RECENT_TURN_LIMIT));
  const { data, error } = await supabase
    .from(TURNS_TABLE)
    .select()
    .eq("user_id", userId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  if (error || !data) return [];
  // Reverse to chronological order for natural reading.
  return (data as CompanionTurnRow[]).reverse().map(rowToTurn);
}

export { RECENT_TURN_LIMIT };

/**
 * Load a single turn owned by `userId`. Returns null if not found / not owned
 * (cross-user access → safe "not found"). Used by the significance layer to
 * verify turn ownership + role before classifying.
 */
export async function loadTurn(userId: string, turnId: string): Promise<CompanionTurn | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TURNS_TABLE)
    .select()
    .eq("user_id", userId)
    .eq("id", turnId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToTurn(data as CompanionTurnRow);
}
