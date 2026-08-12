import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildLifeStoryPrompt, deterministicLifeStory } from "@/lib/llm/prompts";
import { runRole } from "@/lib/llm/orchestra";
import type { PersonalityProfile } from "@/lib/ai/types";

const TEST_SONGS = [
  "First Song",
  "Teenage Anthem",
  "Love Theme",
  "Hard Times Track",
  "Power Song",
  "Missing You",
  "Turning Point",
  "Remember Me",
];

const TEST_PROFILE: PersonalityProfile = {
  archetype: "The Keeper",
  title: "You carry every year with you",
  description: "Music is memory for you.",
  emotionalProfile: ["Nostalgia", "Tenderness", "Hope"],
  traits: ["Sentimental", "Loyal", "Vivid-memoried"],
  musicProfile: "Warm — old playlists on repeat",
  recommendedGenres: ["Classic soul", "Retro pop"],
  confidence: 0.82,
  scores: {
    introspection: 0.6,
    nostalgia: 1,
    energy: 0.4,
    melancholy: 0.5,
    hope: 0.7,
    rebellion: 0.3,
    connection: 0.8,
  },
  emotions: {
    dominantEmotion: "Nostalgia",
    secondaryEmotions: ["Tenderness", "Hope"],
    intensity: 0.7,
  },
  music: {
    primaryGenres: ["Classic soul"],
    secondaryGenres: ["Retro pop"],
    mood: "Warm",
    listeningStyle: "Old playlists on repeat",
  },
  poeticSummary: "Your music feels like an old photograph that still smells like summer.",
  poster: {
    headline: "The Keeper",
    subheadline: "You carry every year with you",
    archetype: "The Keeper",
    paletteLabel: "Sunlit memory",
    keywords: ["memory", "loyalty", "warmth"],
  },
};

describe("Life Story prompt construction", () => {
  it("contains every supplied song title", () => {
    const prompt = buildLifeStoryPrompt({ profile: TEST_PROFILE, songs: TEST_SONGS });
    for (const song of TEST_SONGS) {
      expect(prompt).toContain(song);
    }
  });

  it("contains supplied deterministic profile data (archetype, emotions, genres)", () => {
    const prompt = buildLifeStoryPrompt({ profile: TEST_PROFILE, songs: TEST_SONGS });
    expect(prompt).toContain(TEST_PROFILE.archetype);
    expect(prompt).toContain(TEST_PROFILE.emotionalProfile.join(", "));
    expect(prompt).toContain(TEST_PROFILE.recommendedGenres.join(", "));
    expect(prompt).toContain(TEST_PROFILE.archetype);
  });

  it("contains explicit grounding rules against inventing facts", () => {
    const prompt = buildLifeStoryPrompt({ profile: TEST_PROFILE, songs: TEST_SONGS });
    expect(prompt).toContain("Do not invent facts");
    expect(prompt).toContain(
      "Do not invent people, places, locations, dates, times, weather, life events, or memories",
    );
    expect(prompt).toContain("Do not invent song titles or artists");
    expect(prompt).toContain("Use ONLY the information supplied below");
  });

  it("requests narrative prose only (no JSON / markdown headings)", () => {
    const prompt = buildLifeStoryPrompt({ profile: TEST_PROFILE, songs: TEST_SONGS });
    expect(prompt).toContain("Output narrative prose only");
    expect(prompt).toContain("No JSON");
    expect(prompt).toContain("No markdown headings");
  });
});

describe("deterministic Life Story fallback", () => {
  it("interpolates the supplied songs in order", () => {
    const story = deterministicLifeStory(TEST_SONGS);
    expect(story).toContain(TEST_SONGS[0]);
    expect(story).toContain(TEST_SONGS[1]);
    expect(story).toContain(TEST_SONGS[7]);
    // Multi-paragraph (fallback renders paragraphs split on blank line).
    expect(story.split("\n\n").length).toBeGreaterThanOrEqual(3);
  });

  it("falls back to Untitled track N for missing songs", () => {
    const story = deterministicLifeStory(["Only One"]);
    expect(story).toContain("Only One");
    expect(story).toContain("Untitled track");
  });
});

describe("Orchestra runRole failure safety", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Ensure no provider keys are present for failure-path tests.
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns null when the provider key is missing (fallback path)", async () => {
    const result = await runRole("summarizer", "hello");
    expect(result).toBeNull();
  });

  it("returns null on a simulated network error without throwing", async () => {
    // Restore a key so we reach the fetch path, then make fetch throw.
    process.env.GROQ_API_KEY = "test-key";
    const throwingFetch = (() => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const result = await runRole("summarizer", "hello", { fetchImpl: throwingFetch });
    expect(result).toBeNull();
  });

  it("returns null on a non-OK HTTP response without throwing", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const notOkFetch = (async () =>
      new Response("error", { status: 500 })) as unknown as typeof fetch;
    const result = await runRole("summarizer", "hello", { fetchImpl: notOkFetch });
    expect(result).toBeNull();
  });

  it("returns null on an empty/malformed response body without throwing", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const emptyBodyFetch = (async () =>
      new Response(JSON.stringify({ choices: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;
    const result = await runRole("summarizer", "hello", { fetchImpl: emptyBodyFetch });
    expect(result).toBeNull();
  });

  it("returns the assistant text on a well-formed response", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const okFetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "  Once upon a sound.  " } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;
    const result = await runRole("summarizer", "hello", { fetchImpl: okFetch });
    expect(result).toBe("Once upon a sound.");
  });

  it("never returns an API key in its result", async () => {
    process.env.GROQ_API_KEY = "super-secret-key-value";
    const okFetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "narrative" } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )) as unknown as typeof fetch;
    const result = await runRole("summarizer", "hello", { fetchImpl: okFetch });
    expect(result).toBe("narrative");
    expect(JSON.stringify(result)).not.toContain("super-secret-key-value");
  });
});

describe("client bundle key-boundary", () => {
  it("prompts module does not reference any provider key env var", async () => {
    // prompts.ts must be safe to import client-side; it should not mention
    // any provider key environment variable name.
    const moduleText: string = await import("@/lib/llm/prompts?raw").then((m) => m.default);
    expect(moduleText).not.toContain("GROQ_API_KEY");
    expect(moduleText).not.toContain("GEMINI_API_KEY");
    expect(moduleText).not.toContain("MISTRAL_API_KEY");
    expect(moduleText).not.toContain("OPENROUTER_API_KEY");
  });
});
