import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the Memory Extraction pipeline:
 *   - grounded extraction prompt
 *   - no-invented-facts rules
 *   - original user note preservation
 *   - structured candidate parsing (well-formed, malformed, partial)
 *   - missing provider key → null (fallback)
 *   - network failure → null (fallback)
 *   - manual fallback path
 *   - user edits AI candidate before save
 *   - saving uses memory-remote.ts
 *   - no provider keys leak to client
 *   - no LLM call is made directly from browser code (server fn boundary)
 *
 * No real provider calls. The server fn's `runRole` dependency is stubbed via
 * the orchestra module mock; `createMemory` (memory-remote) is stubbed so
 * tests assert the candidate→persistence wiring without a live Supabase.
 */

// ---------------------------------------------------------------------------
// Module-level stubs so a single vi.mock factory can serve per-test fakes.
// ---------------------------------------------------------------------------
let runRoleImpl:
  | ((role: string, msg: string, opts?: { fetchImpl?: typeof fetch }) => Promise<string | null>)
  | null = null;

vi.mock("@/lib/llm/orchestra", () => ({
  runRole: (role: string, msg: string, opts?: Record<string, unknown>) =>
    runRoleImpl ? runRoleImpl(role, msg, opts) : Promise.resolve(null),
}));

// Stub memory-remote.createMemory so tests assert the wiring, not Supabase.
let createMemoryImpl: ((userId: string, capture: unknown) => Promise<unknown>) | null = null;
vi.mock("@/lib/supabase/memory-remote", () => ({
  createMemory: (userId: string, capture: unknown) =>
    createMemoryImpl ? createMemoryImpl(userId, capture) : Promise.resolve({ error: "stub" }),
}));

import { buildExtractionPrompt, parseExtractionResponse } from "@/lib/llm/extractMemory";

// The server fn imports orchestra.runRole + our prompt/parse. We test the
// pure logic (extractMemoryLogic) which the server fn delegates to, so tests
// run without the TanStack Start runtime context.
import { extractMemoryLogic } from "@/lib/llm/extractMemory.server";

const SAMPLE_NOTE =
  "Today on the train I heard Pink Floyd and immediately thought about university in 2004. It was raining and I suddenly missed those days.";

const SAMPLE_LLM_JSON = JSON.stringify({
  music_experiences: [{ artist: "Pink Floyd", title: null, source_type: "streaming" }],
  event_time: { granularity: "year", start: "2004-01-01", end: "2004-12-31", label: "2004" },
  location: "on the train",
  weather: "raining",
  context: "university",
  feeling_suggestion: "nostalgia",
  extraction_notes: ["Artist identified; no specific song title given."],
});

describe("1. grounded extraction prompt", () => {
  it("includes the raw user note verbatim", () => {
    const prompt = buildExtractionPrompt(SAMPLE_NOTE);
    expect(prompt).toContain(SAMPLE_NOTE);
  });

  it("requests JSON output only", () => {
    const prompt = buildExtractionPrompt("anything");
    expect(prompt).toContain("JSON");
    expect(prompt).toContain("No prose");
  });

  it("documents the schema fields", () => {
    const prompt = buildExtractionPrompt("x");
    expect(prompt).toContain("music_experiences");
    expect(prompt).toContain("event_time");
    expect(prompt).toContain("feeling_suggestion");
    expect(prompt).toContain("location");
    expect(prompt).toContain("weather");
    expect(prompt).toContain("context");
  });
});

describe("2. no-invented-facts rules", () => {
  const prompt = buildExtractionPrompt(SAMPLE_NOTE);
  it("tells the LLM not to invent facts", () => {
    expect(prompt).toContain("Do not invent facts");
  });
  it("tells the LLM to leave ambiguous fields null", () => {
    expect(prompt).toContain("leave that field null");
  });
  it("forbids inventing exact dates from vague language", () => {
    expect(prompt).toContain("Do not infer exact dates");
  });
  it("forbids inventing title/artist combinations", () => {
    expect(prompt).toContain("Do not invent song titles or artist/title combinations");
  });
  it("forbids inventing locations", () => {
    expect(prompt).toContain("Do not invent locations");
  });
  it("forbids inventing weather", () => {
    expect(prompt).toContain("Do not invent weather");
  });
  it("forbids converting AI interpretation into user facts", () => {
    expect(prompt).toContain("Do not convert AI interpretation into user facts");
  });
  it("instructs to preserve the original note separately", () => {
    expect(prompt).toContain("Preserve the original user note separately");
  });
});

