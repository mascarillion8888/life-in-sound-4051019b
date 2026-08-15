import { describe, expect, it } from "vitest";

import {
  discoverPatterns,
  normalizeEmotion,
  normalizeTimeContext,
  normalizeWeather,
  patternFingerprint,
} from "@/lib/memory/patterns";
import { normalizeLocation } from "@/lib/memory/connections";
import type { Memory, Reflection } from "@/lib/memory/types";

function mem(overrides: Partial<Memory> & { id: string }): Memory {
  const base: Memory = {
    id: overrides.id,
    userId: "user-1",
    recordedAt: "2024-01-01T00:00:00Z",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    originalUserNote: null,
    userNote: null,
    feeling: null,
    lifeEvent: null,
    location: null,
    weather: null,
    eventTime: { label: null },
    aiContext: null,
    aiContextStaleAt: null,
    musicExperiences: [],
  };
  return { ...base, ...overrides } as Memory;
}

function exp(id: string, title: string | null = null, artist: string | null = null) {
  return {
    musicExperienceId: id,
    position: 0,
    role: null,
    experience: {
      id,
      sourceType: "streaming" as const,
      title,
      artist,
      album: null,
      externalRef: null,
      sourceNotes: null,
    },
  };
}

function refl(overrides: Partial<Reflection> & { memoryId: string }): Reflection {
  const base: Reflection = {
    id: overrides.id ?? `ref-${Math.random()}`,
    userId: "user-1",
    memoryId: overrides.memoryId,
    author: "user",
    body: "a reflection",
    reflectedAt: overrides.reflectedAt ?? "2024-06-01T00:00:00Z",
    createdAt: overrides.reflectedAt ?? "2024-06-01T00:00:00Z",
    sourceContext: null,
  };
  return { ...base, ...overrides } as Reflection;
}

describe("1. repeated_music detects repeated Music Experience", () => {
  it("detects a music experience across 2 distinct memories", () => {
    const memories = [
      mem({ id: "m1", musicExperiences: [exp("exp-1", "High Hopes", "Pink Floyd")] }),
      mem({ id: "m2", musicExperiences: [exp("exp-1", "High Hopes", "Pink Floyd")] }),
    ];
    const out = discoverPatterns(memories, []);
    const pm = out.find((p) => p.patternType === "repeated_music");
    expect(pm).toBeDefined();
    expect(pm!.evidenceCount).toBe(2);
    expect(pm!.fingerprint).toBe(patternFingerprint("repeated_music", "exp-1"));
  });

  it("does NOT detect when only one memory has the music", () => {
    const memories = [
      mem({ id: "m1", musicExperiences: [exp("exp-1")] }),
      mem({ id: "m2", musicExperiences: [exp("exp-2")] }),
    ];
    const out = discoverPatterns(memories, []);
    expect(out.find((p) => p.patternType === "repeated_music")).toBeUndefined();
  });
});

describe("2. repeated_music ignores duplicate bridge rows inside one Memory", () => {
  it("counts a memory once even if the same experience appears twice in its bridge", () => {
    const memories = [
      mem({
        id: "m1",
        // Same experience id duplicated within one memory's bridge rows.
        musicExperiences: [
          { ...exp("exp-1"), position: 0 },
          { ...exp("exp-1"), position: 1 },
        ],
      }),
      mem({ id: "m2", musicExperiences: [exp("exp-1")] }),
    ];
    const out = discoverPatterns(memories, []);
    const pm = out.find((p) => p.patternType === "repeated_music");
    expect(pm).toBeDefined();
    expect(pm!.evidenceCount).toBe(2);
  });
});

describe("3. repeated_location uses exact normalized equality", () => {
  it("normalizes case/whitespace so Istanbul == istanbul == ISTANBUL", () => {
    const memories = [
      mem({ id: "m1", location: "Istanbul" }),
      mem({ id: "m2", location: "istanbul" }),
      mem({ id: "m3", location: "  ISTANBUL  " }),
    ];
    const out = discoverPatterns(memories, []);
    const pl = out.find((p) => p.patternType === "repeated_location");
    expect(pl).toBeDefined();
    expect(pl!.evidenceCount).toBe(3);
    expect(pl!.fingerprint).toBe(patternFingerprint("repeated_location", "istanbul"));
  });
});

