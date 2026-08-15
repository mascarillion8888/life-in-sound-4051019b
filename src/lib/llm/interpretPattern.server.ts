/**
 * Server-only Pattern Interpretation — bridges the Pattern UI to the
 * TypeScript Orchestra.
 *
 * The Orchestra turns deterministic evidence into a careful interpretation. It
 * is advisory and NEVER becomes a user fact. The interpretation is stored ONLY
 * in patterns.interpretation; it never modifies memories, reflections,
 * music_experiences, or pattern evidence.
 *
 * SECURITY:
 *   - TanStack Start server function; server-side only.
 *   - Provider keys read inside orchestra.ts from server-only env vars.
 *   - The server fn verifies ownership of all evidence memories supplied to
 *     the LLM before building the prompt. It NEVER accepts arbitrary memory
 *     ids from the browser without an ownership check.
 *   - Returns `{ interpretation: string | null, patternId: string | null }`.
 *     No credentials.
 *   - No LLM call from the browser; the browser only calls this server fn.
 *
 * ROLE: `summarizer` ("Compress to essentials. Bullet points.") — the task is
 * turning deterministic evidence into a careful human-readable interpretation.
 * No role mapping is modified.
 *
 * REFRESH BEHAVIOR: interpretation is generated ONLY when the user explicitly
 * chooses Explore. The server fn does not auto-spend tokens on every pattern.
 */
import { createServerFn } from "@tanstack/react-start";

import { runRole } from "@/lib/llm/orchestra";
import {
  INTERPRETATION_PROMPT_VERSION,
  buildInterpretPatternPrompt,
  parseInterpretPatternResponse,
} from "@/lib/llm/interpretPattern";
import type { InterpretPatternInput, InterpretPatternOutput } from "@/lib/llm/interpretPattern";
import {
  loadPattern,
  loadPatternRelatedMemories,
  savePatternInterpretation,
} from "@/lib/supabase/patterns-remote";

/**
 * Pure interpretation logic, separated from the `createServerFn` wrapper so it
 * can be unit-tested without the TanStack Start runtime context.
 *
 * Returns `{ interpretation }`. `null` on: empty input, provider unavailable
 * (runRole returns null), network error, or malformed response. Never throws.
 */
export async function interpretPatternLogic(
  input: InterpretPatternInput,
): Promise<InterpretPatternOutput> {
  if (!input?.pattern) return { interpretation: null } satisfies InterpretPatternOutput;

  const prompt = buildInterpretPatternPrompt(input);

  try {
    const response = await runRole("summarizer", prompt, {
      temperature: 0.5,
      maxTokens: 300,
    });
    if (!response) return { interpretation: null } satisfies InterpretPatternOutput;

    const interpretation = parseInterpretPatternResponse(response);
    return { interpretation } satisfies InterpretPatternOutput;
  } catch {
    return { interpretation: null } satisfies InterpretPatternOutput;
  }
}

/**
 * Server function — the browser-facing entry point. Given a patternId, it:
 *   1. Loads the pattern (ownership-verified via .eq user_id + RLS).
 *   2. Loads the evidence memories (ownership-verified).
 *   3. Builds a grounded prompt from ONLY those owned evidence memories.
 *   4. Calls the Orchestra.
 *   5. Persists the interpretation to patterns.interpretation ONLY.
 *
 * Never accepts arbitrary memory ids from the browser; it derives the evidence
 * from the owned pattern. Returns { interpretation, patternId }.
 */
export const interpretPattern = createServerFn({ method: "POST" })
  .validator((input: { userId: string; patternId: string }) => input)
  .handler(async ({ data }) => {
    const { userId, patternId } = data;

    // 1. Ownership-verified pattern load.
    const pattern = await loadPattern(userId, patternId);
    if (!pattern) {
      return { interpretation: null, patternId: null } as {
        interpretation: string | null;
        patternId: string | null;
      };
    }

    // 2. Ownership-verified evidence memories.
    const related = await loadPatternRelatedMemories(userId, patternId);

    // 3. Build grounded input from owned evidence only.
    const logicInput: InterpretPatternInput = {
      pattern: {
        patternType: pattern.patternType,
        title: pattern.title,
        summary: pattern.summary,
        evidenceCount: pattern.evidenceCount,
        observedFrom: pattern.observedFrom,
        observedTo: pattern.observedTo,
      },
      relatedMemories: related.map((m) => ({
        title: m.title,
        excerpt: m.excerpt,
        eventTimeLabel: m.eventTimeLabel,
      })),
    };

    // 4. Call Orchestra.
    const result = await interpretPatternLogic(logicInput);
    if (!result.interpretation) {
      return { interpretation: null, patternId } as {
        interpretation: string | null;
        patternId: string | null;
      };
    }

    // 5. Persist to interpretation_* fields ONLY.
    const model = "summarizer";
    const saved = await savePatternInterpretation(
      userId,
      patternId,
      result.interpretation,
      model,
      INTERPRETATION_PROMPT_VERSION,
    );
    if (!saved) {
      return { interpretation: null, patternId } as {
        interpretation: string | null;
        patternId: string | null;
      };
    }

    return { interpretation: result.interpretation, patternId } as {
      interpretation: string | null;
      patternId: string | null;
    };
  });
