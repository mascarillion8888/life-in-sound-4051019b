/**
 * Server-only mood inference bridge — routes `inferMood` to Gemini.
 *
 * Receives the song identity (title + artist + genre), builds the grounded
 * mood prompt, calls Gemini via its OpenAI-compatible chat-completions endpoint
 * (native fetch, no SDK) with `temperature: 0` for determinism, and returns the
 * parsed mood — or `null` on any failure, so the caller degrades gracefully
 * (the mood-coverage gate falls back honestly; nothing is ever fabricated).
 *
 * SECURITY:
 *   - TanStack Start server function: runs only on the server.
 *   - The key is read from `GEMINI_API_KEY` — a server-only env var, NEVER
 *     `VITE_`-prefixed.
 *   - No key is ever returned or logged; the return type carries the mood only.
 *     Every failure path resolves to `{ mood: null }`.
 */
import { createServerFn } from "@tanstack/react-start";

import type { Song } from "@/lib/song/types";
import { extractJsonObject } from "@/lib/llm/poetic-analyzer";
import { MOOD_SET } from "./moodInference";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_MODEL = "gemini-2.5-flash";

export type InferMoodInput = Pick<Song, "title" | "artist" | "genre">;
export type InferMoodOutput = {
  mood: string | null;
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
 * Call Gemini with the mood prompt. Returns the raw text on success, `null` on
 * any failure. Exported for tests (fetch injectable); never throws, never
 * exposes the key.
 */
export async function callGeminiMoodInference(
  prompt: string,
  options: {
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  } = {},
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
              "You are a music mood analyst. You answer with strict JSON only — no markdown, no code fences, no commentary.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0,
        max_tokens: 64,
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