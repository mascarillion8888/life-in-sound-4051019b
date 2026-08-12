/**
 * Server-only Story Engine — bridges the Results UI to the TypeScript Orchestra.
 *
 * Receives the deterministic PersonalityProfile + songs, builds the grounded
 * prompt, calls the Orchestra `summarizer` role, and returns the generated
 * narrative — or `null` on any failure (so the Results page falls back to the
 * deterministic Life Story template and never breaks).
 *
 * SECURITY:
 *   - This is a TanStack Start server function (`createServerFn`); it runs only
 *     on the server. The framework routes the client call to the server.
 *   - Provider keys are read inside orchestra.ts from server-only env vars
 *     (never `VITE_`-prefixed). No key is returned or logged here.
 *   - The return type is `string | null` — never credentials, never metadata.
 */
import { createServerFn } from "@tanstack/react-start";

import type { PersonalityProfile } from "@/lib/ai/types";
import { runRole } from "@/lib/llm/orchestra";
import { buildLifeStoryPrompt } from "@/lib/llm/prompts";

export type GenerateStoryInput = {
  profile: PersonalityProfile;
  songs: string[];
};

export type GenerateStoryOutput = {
  story: string | null;
};

/**
 * Generate an LLM Life Story narrative from the deterministic profile + songs.
 *
 * Returns `{ story: string | null }`. `null` means "use the deterministic
 * fallback" (provider unavailable, missing keys, network error, empty/malformed
 * response). Never throws into the Results page — all failures are caught and
 * surfaced as `null`.
 */
export const generateStory = createServerFn({ method: "POST" })
  .validator((input: GenerateStoryInput): GenerateStoryInput => input)
  .handler(async ({ data }) => {
    const { profile, songs } = data;

    if (!profile || !Array.isArray(songs) || songs.length === 0) {
      return { story: null } satisfies GenerateStoryOutput;
    }

    const prompt = buildLifeStoryPrompt({ profile, songs });

    try {
      const narrative = await runRole("summarizer", prompt, {
        temperature: 0.7,
        maxTokens: 900,
      });
      return { story: narrative } satisfies GenerateStoryOutput;
    } catch {
      // Any unexpected error → fallback. Never propagate to the Results page.
      return { story: null } satisfies GenerateStoryOutput;
    }
  });
