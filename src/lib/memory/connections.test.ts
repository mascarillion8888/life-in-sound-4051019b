import { describe, expect, it } from "vitest";

import {
  connectionKey,
  discoverDeterministicConnections,
  normalizeLocation,
  normalizePair,
  timesOverlap,
} from "@/lib/memory/connections";
import type { Memory } from "@/lib/memory/types";

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

function exp(id: string) {
  return {
    musicExperienceId: id,
    position: 0,
    role: null,
    experience: {
      id,
      sourceType: "streaming" as const,
      title: null,
      artist: null,
      album: null,
      externalRef: null,
      sourceNotes: null,
    },
  };
}

describe("1. same Music Experience creates deterministic connection candidate", () => {
  it("discovers same_music when two memories share a Music Experience", () => {
    const source = mem({ id: "mem-a", musicExperiences: [exp("exp-1")] });
    const other = mem({ id: "mem-b", musicExperiences: [exp("exp-1"), exp("exp-2")] });
    const cands = discoverDeterministicConnections(source, [other]);
    const sameMusic = cands.find((c) => c.connectionType === "same_music");
    expect(sameMusic).toBeDefined();
    expect(sameMusic!.targetMemoryId).toBe("mem-b");
    expect(sameMusic!.alreadyPersisted).toBe(false);
  });

  it("does NOT discover same_music when music differs", () => {
    const source = mem({ id: "mem-a", musicExperiences: [exp("exp-1")] });
    const other = mem({ id: "mem-b", musicExperiences: [exp("exp-2")] });
    const cands = discoverDeterministicConnections(source, [other]);
    expect(cands.find((c) => c.connectionType === "same_music")).toBeUndefined();
  });
});

describe("2. same location creates deterministic connection candidate", () => {
  it("discovers same_location on exact normalized match", () => {
    const source = mem({ id: "mem-a", location: "On The Train" });
    const other = mem({ id: "mem-b", location: "on the train" });
    const cands = discoverDeterministicConnections(source, [other]);
    expect(cands.find((c) => c.connectionType === "same_location")).toBeDefined();
  });

  it("does NOT discover same_location on different values (no fuzzy geocoding)", () => {
    const source = mem({ id: "mem-a", location: "train" });
    const other = mem({ id: "mem-b", location: "subway" });
    const cands = discoverDeterministicConnections(source, [other]);
    expect(cands.find((c) => c.connectionType === "same_location")).toBeUndefined();
  });

  it("does NOT discover same_location when one is null", () => {
    const source = mem({ id: "mem-a", location: "train" });
    const other = mem({ id: "mem-b", location: null });
    const cands = discoverDeterministicConnections(source, [other]);
    expect(cands.find((c) => c.connectionType === "same_location")).toBeUndefined();
  });
});

describe("3. overlapping known time windows creates candidate", () => {
  it("discovers overlapping_time when windows overlap", () => {
    const source = mem({
      id: "mem-a",
      eventTime: { granularity: "year", start: "2004-01-01", end: "2004-12-31", label: "2004" },
    });
    const other = mem({
      id: "mem-b",
      eventTime: {
        granularity: "year",
        start: "2004-06-01",
        end: "2005-05-31",
        label: "2004/2005",
      },
    });
    const cands = discoverDeterministicConnections(source, [other]);
    expect(cands.find((c) => c.connectionType === "overlapping_time")).toBeDefined();
  });
});

describe("4. unknown time does not create overlap connection", () => {
  it("does NOT discover overlapping_time when bounds are missing", () => {
    const source = mem({ id: "mem-a", eventTime: { label: "2004" } });
    const other = mem({
      id: "mem-b",
      eventTime: { granularity: "year", start: "2004-01-01", end: "2004-12-31", label: "2004" },
    });
    const cands = discoverDeterministicConnections(source, [other]);
    expect(cands.find((c) => c.connectionType === "overlapping_time")).toBeUndefined();
  });

  it("does NOT discover overlapping_time when both lack bounds", () => {
    const source = mem({ id: "mem-a", eventTime: { label: "2004" } });
    const other = mem({ id: "mem-b", eventTime: { label: "2004" } });
    const cands = discoverDeterministicConnections(source, [other]);
    expect(cands.find((c) => c.connectionType === "overlapping_time")).toBeUndefined();
  });
});

describe("5. approximate time respects explicit windows", () => {
  it("non-overlapping explicit windows do not connect", () => {
    const source = mem({
      id: "mem-a",
      eventTime: { granularity: "year", start: "2003-01-01", end: "2003-12-31", label: "2003" },
    });
    const other = mem({
      id: "mem-b",
      eventTime: { granularity: "year", start: "2005-01-01", end: "2005-12-31", label: "2005" },
    });
    const cands = discoverDeterministicConnections(source, [other]);
    expect(cands.find((c) => c.connectionType === "overlapping_time")).toBeUndefined();
  });

  it("touching windows (end == start) overlap (inclusive bounds)", () => {
    const source = mem({
      id: "mem-a",
      eventTime: { granularity: "day", start: "2004-01-01", end: "2004-06-01", label: null },
    });
    const other = mem({
      id: "mem-b",
      eventTime: { granularity: "day", start: "2004-06-01", end: "2004-12-01", label: null },
    });
    expect(timesOverlap(source.eventTime, other.eventTime)).toBe(true);
  });
});

describe("14. reverse duplicate is prevented (undirected normalization)", () => {
  it("connectionKey is order-independent", () => {
    const k1 = connectionKey("mem-a", "mem-b", "same_music");
    const k2 = connectionKey("mem-b", "mem-a", "same_music");
    expect(k1).toBe(k2);
  });

  it("normalizePair puts the lower id first", () => {
    const p1 = normalizePair("mem-b", "mem-a");
    const p2 = normalizePair("mem-a", "mem-b");
    expect(p1.sourceMemoryId).toBe("mem-a");
    expect(p1.targetMemoryId).toBe("mem-b");
    expect(p2).toEqual(p1);
  });
});

describe("alreadyPersisted flag", () => {
  it("marks a candidate alreadyPersisted when its key is in the persisted set", () => {
    const source = mem({ id: "mem-a", musicExperiences: [exp("exp-1")] });
    const other = mem({ id: "mem-b", musicExperiences: [exp("exp-1")] });
    const persisted = new Set([connectionKey("mem-a", "mem-b", "same_music")]);
    const cands = discoverDeterministicConnections(source, [other], persisted);
    const sameMusic = cands.find((c) => c.connectionType === "same_music");
    expect(sameMusic!.alreadyPersisted).toBe(true);
  });
});

describe("discovery is a preview (pure, no side effects)", () => {
  it("returns candidates without mutating inputs", () => {
    const source = mem({ id: "mem-a", musicExperiences: [exp("exp-1")] });
    const other = mem({ id: "mem-b", musicExperiences: [exp("exp-1")] });
    const snapshot = JSON.parse(JSON.stringify([source, other]));
    discoverDeterministicConnections(source, [other]);
    expect(JSON.parse(JSON.stringify([source, other]))).toEqual(snapshot);
  });
});

describe("normalizeLocation", () => {
  it("trims, lowercases, collapses whitespace", () => {
    expect(normalizeLocation("  On   The  Train  ")).toBe("on the train");
  });
  it("returns null for empty/whitespace", () => {
    expect(normalizeLocation("   ")).toBeNull();
    expect(normalizeLocation(null)).toBeNull();
    expect(normalizeLocation(undefined)).toBeNull();
  });
});
