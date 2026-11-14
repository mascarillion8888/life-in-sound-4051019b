/**
 * Dev-route production gate (task P0-3). Kept out of the route file so the
 * route module only exports route/component symbols (fast-refresh clean).
 */
import { notFound } from "@tanstack/react-router";

/** Throw a router not-found unless we are running in a development build. */
export function devOnlyGuard(isDev: boolean): void {
  if (!isDev) throw notFound();
}