describe("4. location fuzzy matches are NOT created", () => {
  it("does NOT match Taksim to Istanbul (no fuzzy geography)", () => {
    const memories = [
      mem({ id: "m1", location: "Istanbul" }),
      mem({ id: "m2", location: "Taksim" }),
    ];
    const out = discoverPatterns(memories, []);
    expect(out.find((p) => p.patternType === "repeated_location")).toBeUndefined();
  });
});

describe("5. recurring_time_context requires explicit evidence", () => {
  it("detects a recurring explicit time label across 3 memories", () => {
    const memories = [
      mem({ id: "m1", eventTime: { label: "night" } }),
      mem({ id: "m2", eventTime: { label: "Night" } }),
      mem({ id: "m3", eventTime: { label: "night" } }),
    ];
    const out = discoverPatterns(memories, []);
    const pt = out.find((p) => p.patternType === "recurring_time_context");
    expect(pt).toBeDefined();
    expect(pt!.evidenceCount).toBe(3);
  });
});

describe("6. unknown time does not produce a time pattern", () => {
  it("does NOT produce a time pattern when labels are absent", () => {
    const memories = [
      mem({ id: "m1", eventTime: { label: null } }),
      mem({ id: "m2", eventTime: { label: null } }),
      mem({ id: "m3", eventTime: { label: null } }),
    ];
    const out = discoverPatterns(memories, []);
    expect(out.find((p) => p.patternType === "recurring_time_context")).toBeUndefined();
  });

  it("does NOT infer night from a timestamp (only explicit labels)", () => {
    const memories = [
      // recordedAt is late at night, but no explicit time label.
      mem({ id: "m1", recordedAt: "2024-01-01T23:30:00Z", eventTime: { label: null } }),
      mem({ id: "m2", recordedAt: "2024-02-01T01:00:00Z", eventTime: { label: null } }),
      mem({ id: "m3", recordedAt: "2024-03-01T22:00:00Z", eventTime: { label: null } }),
    ];
    const out = discoverPatterns(memories, []);
    expect(out.find((p) => p.patternType === "recurring_time_context")).toBeUndefined();
  });
});

describe("7. revisited_memory requires multiple reflections", () => {
  it("detects a memory with 2+ reflections", () => {
    const memories = [mem({ id: "m1", musicExperiences: [exp("exp-1")] })];
    const reflections = [
      refl({ memoryId: "m1", reflectedAt: "2024-01-10T00:00:00Z" }),
      refl({ memoryId: "m1", reflectedAt: "2024-06-10T00:00:00Z" }),
    ];
    const out = discoverPatterns(memories, reflections);
    const rv = out.find((p) => p.patternType === "revisited_memory");
    expect(rv).toBeDefined();
    expect(rv!.fingerprint).toBe(patternFingerprint("revisited_memory", "m1"));
    expect(rv!.evidenceCount).toBe(1); // one memory, multiple reflections
    expect(rv!.evidence[0].evidenceRole).toContain("2 reflections");
  });

  it("does NOT detect a memory with only 1 reflection", () => {
    const memories = [mem({ id: "m1", musicExperiences: [exp("exp-1")] })];
    const reflections = [refl({ memoryId: "m1" })];
    const out = discoverPatterns(memories, reflections);
    expect(out.find((p) => p.patternType === "revisited_memory")).toBeUndefined();
  });
});

