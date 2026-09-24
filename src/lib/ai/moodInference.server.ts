/**
 * Server-only mood inference bridge — routes `inferMood` to OpenRouter.
 *
 * Receives the song identity (title + artist + genre), builds the grounded
 * mood prompt, calls OpenRouter (`callOpenRouter`) with `temperature: 0` for
 * determinism (primary model, ucuz fallback ile), and returns the parsed mood —
 * or `null` on any failure, so the caller degrades gracefully (the
 * mood-coverage gate falls back honestly; nothing is ever fabricated).
 *
 * SECURITY:
 *   - TanStack Start server function: runs only on the server.
 *   - The key is read by `callOpenRouter` from `OPENROUTER_API_KEY` — a
 *     server-only env var, NEVER `VITE_`-prefixed.
 *   - No key is ever returned or logged; the return type carries the mood only.
 *     Every failure path resolves to `{ mood: null }`.
 */
import { createServerFn } from "@tanstack/react-start";

import type { Song } from "@/lib/song/types";
import { extractJsonObject } from "@/lib/llm/poetic-analyzer";
import { callOpenRouter } from "@/lib/openrouter.server";
import { MOOD_SET } from "./moodInference";

export type InferMoodInput = Pick<Song, "title" | "artist" | "genre">;
export type InferMoodOutput = {
  mood: string | null;
};

/**
 * Build the Gemini prompt for mood inference. Pure string construction — no
 * I/O, no keys. The grounding rule mirrors poetic-analyzer's "the song's own
 * meaning is fair game": the LLM may use its real knowledge of the song, but
 * must return null when unsure — never guess or invent.
 */
export function buildMoodPrompt(song: InferMoodInput): string {
  const artist = song.artist?.trim() ? song.artist : "unknown artist";
  const genre = song.genre?.trim() ? song.genre : "unknown genre";
  return [
    `Song: ${song.title} — ${artist}`,
    `Genre: ${genre}`,
    "",
    "RULES:",
    "1. If you GENUINELY know this song's real, widely-recognized mood or character, choose ONE mood from the closed set below.",
    `2. The only valid moods are: ${MOOD_SET.join(", ")}.`,
    "3. If you are not sure, or you do not recognize the song, return null. NEVER guess or invent a mood.",
    '4. Return strict JSON only: {"mood":"<one of the closed set>"} or {"mood":null}.',
  ].join("\n");
}

/**
 * Parse and validate the raw LLM output against MOOD_SET. Accepts a JSON string
 * (with or without code fences) or an already-decoded object. Any value outside
 * MOOD_SET — malformed JSON, hallucination, whatever — collapses to `null`.
 * Never throws.
 */
export function parseMoodResponse(raw: unknown): string | null {
  const root =
    typeof raw === "string"
      ? extractJsonObject(raw)
      : typeof raw === "object" && raw !== null
        ? (raw as Record<string, unknown>)
        : null;
  if (!root) return null;
  const mood = root.mood;
  if (typeof mood !== "string" || mood.trim().length === 0) return null;
  return (MOOD_SET as readonly string[]).includes(mood) ? mood : null;
}

/**
 * Call OpenRouter with the mood prompt. Returns the raw text on success, `null`
 * on any failure. Exported for tests (fetch injectable); never throws, never
 * exposes the key.
 */
export async function callGeminiMoodInference(
  prompt: string,
  options: {
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  } = {},
): Promise<string | null> {
  return callOpenRouter(
    [
      {
        role: "system",
        content:
          "You are a music mood analyst (never a clinician or diagnostician; you only label a song's mood). You answer with strict JSON only — no markdown, no code fences, no commentary.",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0, maxTokens: 64, jsonMode: true, signal: options.signal, fetchImpl: options.fetchImpl },
  ).catch(() => null);
}

/**
 * Infer a song's mood. `null` means "use the honest fallback" (missing key,
 * provider/network error, unrecoverable or out-of-set output).
 */
export const inferMoodServer = createServerFn({ method: "POST" })
  .validator((input: InferMoodInput): InferMoodInput => input)
  .handler(async ({ data }) => {
    if (!data?.title?.trim()) {
      return { mood: null } satisfies InferMoodOutput;
    }
    try {
      const prompt = buildMoodPrompt(data);
      const raw = await callGeminiMoodInference(prompt, {
        signal: AbortSignal.timeout(8000),
      });
      if (!raw) return { mood: null } satisfies InferMoodOutput;
      const mood = parseMoodResponse(raw);
      return { mood } satisfies InferMoodOutput;
    } catch {
      return { mood: null } satisfies InferMoodOutput;
    }
  });