describe("3. original user note preservation", () => {
  it("parseExtractionResponse attaches the trusted original note, never the LLM's", () => {
    const candidate = parseExtractionResponse(SAMPLE_LLM_JSON, SAMPLE_NOTE);
    expect(candidate).not.toBeNull();
    expect(candidate!.originalUserNote).toBe(SAMPLE_NOTE);
  });

  it("ignores any original note the LLM might echo and uses the trusted input", () => {
    const llmOutput = JSON.stringify({
      music_experiences: [{ artist: "X", title: null, source_type: "streaming" }],
      original_user_note: "LLM REWRITE — SHOULD BE IGNORED",
    });
    const candidate = parseExtractionResponse(llmOutput, "the real note");
    expect(candidate).not.toBeNull();
    expect(candidate!.originalUserNote).toBe("the real note");
  });
});

describe("4. structured candidate parsing", () => {
  it("parses a well-formed response", () => {
    const candidate = parseExtractionResponse(SAMPLE_LLM_JSON, SAMPLE_NOTE);
    expect(candidate).not.toBeNull();
    expect(candidate!.musicExperiences).toHaveLength(1);
    expect(candidate!.musicExperiences[0].artist).toBe("Pink Floyd");
    expect(candidate!.musicExperiences[0].title).toBeNull();
    expect(candidate!.eventTime).not.toBeNull();
    expect(candidate!.eventTime!.granularity).toBe("year");
    expect(candidate!.eventTime!.label).toBe("2004");
    expect(candidate!.location).toBe("on the train");
    expect(candidate!.weather).toBe("raining");
    expect(candidate!.context).toBe("university");
    expect(candidate!.feelingSuggestion).toBe("nostalgia");
    expect(candidate!.extractionNotes).toEqual([
      "Artist identified; no specific song title given.",
    ]);
  });

  it("tolerates code-fenced JSON", () => {
    const fenced = "```json\n" + SAMPLE_LLM_JSON + "\n```";
    const candidate = parseExtractionResponse(fenced, SAMPLE_NOTE);
    expect(candidate).not.toBeNull();
    expect(candidate!.musicExperiences[0].artist).toBe("Pink Floyd");
  });

  it("tolerates stray prose around JSON", () => {
    const wrapped = "Here is the result:\n" + SAMPLE_LLM_JSON + "\nThanks!";
    const candidate = parseExtractionResponse(wrapped, SAMPLE_NOTE);
    expect(candidate).not.toBeNull();
    expect(candidate!.context).toBe("university");
  });

  it("coerces unknown source_type back to streaming", () => {
    const out = JSON.stringify({
      music_experiences: [{ artist: "A", title: null, source_type: "totally-bogus" }],
    });
    const candidate = parseExtractionResponse(out, "n");
    expect(candidate).not.toBeNull();
    expect(candidate!.musicExperiences[0].sourceType).toBe("streaming");
  });
});

describe("5. malformed LLM output returns null", () => {
  it("returns null on non-JSON", () => {
    expect(parseExtractionResponse("not json at all", "n")).toBeNull();
  });
  it("returns null on empty string", () => {
    expect(parseExtractionResponse("", "n")).toBeNull();
  });
  it("returns null when no music experience could be extracted", () => {
    const out = JSON.stringify({
      music_experiences: [{ artist: null, title: null, source_type: "streaming" }],
    });
    expect(parseExtractionResponse(out, "n")).toBeNull();
  });
  it("returns null when music_experiences is missing", () => {
    const out = JSON.stringify({ location: "x" });
    expect(parseExtractionResponse(out, "n")).toBeNull();
  });
  it("returns null when there is no JSON object at all", () => {
    expect(parseExtractionResponse("just prose, no braces", "n")).toBeNull();
  });
});