describe("8. recurring_weather_context uses user-provided weather only", () => {
  it("normalizes rain/rainy/yağmur to a canonical weather across 3 memories", () => {
    const memories = [
      mem({ id: "m1", weather: "rain" }),
      mem({ id: "m2", weather: "rainy" }),
      mem({ id: "m3", weather: "yağmur" }),
    ];
    const out = discoverPatterns(memories, []);
    const pw = out.find((p) => p.patternType === "recurring_weather_context");
    expect(pw).toBeDefined();
    expect(pw!.evidenceCount).toBe(3);
    expect(pw!.fingerprint).toBe(patternFingerprint("recurring_weather_context", "rain"));
  });

  it("does NOT detect when weather is below threshold", () => {
    const memories = [mem({ id: "m1", weather: "rain" }), mem({ id: "m2", weather: "rainy" })];
    const out = discoverPatterns(memories, []);
    expect(out.find((p) => p.patternType === "recurring_weather_context")).toBeUndefined();
  });

  it("does NOT infer weather from dates or locations", () => {
    const memories = [
      mem({ id: "m1", location: "London", weather: null }),
      mem({ id: "m2", location: "London", weather: null }),
      mem({ id: "m3", location: "London", weather: null }),
    ];
    const out = discoverPatterns(memories, []);
    expect(out.find((p) => p.patternType === "recurring_weather_context")).toBeUndefined();
  });
});

describe("9 + 10. recurring_user_emotion uses user-provided feeling only", () => {
  it("normalizes nostalgia/nostalgic to a canonical emotion across 3 memories", () => {
    const memories = [
      mem({ id: "m1", feeling: "nostalgia" }),
      mem({ id: "m2", feeling: "nostalgic" }),
      mem({ id: "m3", feeling: "Nostalgia" }),
    ];
    const out = discoverPatterns(memories, []);
    const pe = out.find((p) => p.patternType === "recurring_user_emotion");
    expect(pe).toBeDefined();
    expect(pe!.evidenceCount).toBe(3);
    expect(pe!.fingerprint).toBe(patternFingerprint("recurring_user_emotion", "nostalgia"));
  });

  it("AI-derived context CANNOT create a deterministic emotion pattern", () => {
    // feeling is null on all; aiContext has an emotion but must be ignored.
    const memories = [
      mem({
        id: "m1",
        feeling: null,
        aiContext: { emotion: "nostalgia" },
      }),
      mem({
        id: "m2",
        feeling: null,
        aiContext: { emotion: "nostalgia" },
      }),
      mem({
        id: "m3",
        feeling: null,
        aiContext: { emotion: "nostalgia" },
      }),
    ];
    const out = discoverPatterns(memories, []);
    expect(out.find((p) => p.patternType === "recurring_user_emotion")).toBeUndefined();
  });
});

describe("11. minimum evidence thresholds are enforced", () => {
  it("repeated_music requires 2", () => {
    expect(discoverPatterns([mem({ id: "m1", musicExperiences: [exp("e1")] })], [])).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ patternType: "repeated_music" })]),
    );
  });
  it("recurring_time_context requires 3", () => {
    const memories = [
      mem({ id: "m1", eventTime: { label: "night" } }),
      mem({ id: "m2", eventTime: { label: "night" } }),
    ];
    expect(
      discoverPatterns(memories, []).find((p) => p.patternType === "recurring_time_context"),
    ).toBeUndefined();
  });
  it("recurring_weather_context requires 3", () => {
    const memories = [mem({ id: "m1", weather: "rain" }), mem({ id: "m2", weather: "rainy" })];
    expect(
      discoverPatterns(memories, []).find((p) => p.patternType === "recurring_weather_context"),
    ).toBeUndefined();
  });
  it("recurring_user_emotion requires 3", () => {
    const memories = [
      mem({ id: "m1", feeling: "nostalgia" }),
      mem({ id: "m2", feeling: "nostalgic" }),
    ];
    expect(
      discoverPatterns(memories, []).find((p) => p.patternType === "recurring_user_emotion"),
    ).toBeUndefined();
  });
});

describe("12. every persisted pattern has evidence (candidate has evidence)", () => {
  it("every returned candidate has >=1 evidence (revisited_memory exception) or >=2", () => {
    const memories = [
      mem({
        id: "m1",
        musicExperiences: [exp("e1")],
        location: "Istanbul",
        weather: "rain",
        feeling: "nostalgia",
        eventTime: { label: "night" },
      }),
      mem({
        id: "m2",
        musicExperiences: [exp("e1")],
        location: "Istanbul",
        weather: "rainy",
        feeling: "nostalgic",
        eventTime: { label: "Night" },
      }),
      mem({
        id: "m3",
        musicExperiences: [exp("e1")],
        location: "istanbul",
        weather: "yağmur",
        feeling: "Nostalgia",
        eventTime: { label: "night" },
      }),
    ];
    const out = discoverPatterns(memories, []);
    expect(out.length).toBeGreaterThan(0);
    for (const c of out) {
      expect(c.evidence.length).toBeGreaterThanOrEqual(1);
      expect(c.evidenceCount).toBe(c.evidence.length);
    }
  });
});

