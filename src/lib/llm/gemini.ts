/**
 * Gemini API access (client-reachable features only).
 *
 * The key is read from `import.meta.env.VITE_GEMINI_API_KEY`, which Vite
 * exposes to the browser. Because it is `VITE_`-prefixed it ships in the
 * client bundle — so it must ONLY be used for Gemini features that are safe to
 * call from the browser. Server-only LLM work continues to use the
 * server-side key (e.g. `GROQ_API_KEY`) via `src/lib/llm/orchestra.ts`; that
 * path is intentionally separate and unchanged.
 *
 * If no key is configured, `isGeminiConfigured()` is false and every Gemini
 * feature must stay disabled — never fall back to a fabricated response.
 */

const geminiKey = (): string => (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? "";

/** True when a Gemini API key is configured for client-reachable features. */
export function isGeminiConfigured(): boolean {
  return geminiKey().trim().length > 0;
}

/**
 * The configured Gemini API key, or null when unset. Callers must check
 * `isGeminiConfigured()` (or this for null) before using it and degrade
 * gracefully when absent.
 */
export function getGeminiApiKey(): string | null {
  const key = geminiKey().trim();
  return key.length > 0 ? key : null;
}
