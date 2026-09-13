import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MOOD_SET } from "./moodInference";
import {
  buildMoodPrompt,
  callGeminiMoodInference,
  parseMoodResponse,
} from "./moodInference.server";

/**
 * moodInference kontrat testleri.
 *
 * Gerçek API çağrısı yapılmaz — `callGeminiMoodInference`'ın `fetchImpl`
 * injectable pattern'i ile mock fetch kullanılır (orchestra.ts'teki desen).
 * `inferMood`'un kendisi bir server fonksiyonu olduğu için, kontratı
 * server modülünün saf parçaları (prompt kurma, parse/validate, fetch çağrısı)
 * üzerinden test ediyoruz — generateAnalysis.server.test.ts'in
 * `callGeminiPoeticAnalyzer`'ı test ettiği desenle aynı.
 */

// `callGeminiMoodInference` (OpenRouter üzerinden) key yoksa fetch'e hiç
// gitmez (null döner) — test ortamında key stub'layarak mock fetch'in gerçekten
// çağrıldığını garanti ederiz.
beforeAll(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

/** Mock fetch: verilen JSON gövdesini choices[0].message.content olarak döner. */
function mockFetchReturning(content: string): typeof fetch {
  return vi.fn(async () => {
    const payload = { choices: [{ message: { content } }] };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("inferMood kontratı", () => {
  it("bilinmeyen bir şarkı için null döner (uydurmaz)", async () => {
    const fetchImpl = mockFetchReturning('{"mood": null}');
    const raw = await callGeminiMoodInference(buildMoodPrompt({ title: "Obscure", artist: "Nobody", genre: null }), { fetchImpl });
    expect(parseMoodResponse(raw)).toBeNull();
  });

  it("dönen değer her zaman 9 kapalı mood setinden biridir (veya null)", async () => {
    // Geçerli mood → sette kalır.
    const fetchImpl = mockFetchReturning('{"mood": "Melancholic"}');
    const raw = await callGeminiMoodInference(buildMoodPrompt({ title: "Fragile", artist: "Sting", genre: "Rock" }), { fetchImpl });
    const mood = parseMoodResponse(raw);
    expect(mood === null || (MOOD_SET as readonly string[]).includes(mood)).toBe(true);

    // Set dışı / halüsinasyon → null'a düşer, asla serbest metin geçmez.
    expect(parseMoodResponse('{"mood": "Sad but also happy"}')).toBeNull();
    expect(parseMoodResponse('{"mood": "FakeMood"}')).toBeNull();
  });

  it("aynı girdi aynı çıktıyı üretir (deterministik)", async () => {
    const fetchImpl = mockFetchReturning('{"mood": "Nostalgic"}');
    const prompt = buildMoodPrompt({ title: "Take On Me", artist: "a-ha", genre: "Synth-pop" });
    const [a, b] = await Promise.all([
      callGeminiMoodInference(prompt, { fetchImpl }),
      callGeminiMoodInference(prompt, { fetchImpl }),
    ]);
    expect(a).toBe(b);
    expect(parseMoodResponse(a)).toBe("Nostalgic");
  });

  it("MOOD_SET, ANA_YASA §5.1'deki 9 mood'u içerir", () => {
    expect(MOOD_SET).toHaveLength(9);
    expect(MOOD_SET).toEqual([
      "Energetic",
      "Euphoric",
      "Playful",
      "Romantic",
      "Melancholic",
      "Dreamy",
      "Nostalgic",
      "Dark",
      "World",
    ]);
  });
});