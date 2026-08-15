/**
 * Server-only Companion Reflection — bridges the Memory Detail UI to the
 * TypeScript Orchestra.
 *
 * The Companion ASSISTS reflection. It is NOT defining the user's memory. The
 * flow is:
 *
 *   USER MEMORY → (this fn) → COMPANION SUGGESTION → USER REVIEWS →
 *   USER DECIDES WHETHER TO SAVE AS A REFLECTION (via memory-remote.ts)
 *
 * The Orchestra returns a suggestion ONLY. It never directly persists the
 * reflection. The user must explicitly confirm/save it.
 *
 * SECURITY:
 *   - TanStack Start server function (`createServerFn`); runs only on the
 *     server. The framework routes the client call to the server.
 *   - Provider keys are read inside orchestra.ts from server-only env vars
 *     (never `VITE_`-prefixed). No key is returned or logged here.
 *   - The return type is `{ reflection: string | null }` — never credentials.
 *   - No LLM call is ever made from the browser; the browser only calls this
 *     server function.
 *
 * ROLE: `summarizer` ("Compress to essentials. Bullet points.") is used because
 * the task is reflective prose grounded in supplied memory context, not
 * research or role decomposition. The summarizer's brevity suits a short,
 * grounded reflection. No role mapping is modified.
 */
import { createServerFn } from "@tanstack/react-start";

import { runRole } from "@/lib/llm/orchestra";
import { buildReflectionPrompt } from "@/lib/llm/reflectOnMemory";
import type { ReflectOnMemoryInput, ReflectOnMemoryOutput } from "@/lib/llm/reflectOnMemory";

/**
 * Pure reflection logic, separated from the `createServerFn` wrapper so it can
 * be unit-tested without the TanStack Start runtime context. The server fn
 * below is a thin shell that delegates here.
 *
 * Returns `{ reflection }`. `reflection` is null on: empty/invalid input,
 * provider unavailable (runRole returns null), network error, or empty
 * response. Never throws.
 */
export async function reflectOnMemoryLogic(
  input: ReflectOnMemoryInput,
): Promise<ReflectOnMemoryOutput> {
  if (!input?.memory) return { reflection: null } satisfies ReflectOnMemoryOutput;

  const prompt = buildReflectionPrompt(input);

  try {
    const suggestion = await runRole("summarizer", prompt, {
      temperature: 0.7,
      maxTokens: 400,
    });
    if (!suggestion) return { reflection: null } satisfies ReflectOnMemoryOutput;
    return { reflection: suggestion } satisfies ReflectOnMemoryOutput;
  } catch {
    // Any unexpected error → fallback. Never propagate to the UI.
    return { reflection: null } satisfies ReflectOnMemoryOutput;
  }
}

/**
 * Server function — the browser-facing entry point. It only runs server-side;
 * the framework routes the client call to here. The browser never calls
 * orchestra.runRole directly.
 */
export const reflectOnMemory = createServerFn({ method: "POST" })
  .validator((input: ReflectOnMemoryInput): ReflectOnMemoryInput => input)
  .handler(async ({ data }) => {
    return reflectOnMemoryLogic(data);
  });
