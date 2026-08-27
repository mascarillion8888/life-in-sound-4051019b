/**
 * Simple TTL in-memory cache. Used by the Supabase DAL (`cards-remote.ts`)
 * to avoid re-fetching gallery rows within a short window. Extracted to its
 * own module so component files only export components (react-refresh rule).
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class InflightCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private ttl: number;

  constructor(ttlMs = 30_000) {
    this.ttl = ttlMs;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

/** Shared 30s cache for gallery query results. */
export const dbCache = new InflightCache(30_000);
