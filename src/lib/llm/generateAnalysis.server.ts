/**
 * Server-only Poetic Analyzer bridge — routes the Results UI to Gemini.
 *
 * Receives the deterministic PersonalityProfile + songs, builds the grounded
 * poetic-analyzer prompt, calls Gemini via its OpenAI-compatible
 * chat-completions endpoint (native fetch, no SDK), and returns the parsed
 * PoeticAnalysis — or `null` on any failure, so the caller falls back to
 * `deterministicPoeticAnalysis` and the page never breaks.
 *
 * SECURITY:
 *   - TanStack Start server function: runs only on the server.
 *   - The key is read from `GEMINI_API_KEY` — a server-only env var, NEVER
 *     `VITE_`-prefixed. (The `VITE_GEMINI_API_KEY` in gemini.ts is a separate,
 *     client-reachable key for browser-safe features only.)
 *   - No key is ever returned or logged; the return type carries analysis data
 *     only. Every failure path resolves to `{ analysis: null }`.
 */
import { createServerFn } from "@tanstack/react-start";

import type { PersonalityProfile } from "@/lib/ai/types";
import {
  buildPoeticAnalyzerPrompt,
  parsePoeticAnalysis,
  type PoeticAnalysis,
} from "@/lib/llm/poetic-analyzer";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_MODEL = "gemini-2.5-flash";

export type GenerateAnalysisInput = {
  profile: PersonalityProfile;
  songs: string[];
  memories?: (string | null)[];
};

export type GenerateAnalysisOutput = {
  analysis: PoeticAnalysis | null;
};

function getGeminiServerKey(): string | null {
  const value = process.env?.GEMINI_API_KEY;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function extractContent(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0] as { message?: { content?: unknown } };
  const content = first?.message?.content;
  return typeof content === "string" && content.trim().length > 0 ? content : null;
}

/**
 * Call Gemini with the poetic-analyzer prompt. Returns the raw text on
 * success, `null` on any failure. Exported for tests (fetch injectable);
 * never throws, never exposes the key.
 */
export async function callGeminiPoeticAnalyzer(
  prompt: string,
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<string | null> {
  const apiKey = getGeminiServerKey();
  if (!apiKey) return null;

  const fetchImpl = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      signal: options.signal,
      body: JSON.stringify({
        model: GEMINI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a poetic music analyst. You answer with strict JSON only — no markdown, no code fences, no commentary.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 2400,
        response_format: { type: "json_object" },
      }),
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  try {
    return extractContent(await response.json());
  } catch {
    return null;
  }
}

/**
 * Generate the poetic Music Map analysis. `null` means "use the deterministic
 * fallback" (missing key, provider/network error, unrecoverable output).
 */
export const generatePoeticAnalysis = createServerFn({ method: "POST" })
  .validator((input: GenerateAnalysisInput): GenerateAnalysisInput => input)
  .handler(async ({ data }) => {
    const { profile, songs, memories } = data;

    if (!profile || !Array.isArray(songs) || songs.length === 0) {
      return { analysis: null } satisfies GenerateAnalysisOutput;
    }

    try {
      const prompt = buildPoeticAnalyzerPrompt({ profile, songs, memories });
      const raw = await callGeminiPoeticAnalyzer(prompt);
      if (!raw) return { analysis: null } satisfies GenerateAnalysisOutput;
      const analysis = parsePoeticAnalysis(raw, { profile, songs });
      return { analysis } satisfies GenerateAnalysisOutput;
    } catch {
      return { analysis: null } satisfies GenerateAnalysisOutput;
    }
  });