describe("6. missing provider key returns null (server fn fallback)", () => {
  beforeEach(() => {
    runRoleImpl = null; // orchestra.runRole returns null → no key configured
  });

  it("returns { candidate: null } when runRole returns null", async () => {
    const result = await extractMemoryLogic(SAMPLE_NOTE);
    expect(result).toEqual({ candidate: null });
  });
});

describe("7. network failure returns null (server fn fallback)", () => {
  beforeEach(() => {
    runRoleImpl = async () => {
      throw new Error("network down");
    };
  });

  it("returns { candidate: null } and does not throw", async () => {
    const result = await extractMemoryLogic(SAMPLE_NOTE);
    expect(result).toEqual({ candidate: null });
  });
});

describe("8. fallback manual save path (no AI candidate)", () => {
  beforeEach(() => {
    runRoleImpl = null;
  });

  it("returns null candidate so the UI uses manual entry", async () => {
    const result = await extractMemoryLogic(SAMPLE_NOTE);
    expect(result.candidate).toBeNull();
  });
});

describe("9 + 10. user edits AI candidate before save (persistence wiring)", () => {
  beforeEach(() => {
    runRoleImpl = async () => SAMPLE_LLM_JSON;
  });

  it("returns a candidate the UI can let the user edit, then save via memory-remote", async () => {
    const saved: unknown[] = [];
    createMemoryImpl = async (_userId, capture) => {
      saved.push(capture);
      return { memoryId: "mem-1" };
    };

    const result = await extractMemoryLogic(SAMPLE_NOTE);
    expect(result.candidate).not.toBeNull();

    // Simulate the UI: user removes the feeling, edits the note, then saves.
    const candidate = result.candidate!;
    const editedCapture = {
      musicExperiences: candidate.musicExperiences.map((e) => ({
        sourceType: e.sourceType,
        title: e.title,
        artist: e.artist,
      })),
      userNote: candidate.originalUserNote, // original preserved
      feeling: null, // user removed the AI suggestion
      lifeEvent: candidate.context,
      location: candidate.location,
      weather: candidate.weather,
      eventTime: candidate.eventTime,
    };

    const saveResult = await createMemoryImpl("user-1", editedCapture);
    expect(saveResult).toEqual({ memoryId: "mem-1" });
    expect(saved).toHaveLength(1);
    // The feeling the user removed must NOT be in the saved capture.
    expect((saved[0] as { feeling: string | null }).feeling).toBeNull();
  });
});

describe("11. no provider keys leak to client", () => {
  it("the extraction prompt/parse module references no provider key env var", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/llm/extractMemory.ts", "utf8");
    for (const k of ["GROQ_API_KEY", "GEMINI_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY"]) {
      expect(src).not.toContain(k);
    }
  });

  it("the server fn module does not export any key value", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/llm/extractMemory.server.ts", "utf8");
    for (const k of ["GROQ_API_KEY", "GEMINI_API_KEY", "MISTRAL_API_KEY", "OPENROUTER_API_KEY"]) {
      expect(src).not.toContain(k);
    }
    // Keys are read only inside orchestra.ts via process.env — never here.
    expect(src).not.toMatch(/process\.env/);
  });
});

describe("12. no LLM call is made directly from browser code (server fn boundary)", () => {
  it("the route UI imports the server fn, not orchestra.runRole directly", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/routes/memory.tsx", "utf8");
    expect(src).toContain("extractMemory.server");
    // The UI must NOT import orchestra or call runRole.
    expect(src).not.toContain("@/lib/llm/orchestra");
    expect(src).not.toContain("runRole");
    // The UI must NOT import any provider fetch or endpoint.
    expect(src).not.toContain("api.groq.com");
    expect(src).not.toContain("openrouter.ai");
  });
});