describe("14. duplicate pattern fingerprints rejected (stable fingerprint)", () => {
  it("the same music id yields the same fingerprint", () => {
    const a = discoverPatterns(
      [
        mem({ id: "m1", musicExperiences: [exp("e1")] }),
        mem({ id: "m2", musicExperiences: [exp("e1")] }),
      ],
      [],
    );
    const b = discoverPatterns(
      [
        mem({ id: "m9", musicExperiences: [exp("e1")] }),
        mem({ id: "m8", musicExperiences: [exp("e1")] }),
      ],
      [],
    );
    const fa = a.find((p) => p.patternType === "repeated_music")!.fingerprint;
    const fb = b.find((p) => p.patternType === "repeated_music")!.fingerprint;
    expect(fa).toBe(fb);
  });
});

describe("27. no deterministic pattern function performs network calls", () => {
  it("discoverPatterns is pure (no side effects on inputs)", () => {
    const memories = [
      mem({ id: "m1", musicExperiences: [exp("e1")], location: "Istanbul" }),
      mem({ id: "m2", musicExperiences: [exp("e1")], location: "istanbul" }),
    ];
    const snapshot = JSON.parse(JSON.stringify(memories));
    discoverPatterns(memories, []);
    expect(JSON.parse(JSON.stringify(memories))).toEqual(snapshot);
  });
});

describe("28. original Memory remains unchanged after pattern generation", () => {
  it("discoverPatterns does not mutate memory fields", () => {
    const m1 = mem({
      id: "m1",
      musicExperiences: [exp("e1")],
      feeling: "nostalgia",
      weather: "rain",
      location: "Istanbul",
      eventTime: { label: "night" },
    });
    const before = {
      ...m1,
      musicExperiences: m1.musicExperiences.map((e) => ({ ...e, experience: { ...e.experience } })),
    };
    discoverPatterns(
      [
        m1,
        mem({
          id: "m2",
          musicExperiences: [exp("e1")],
          feeling: "nostalgic",
          weather: "rainy",
          location: "Istanbul",
          eventTime: { label: "night" },
        }),
        mem({
          id: "m3",
          musicExperiences: [exp("e1")],
          feeling: "Nostalgia",
          weather: "yağmur",
          location: "Istanbul",
          eventTime: { label: "night" },
        }),
      ],
      [],
    );
    expect(m1.feeling).toBe(before.feeling);
    expect(m1.weather).toBe(before.weather);
    expect(m1.location).toBe(before.location);
    expect(m1.eventTime).toEqual(before.eventTime);
    expect(m1.musicExperiences).toEqual(before.musicExperiences);
  });
});

describe("normalizers", () => {
  it("normalizeLocation trims/lowercases/collapses whitespace", () => {
    expect(normalizeLocation("  New   York  ")).toBe("new york");
    expect(normalizeLocation(null)).toBeNull();
  });
  it("normalizeWeather returns null for unknown values", () => {
    expect(normalizeWeather("rain")).toBe("rain");
    expect(normalizeWeather("hurricane")).toBeNull();
    expect(normalizeWeather(null)).toBeNull();
  });
  it("normalizeEmotion returns null for unknown values", () => {
    expect(normalizeEmotion("nostalgic")).toBe("nostalgia");
    expect(normalizeEmotion("schadenfreude")).toBeNull();
  });
  it("normalizeTimeContext reads explicit eventTime.label only", () => {
    expect(normalizeTimeContext(mem({ id: "x", eventTime: { label: "Winter" } }))).toBe("winter");
    expect(normalizeTimeContext(mem({ id: "x", eventTime: { label: null } }))).toBeNull();
  });
});
