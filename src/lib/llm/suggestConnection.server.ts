/**
 * Server-only AI Connection Suggestion — bridges the Memory Detail UI to the
 * TypeScript Orchestra.
 *
 * The AI may suggest a possible connection between the current memory and one
 * of a small retrieved candidate set. It NEVER persists. The user must
 * explicitly accept/dismiss. AI interpretation is never silently converted
 * into a User Fact.
 *
 * SECURITY:
 *   - TanStack Start server function; server-side only.
 *   - Provider keys read inside orchestra.ts from server-only env vars.
 *   - Returns `{ suggestion: AISuggestedConnection | null }` — no credentials.
 *   - No LLM call from the browser; the browser only calls this server fn.
 *
 * ROLE: `researcher` ("Gather concise facts with sources. No filler.") — the
 * task is comparing supplied memories for a grounded factual/associative
 * connection, not reflective prose (summarizer) or decomposition (orchestrator).
 * No role mapping is modified.
 */
import { createServerFn } from "@tanstack/react-start";

import { runRole } from "@/lib/llm/orchestra";
import {
  buildSuggestConnectionPrompt,
  parseSuggestConnectionResponse,
} from "@/lib/llm/suggestConnection";
import type { SuggestConnectionInput, SuggestConnectionOutput } from "@/lib/llm/suggestConnection";

/**
 * Pure suggestion logic, separated from the `createServerFn` wrapper so it can
 * be unit-tested without the TanStack Start runtime context.
 *
 * Returns `{ suggestion }`. `null` on: empty candidates, provider unavailable,
 * network error, malformed/unparseable response, or a candidate id not among
 * the supplied set. Never throws.
 */
export async function suggestConnectionLogic(
  input: SuggestConnectionInput,
): Promise<SuggestConnectionOutput> {
  if (!input?.memory || !Array.isArray(input.candidates) || input.candidates.length === 0) {
    return { suggestion: null } satisfies SuggestConnectionOutput;
  }

  const validIds = new Set(input.candidates.map((c) => c.id));
  const prompt = buildSuggestConnectionPrompt(input);

  try {
    const response = await runRole("researcher", prompt, {
      temperature: 0.2,
      maxTokens: 400,
    });
    if (!response) return { suggestion: null } satisfies SuggestConnectionOutput;

    const suggestion = parseSuggestConnectionResponse(response, validIds);
    return { suggestion } satisfies SuggestConnectionOutput;
  } catch {
    return { suggestion: null } satisfies SuggestConnectionOutput;
  }
}

/**
 * Server function — the browser-facing entry point. Server-side only; the
 * framework routes the client call to here. The browser never calls
 * orchestra.runRole directly.
 */
export const suggestConnection = createServerFn({ method: "POST" })
  .validator((input: SuggestConnectionInput): SuggestConnectionInput => input)
  .handler(async ({ data }) => {
    return suggestConnectionLogic(data);
  });
