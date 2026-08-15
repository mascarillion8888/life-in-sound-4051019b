/**
 * Server-only AI Life Structure Suggestion — bridges the Events/Chapters UI to
 * the TypeScript Orchestra.
 *
 * The Orchestra may SUGGEST a life Event or Chapter grouping from existing
 * deterministic evidence. It NEVER persists. The user must explicitly Accept/
 * Dismiss. AI interpretation is never silently converted into personal history.
 *
 * SECURITY:
 *   - TanStack Start server function; server-side only.
 *   - Provider keys read inside orchestra.ts from server-only env vars.
 *   - The server fn verifies ownership of every memory id supplied to the LLM.
 *     It NEVER accepts arbitrary memory ids from the browser without an
 *     ownership check.
 *   - Returns `{ suggestion: StructureSuggestion | null }` — no credentials.
 *   - No LLM call from the browser; the browser only calls this server fn.
 *
 * ROLE: `summarizer` ("Compress to essentials.") — the task is concise grounded
 * synthesis of existing evidence, not research. No role mapping is modified.
 *
 * REFRESH BEHAVIOR: suggestion is generated ONLY when the user explicitly
 * requests it (e.g. "Suggest a structure"). The server fn does not auto-spend
 * tokens.
 */
import { createServerFn } from "@tanstack/react-start";

import { runRole } from "@/lib/llm/orchestra";
import {
  STRUCTURE_PROMPT_VERSION,
  buildSuggestStructurePrompt,
  parseSuggestStructureResponse,
} from "@/lib/llm/suggestStructure";
import type { SuggestStructureInput, SuggestStructureOutput } from "@/lib/llm/suggestStructure";
import type { StructureSuggestion } from "@/lib/memory/types";
import { listMemories, loadMemory } from "@/lib/supabase/memory-remote";
import { listPatterns } from "@/lib/supabase/patterns-remote";

/**
 * Pure suggestion logic, separated from the `createServerFn` wrapper so it can
 * be unit-tested without the TanStack Start runtime context.
 *
 * Returns `{ suggestion }`. `null` on: empty input, provider unavailable,
 * network error, malformed/unparseable response, or invalid memory ids.
 * Never throws.
 */
export async function suggestStructureLogic(
  input: SuggestStructureInput,
): Promise<SuggestStructureOutput> {
  if (!input?.memories || input.memories.length === 0) {
    return { suggestion: null } satisfies SuggestStructureOutput;
  }

  const validIds = new Set(input.memories.map((m) => m.memoryId));
  const prompt = buildSuggestStructurePrompt(input);

  try {
    const response = await runRole("summarizer", prompt, {
      temperature: 0.3,
      maxTokens: 400,
    });
    if (!response) return { suggestion: null } satisfies SuggestStructureOutput;

    const parsed = parseSuggestStructureResponse(response, validIds);
    if (!parsed) return { suggestion: null } satisfies SuggestStructureOutput;

    // Carry the requested kind onto the suggestion.
    const suggestion: StructureSuggestion = {
      ...parsed,
      kind: input.kind,
    };
    return { suggestion } satisfies SuggestStructureOutput;
  } catch {
    return { suggestion: null } satisfies SuggestStructureOutput;
  }
}

/**
 * Server function — the browser-facing entry point. Given a userId + kind +
 * optional pattern/memory ids, it:
 *   1. Loads the user's patterns (ownership-verified).
 *   2. Loads the user's memories (ownership-verified).
 *   3. Builds a grounded prompt from ONLY owned evidence.
 *   4. Calls the Orchestra.
 *   5. Returns the suggestion (NEVER persists).
 *
 * Never accepts arbitrary memory ids from the browser without an ownership
 * check: if memoryIds are supplied, they are intersected with the user's owned
 * memories; if none remain, returns null.
 */
export const suggestStructure = createServerFn({ method: "POST" })
  .validator((input: { userId: string; kind: "event" | "chapter"; memoryIds?: string[] }) => input)
  .handler(async ({ data }) => {
    const { userId, kind } = data;

    // 1. Ownership-verified patterns.
    const patterns = await listPatterns(userId, false);

    // 2. Ownership-verified memories.
    const allMemories = await listMemories(userId);
    const ownedIds = new Set(allMemories.map((m) => m.id));

    let selected = allMemories;
    if (data.memoryIds && data.memoryIds.length > 0) {
      // Intersect supplied ids with owned memories (ownership check).
      selected = allMemories.filter((m) => data.memoryIds!.includes(m.id));
      if (selected.length === 0) {
        return { suggestion: null } as { suggestion: StructureSuggestion | null };
      }
    }

    const logicInput: SuggestStructureInput = {
      kind,
      patterns: patterns.map((p) => ({
        patternType: p.patternType,
        title: p.title,
        summary: p.summary,
        evidenceCount: p.evidenceCount,
      })),
      memories: selected.map((m) => ({
        memoryId: m.id,
        title: memoryTitle(m),
        excerpt: excerpt(m.userNote ?? m.originalUserNote),
        eventTimeLabel: m.eventTime?.label ?? null,
        location: m.location,
      })),
    };

    const result = await suggestStructureLogic(logicInput);
    return { suggestion: result.suggestion } as { suggestion: StructureSuggestion | null };
  });

function memoryTitle(m: {
  musicExperiences: Array<{ experience: { title: string | null; artist: string | null } }>;
}): string {
  const first = m.musicExperiences[0]?.experience;
  const label =
    [first?.title, first?.artist].filter((p) => p && p.trim().length > 0).join(" — ") ||
    "Untitled memory";
  return label;
}

function excerpt(note: string | null, max = 90): string {
  if (!note) return "";
  const trimmed = note.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

export { STRUCTURE_PROMPT_VERSION, loadMemory };
