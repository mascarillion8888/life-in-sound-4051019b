import { describe, expect, it } from "vitest";
import { dbCache } from "./supabaseCache";

describe("supabaseCache (TTL in-memory)", () => {
  it("get returns null for empty keys", () => {
    expect(dbCache.get("cards")).toBeNull();
  });

  it("get returns data within TTL window", () => {
    dbCache.set("cards:test", [{ id: "c1" }]);
    expect(dbCache.get("cards:test")).toEqual([{ id: "c1" }]);
    dbCache.invalidate("cards:test");
  });

  it("get expires stale entries past TTL", () => {
    dbCache.set("cards:stale", [{ id: "c1" }]);
    interface CacheEntryInternal {
      data: unknown;
      timestamp: number;
    }
    const map = (dbCache as unknown as { cache: Map<string, CacheEntryInternal> }).cache;
    map.set("cards:stale", {
      data: [{ id: "c1" }],
      timestamp: Date.now() - 31_000,
    });
    expect(dbCache.get("cards:stale")).toBeNull();
  });

  it("invalidate(key) removes only the named entry", () => {
    dbCache.set("cards:a", 1);
    dbCache.set("cards:b", 2);
    dbCache.invalidate("cards:a");
    expect(dbCache.get("cards:a")).toBeNull();
    expect(dbCache.get("cards:b")).toEqual(2);
    dbCache.invalidate();
  });

  it("invalidate() clears everything", () => {
    dbCache.set("x", 1);
    dbCache.invalidate();
    expect(dbCache.get("x")).toBeNull();
  });
});
