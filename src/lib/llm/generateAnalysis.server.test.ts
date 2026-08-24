import { describe, expect, it } from "vitest";

import { buildEntryInsightPrompt } from "@/lib/llm/generateAnalysis.server";
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from "@/lib/i18n/languages";

describe("buildEntryInsightPrompt", () => {
  it("grounds the prompt in the supplied song, artist, and memory note", () => {
    const prompt = buildEntryInsightPrompt({
      songTitle: "Nightcall",
      artist: "Kavinsky",
      note: "gece sürüşü",
    });
    expect(prompt).toContain("Song: Nightcall — Kavinsky");
    expect(prompt).toContain('The user\'s own memory note: "gece sürüşü"');
  });

  it("defaults to English when no language is supplied", () => {
    const prompt = buildEntryInsightPrompt({ songTitle: "Nightcall" });
    expect(prompt).toContain("in English");
    expect(prompt).toContain("No memory note supplied.");
  });

  it("instructs Gemini to write the insight in every supported language", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const prompt = buildEntryInsightPrompt({ songTitle: "Duman", language });
      expect(prompt, `prompt for ${language}`).toContain(`in ${LANGUAGE_NAMES[language]}`);
    }
  });

  it("keeps song titles and artist names exempt from translation", () => {
    const prompt = buildEntryInsightPrompt({ songTitle: "Duman", language: "tr" });
    expect(prompt).toContain("Türkçe");
    expect(prompt).toContain("only the song title and artist name stay in their original form");
  });
});
