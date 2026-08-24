/**
 * Supabase keep-alive logic — minimal read ping so the free-tier project
 * never pauses from inactivity (Vercel Cron hits /api/keep-alive daily).
 *
 * Uses ONLY the build-time public anon credentials (VITE_SUPABASE_URL /
 * VITE_SUPABASE_ANON_KEY) — never the service-role key. The query is a
 * zero-row HEAD count on `journeys`, which exercises the database without
 * transferring rows (RLS already scopes all data to the owner).
 *
 * Never throws: any failure maps to `{ ok: false, ... }` so a broken ping
 * cannot crash the endpoint or the cron job.
 */
import { createClient } from "@supabase/supabase-js";

export type KeepAliveResult = {
  ok: boolean;
  /** Why the ping was skipped or failed (no credentials, query error, ...). */
  reason?: string;
  /** Milliseconds the ping took (0 when skipped). */
  ms: number;
};

export type KeepAliveOptions = {
  /** Injectable client factory (for tests). Defaults to the real anon client. */
  clientImpl?: (url: string, anonKey: string) => {
    from: (table: string) => {
      select: (
        columns: string,
        options: { count: "exact"; head: true },
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
  /** Injectable clock (for tests). */
  nowImpl?: () => number;
};

function defaultClient(url: string, anonKey: string) {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Server-side env read (Nitro exposes VITE_* vars at runtime as well). */
function readEnv(): { url?: string; anonKey?: string } {
  const env =
    (typeof process !== "undefined" ? process.env : undefined) ??
    (import.meta as unknown as { env?: Record<string, string> }).env ??
    {};
  return {
    url: env.VITE_SUPABASE_URL,
    anonKey: env.VITE_SUPABASE_ANON_KEY,
  };
}

export async function keepAliveLogic(options: KeepAliveOptions = {}): Promise<KeepAliveResult> {
  const now = options.nowImpl ?? Date.now;
  const { url, anonKey } = readEnv();
  if (!url || !anonKey) {
    return { ok: false, reason: "supabase-not-configured", ms: 0 };
  }
  const make = options.clientImpl ?? defaultClient;
  const started = now();
  try {
    const client = make(url, anonKey);
    const { error } = await client
      .from("journeys")
      .select("id", { count: "exact", head: true });
    const ms = Math.max(0, now() - started);
    if (error) {
      return { ok: false, reason: `query-failed: ${error.message}`, ms };
    }
    return { ok: true, ms };
  } catch (err) {
    const ms = Math.max(0, now() - started);
    return { ok: false, reason: `exception: ${(err as Error).message}`, ms };
  }
}

/**
 * HTTP wiring lives in `src/server.ts`: the Vercel Cron job calls
 * `GET /__server?action=keep-alive`, and the server entry answers it with
 * this logic. A dedicated `src/routes/api/*` endpoint is NOT used because
 * the Vercel SPA pipeline (postbuild-vercel-spa) maps `/(.*)` to the static
 * shell after `/_serverFn*` → `/__server`, so API routes never reach the
 * server bundle in deployed output.
 */
