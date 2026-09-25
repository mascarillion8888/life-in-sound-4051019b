import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildLifeStoryPrompt, deterministicLifeStory } from "@/lib/llm/prompts";
import { runRole } from "@/lib/llm/orchestra";
import { buildPosterModel } from "@/lib/ai/posterModel";
import type { EmotionProfile, MusicProfile, PersonalityProfile } from "@/lib/ai/types";

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

const TEST_EMOTIONS: EmotionProfile = {
  dominantEmotion: "Nostalgia",
  secondaryEmotions: ["Tenderness", "Hope"],
  intensity: 0.7,
};

const TEST_MUSIC: MusicProfile = {
  primaryGenres: ["Classic soul"],
  secondaryGenres: ["Retro pop"],
  mood: "Warm",
  listeningStyle: "Old playlists on repeat",
};

// poster is derived via buildPosterModel — single source of truth so the
// required visual: PosterVisual field (added in c9fb515) can never drift.
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
  emotions: TEST_EMOTIONS,
  music: TEST_MUSIC,
  poeticSummary: "Your music feels like an old photograph that still smells like summer.",
  poster: buildPosterModel(
    "The Keeper",
    "You carry every year with you",
    TEST_EMOTIONS,
    TEST_MUSIC,
  ),
};

/**
 * Every prompt-shape test uses the same single fixture prompt — build it
 * once instead of repeating `buildLifeStoryPrompt({...})` per assertion
 * block (SonarCloud duplication).
 */
const PROMPT = buildLifeStoryPrompt({ profile: TEST_PROFILE, songs: TEST_SONGS });

describe("Life Story prompt construction", () => {
  it("contains every supplied song title", () => {
    for (const song of TEST_SONGS) {
      expect(PROMPT).toContain(song);
    }
  });

  it("contains supplied deterministic profile data (archetype, emotions, genres)", () => {
    expect(PROMPT).toContain(TEST_PROFILE.archetype);
    expect(PROMPT).toContain(TEST_PROFILE.emotionalProfile.join(", "));
    expect(PROMPT).toContain(TEST_PROFILE.recommendedGenres.join(", "));
  });

  it("contains explicit grounding rules against inventing facts", () => {
    expect(PROMPT).toContain("Do not invent facts");
    expect(PROMPT).toContain(
      "Do not invent people, places, locations, dates, times, weather, life events, or memories",
    );
    expect(PROMPT).toContain("Do not invent song titles or artists");
    expect(PROMPT).toContain("Use ONLY the information supplied below");
  });

  it("carries the tanı-yasağı (non-diagnostic) + anti-cliché identity rules", () => {
    expect(PROMPT).toContain("never a clinician, therapist, or diagnostician");
    expect(PROMPT).toContain("Maps of feeling are reflections, not diagnoses");
    expect(PROMPT).toContain("never as medical evidence");
    expect(PROMPT).toContain("no horoscope-generic, fortune-cookie");
    expect(PROMPT).toContain("specific to THIS song set and THIS profile");
  });

  it("allows real-world knowledge of supplied songs/albums but forbids inventing the user's life", () => {
    // Real, known meaning of a song/album is fair game — NOT fabrication.
    expect(PROMPT).toContain("USE IT to enrich the interpretation");
    expect(PROMPT).toContain("the song's own meaning is fair game");
    // The user's biography is still off-limits.
    expect(PROMPT).toContain("invent facts about the USER's personal life");
    expect(PROMPT).toContain("the user's biography is not");
  });

  it("asks the model to draw on a recognized song's real themes in the TASK block", () => {
    expect(PROMPT).toContain("draw on its real, known themes and emotional tone");
    expect(PROMPT).toContain("without pretending to know it");
  });

  it("requests narrative prose only (no JSON / markdown headings)", () => {
    expect(PROMPT).toContain("Output narrative prose only");
    expect(PROMPT).toContain("No JSON");
    expect(PROMPT).toContain("No markdown headings");
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

  /**
   * Mock fetch factory: builds a `typeof fetch` returning the given payload
   * shape. `mode: "ok" | "http-error" | "empty-body"`, or a thrower.
   */
  function mockFetch(
    mode: "ok" | "http-error" | "empty-body" | "throw",
    content = "narrative",
  ): typeof fetch {
    if (mode === "throw") {
      return (() => {
        throw new Error("network down");
      }) as unknown as typeof fetch;
    }
    if (mode === "http-error") {
      return (async () => new Response("error", { status: 500 })) as unknown as typeof fetch;
    }
    const body = mode === "empty-body" ? { choices: [] } : { choices: [{ message: { content } }] };
    return (async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch;
  }

  it("returns null when the provider key is missing (fallback path)", async () => {
    const result = await runRole("summarizer", "hello");
    expect(result).toBeNull();
  });

  it("returns null on a simulated network error without throwing", async () => {
    // Restore a key so we reach the fetch path, then make fetch throw.
    process.env.GROQ_API_KEY = "test-key";
    const result = await runRole("summarizer", "hello", { fetchImpl: mockFetch("throw") });
    expect(result).toBeNull();
  });

  it("returns null on a non-OK HTTP response without throwing", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const result = await runRole("summarizer", "hello", { fetchImpl: mockFetch("http-error") });
    expect(result).toBeNull();
  });

  it("returns null on an empty/malformed response body without throwing", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const result = await runRole("summarizer", "hello", { fetchImpl: mockFetch("empty-body") });
    expect(result).toBeNull();
  });

  it("returns the assistant text on a well-formed response", async () => {
    process.env.GROQ_API_KEY = "test-key";
    const result = await runRole("summarizer", "hello", {
      fetchImpl: mockFetch("ok", "  Once upon a sound.  "),
    });
    expect(result).toBe("Once upon a sound.");
  });

  it("never returns an API key in its result", async () => {
    process.env.GROQ_API_KEY = "super-secret-key-value";
    const result = await runRole("summarizer", "hello", {
      fetchImpl: mockFetch("ok", "narrative"),
    });
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
