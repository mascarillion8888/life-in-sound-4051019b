/**
 * Server-only Companion Memory management — list, archive, restore, delete,
 * edit, and the "Why do you remember this?" provenance affordance.
 *
 * IDENTITY:
 *   Derives userId from getCurrentUser(accessToken); never trusts a browser
 *   userId. Every operation is owner-scoped; RLS is the final enforcement.
 *
 * EDITING:
 *   Editing is user-only. updateCompanionMemory changes `content` only; it
 *   never changes kind/status/source/provenance, and never modifies the source
 *   Significant Interaction or the original conversation turn. The AI cannot
 *   silently rewrite active Companion Memories — no AI path calls this fn.
 *
 * PROVENANCE:
 *   loadCompanionMemoryProvenanceFn reconstructs the chain Companion Memory →
 *   Significant Interaction → Conversation Turn → Conversation, so the user
 *   can see "This memory exists because you explicitly confirmed it."
 *
 * SECURITY:
 *   - TanStack Start server functions; server-side only.
 *   - No LLM call. No service-role/admin auth. No provider keys.
 */
import { createServerFn } from "@tanstack/react-start";

import type { CompanionMemory, CompanionMemoryProvenance } from "@/lib/memory/types";
import { getCurrentUser } from "@/lib/supabase/server-auth";
import {
  archiveCompanionMemory,
  deleteCompanionMemory,
  listCompanionMemories,
  loadCompanionMemoryProvenance,
  restoreCompanionMemory,
  updateCompanionMemory,
} from "@/lib/supabase/companion-memory-remote";

type SerializableCompanionMemory = Omit<CompanionMemory, never>;

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export type ListCompanionMemoriesRequest = {
  accessToken: string;
  includeArchived?: boolean;
};

export type ListCompanionMemoriesResponse = {
  memories: SerializableCompanionMemory[];
  ok: boolean;
};

export const listCompanionMemoriesFn = createServerFn({ method: "POST" })
  .validator((input: ListCompanionMemoriesRequest): ListCompanionMemoriesRequest => input)
  .handler(async ({ data }) => {
    const current = await getCurrentUser(data.accessToken);
    if (!current) return { memories: [], ok: false } satisfies ListCompanionMemoriesResponse;
    const memories = await listCompanionMemories(current.id, {
      includeArchived: data.includeArchived ?? false,
    });
    return { memories, ok: true } satisfies ListCompanionMemoriesResponse;
  });

// ---------------------------------------------------------------------------
// Archive / Restore
// ---------------------------------------------------------------------------

export type CompanionMemoryIdRequest = {
  accessToken: string;
  companionMemoryId: string;
};

export type CompanionMemoryActionResponse = {
  memory: SerializableCompanionMemory | null;
  ok: boolean;
};

export const archiveCompanionMemoryFn = createServerFn({ method: "POST" })
  .validator((input: CompanionMemoryIdRequest): CompanionMemoryIdRequest => input)
  .handler(async ({ data }) => {
    const current = await getCurrentUser(data.accessToken);
    if (!current) return { memory: null, ok: false } satisfies CompanionMemoryActionResponse;
    const memory = await archiveCompanionMemory(current.id, data.companionMemoryId);
    return { memory, ok: memory !== null } satisfies CompanionMemoryActionResponse;
  });

export const restoreCompanionMemoryFn = createServerFn({ method: "POST" })
  .validator((input: CompanionMemoryIdRequest): CompanionMemoryIdRequest => input)
  .handler(async ({ data }) => {
    const current = await getCurrentUser(data.accessToken);
    if (!current) return { memory: null, ok: false } satisfies CompanionMemoryActionResponse;
    const memory = await restoreCompanionMemory(current.id, data.companionMemoryId);
    return { memory, ok: memory !== null } satisfies CompanionMemoryActionResponse;
  });

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export type DeleteCompanionMemoryResponse = {
  deleted: boolean;
  ok: boolean;
};

export const deleteCompanionMemoryFn = createServerFn({ method: "POST" })
  .validator((input: CompanionMemoryIdRequest): CompanionMemoryIdRequest => input)
  .handler(async ({ data }) => {
    const current = await getCurrentUser(data.accessToken);
    if (!current) return { deleted: false, ok: false } satisfies DeleteCompanionMemoryResponse;
    const deleted = await deleteCompanionMemory(current.id, data.companionMemoryId);
    return { deleted, ok: deleted } satisfies DeleteCompanionMemoryResponse;
  });

// ---------------------------------------------------------------------------
// Edit (user-only; content only)
// ---------------------------------------------------------------------------

export type UpdateCompanionMemoryRequest = {
  accessToken: string;
  companionMemoryId: string;
  content: string;
};

export const updateCompanionMemoryFn = createServerFn({ method: "POST" })
  .validator((input: UpdateCompanionMemoryRequest): UpdateCompanionMemoryRequest => input)
  .handler(async ({ data }) => {
    const current = await getCurrentUser(data.accessToken);
    if (!current) return { memory: null, ok: false } satisfies CompanionMemoryActionResponse;
    const memory = await updateCompanionMemory(current.id, data.companionMemoryId, data.content);
    return { memory, ok: memory !== null } satisfies CompanionMemoryActionResponse;
  });

// ---------------------------------------------------------------------------
// "Why do you remember this?" — provenance affordance
// ---------------------------------------------------------------------------

export type CompanionMemoryProvenanceResponse = {
  provenance: CompanionMemoryProvenance | null;
  ok: boolean;
};

export const loadCompanionMemoryProvenanceFn = createServerFn({ method: "POST" })
  .validator((input: CompanionMemoryIdRequest): CompanionMemoryIdRequest => input)
  .handler(async ({ data }) => {
    const current = await getCurrentUser(data.accessToken);
    if (!current)
      return { provenance: null, ok: false } satisfies CompanionMemoryProvenanceResponse;
    const provenance = await loadCompanionMemoryProvenance(current.id, data.companionMemoryId);
    return { provenance, ok: provenance !== null } satisfies CompanionMemoryProvenanceResponse;
  });
