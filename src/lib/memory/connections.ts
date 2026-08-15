/**
 * Deterministic connection discovery — pure logic, no I/O, no DB.
 *
 * Determines Factual relationships between a given memory and a candidate set
 * of the user's other memories. Deterministic connection != AI interpretation.
 * "These two memories are emotionally similar" requires AI/semantic reasoning
 * and is NOT part of this engine.
 *
 * Rules implemented:
 *   - same_music: two memories reference the same Music Experience (factual).
 *   - same_location: two memories share the same normalized location value
 *     (safe exact equality only — no fuzzy geocoding).
 *   - overlapping_time: two memories have explicit event-time windows that
 *     overlap. Unknown time never produces an overlap. Approximate precision
 *     (year/season/period) is respected via stored start/end bounds.
 *   - user_linked: explicit user action only — not discovered here.
 *
 * Discovery is a PREVIEW: it returns candidates and never persists. The
 * caller decides whether to persist (and for deterministic facts, persistence
 * is safe and owned by the user). This module references no Supabase client.
 */
import type { Memory } from "@/lib/memory/types";
import type { ConnectionType, DiscoveredConnection } from "@/lib/memory/types";

/** The deterministic connection types this engine can discover. */
const DISCOVERABLE_TYPES: ReadonlySet<ConnectionType> = new Set([
  "same_music",
  "same_location",
  "overlapping_time",
]);

/**
 * Normalize a location string for safe exact comparison. Lowercased, trimmed,
 * collapsed internal whitespace. NULL/empty → null (never matches).
 *
 * This is deliberately conservative: no fuzzy geography, no geocoding, no
 * alias resolution. Two memories connect on location only when the user
 * supplied the same normalized value.
 */
export function normalizeLocation(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.replace(/\s+/g, " ").toLowerCase();
}

/**
 * Do two event-time windows overlap? Both must have explicit bounds; unknown
 * time (null bounds) never overlaps. When only a granularity/label exists
 * without bounds, there is no comparable window → no overlap.
 *
 * Bounds are inclusive: [aStart, aEnd] overlaps [bStart, bEnd] iff
 * aStart <= bEnd and bStart <= aEnd.
 */
export function timesOverlap(a: Memory["eventTime"], b: Memory["eventTime"]): boolean {
  if (!a || !b) return false;
  const aS = a.start;
  const aE = a.end;
  const bS = b.start;
  const bE = b.end;
  if (!aS || !aE || !bS || !bE) return false;
  return new Date(aS) <= new Date(bE) && new Date(bS) <= new Date(aE);
}

/**
 * Discover deterministic connection candidates between `source` and each member
 * of `others`. Returns one candidate per (target, type) discovery. A candidate
 * is marked `alreadyPersisted` when an identical (source, target, type)
 * connection already exists in `persistedKeys`.
 *
 * Pure: no side effects, no persistence, no network.
 */
export function discoverDeterministicConnections(
  source: Memory,
  others: Memory[],
  persistedKeys: ReadonlySet<string> = new Set(),
): DiscoveredConnection[] {
  const candidates: DiscoveredConnection[] = [];

  const sourceMusicIds = new Set(source.musicExperiences.map((e) => e.musicExperienceId));
  const sourceLocation = normalizeLocation(source.location);

  for (const other of others) {
    if (other.id === source.id) continue;

    // same_music
    if (DISCOVERABLE_TYPES.has("same_music")) {
      const shared = other.musicExperiences.some((e) => sourceMusicIds.has(e.musicExperienceId));
      if (shared) {
        candidates.push({
          sourceMemoryId: source.id,
          targetMemoryId: other.id,
          connectionType: "same_music",
          reason: "Same music experience",
          alreadyPersisted: persistedKeys.has(connectionKey(source.id, other.id, "same_music")),
        });
      }
    }

    // same_location (exact normalized equality only)
    if (DISCOVERABLE_TYPES.has("same_location") && sourceLocation) {
      const otherLocation = normalizeLocation(other.location);
      if (otherLocation && otherLocation === sourceLocation) {
        candidates.push({
          sourceMemoryId: source.id,
          targetMemoryId: other.id,
          connectionType: "same_location",
          reason: "Same location",
          alreadyPersisted: persistedKeys.has(connectionKey(source.id, other.id, "same_location")),
        });
      }
    }

    // overlapping_time (explicit windows only; unknown never overlaps)
    if (
      DISCOVERABLE_TYPES.has("overlapping_time") &&
      timesOverlap(source.eventTime, other.eventTime)
    ) {
      candidates.push({
        sourceMemoryId: source.id,
        targetMemoryId: other.id,
        connectionType: "overlapping_time",
        reason: "Overlapping time",
        alreadyPersisted: persistedKeys.has(connectionKey(source.id, other.id, "overlapping_time")),
      });
    }
  }

  return candidates;
}

/**
 * The stable, normalized key for an undirected connection. Uses the lower id
 * as source so A→B and B→A produce the same key. Matches the DB
 * normalize_order trigger + unique index.
 */
export function connectionKey(aId: string, bId: string, type: ConnectionType): string {
  const [lo, hi] = aId < bId ? [aId, bId] : [bId, aId];
  return `${lo}|${hi}|${type}`;
}

/** Normalize a memory pair to (lower, higher) for undirected storage. */
export function normalizePair(
  aId: string,
  bId: string,
): { sourceMemoryId: string; targetMemoryId: string } {
  return aId < bId
    ? { sourceMemoryId: aId, targetMemoryId: bId }
    : { sourceMemoryId: bId, targetMemoryId: aId };
}
