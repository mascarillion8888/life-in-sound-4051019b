/**
 * Server-only Memory Extraction — bridges the Memory Capture UI to the
 * TypeScript Orchestra.
 *
 * This is the FIRST place where the LLM participates in the Music Memory
 * lifecycle. The flow is:
 *
 *   USER FREE-TEXT → (this fn) → STRUCTURED CANDIDATE → USER CONFIRMATION →
 *   memory-remote.ts → Supabase
 *
 * The AI is an extractor/suggester only. The user remains the source of truth.
 * The original user note is preserved verbatim and never rewritten.
 *
 * SECURITY:
 *   - TanStack Start server function (`createServerFn`); runs only on the
 *     server. The framework routes the client call to the server.
 *   - Provider keys are read inside orchestra.ts from server-only env vars
 *     (never `VITE_`-prefixed). No key is returned or logged here.
 *   - The return type is `ExtractedCandidate | null` — never credentials.
 *   - No LLM call is ever made from the browser; the browser only calls this
 *     server function.
 *
 * ROLE: `researcher` ("Gather concise facts with sources. No filler.") is used
 * rather than `orchestrator` ("Decompose the task, assign sub-tasks..."),
 * because extraction of structured facts from free text is fact-gathering, not
 * task decomposition. No role mapping is modified.
 */
import { createServerFn } from "@tanstack/react-start";

import { runRole } from "@/lib/llm/orchestra";
import { buildExtractionPrompt, parseExtractionResponse } from "@/lib/llm/extractMemory";
import type { ExtractedCandidate } from "@/lib/llm/extractMemory";

export type ExtractMemoryInput = {
  rawUserNote: string;
};

export type ExtractMemoryOutput = {
  candidate: ExtractedCandidate | null;
};

/**
 * Pure extraction logic, separated from the `createServerFn` wrapper so it can
 * be unit-tested without the TanStack Start runtime context. The server fn
 * below is a thin shell that delegates here.
 *
 * Returns `{ candidate }`. `candidate` is null on: empty input, provider
 * unavailable (runRole returns null), network error, or unparseable response.
 * Never throws.
 */
export async function extractMemoryLogic(rawUserNote: string): Promise<ExtractMemoryOutput> {
  if (typeof rawUserNote !== "string" || rawUserNote.trim().length === 0) {
    return { candidate: null } satisfies ExtractMemoryOutput;
  }

  const trustedNote = rawUserNote;
  const prompt = buildExtractionPrompt(trustedNote);

  try {
    const response = await runRole("researcher", prompt, {
      temperature: 0.2,
      maxTokens: 600,
    });
    if (!response) return { candidate: null } satisfies ExtractMemoryOutput;

    const candidate = parseExtractionResponse(response, trustedNote);
    return { candidate } satisfies ExtractMemoryOutput;
  } catch {
    // Any unexpected error → fallback. Never propagate to the UI.
    return { candidate: null } satisfies ExtractMemoryOutput;
  }
}

/**
 * Server function — the browser-facing entry point. It only runs server-side;
 * the framework routes the client call to here. The browser never calls
 * orchestra.runRole directly.
 */
export const extractMemory = createServerFn({ method: "POST" })
  .validator((input: ExtractMemoryInput): ExtractMemoryInput => input)
  .handler(async ({ data }) => {
    return extractMemoryLogic(data.rawUserNote);
  });
