/**
 * Vercel SPA post-build — runs after `vite build` (see `npm run build`).
 *
 * Two jobs, both against Nitro's `.vercel/output`:
 *
 * 1. SHELL — fetch the app shell (`X-TSS_SHELL` render: root layout only,
 *    every route match dehydrated with ssr:false) from the freshly built
 *    serverless function and write it to `static/index.html`. The function's
 *    default export is a fetch-style handler, so no port/listener is needed.
 *    Runtime SSR is deliberately bypassed on Vercel: pages hydrate
 *    client-side from this static shell, so an SSR-bundle crash can never
 *    take the page down at request time.
 *
 * 2. ROUTES — rewrite the generated `config.json` catch-all: navigations
 *    (`/(.*)`) serve the static shell, only server functions (`/_serverFn/*`
 *    — Gemini analyzer, entry insights, suggestions) reach `__server`.
 *    Additionally, the route pattern covers the direct `/__server` path so
 *    a keep-alive call targeting it hits the server bundle instead of the
 *    static SPA shell.
 *
 * No-op when `.vercel/output` doesn't exist (local/Lovable cloudflare build).
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

const OUTPUT = ".vercel/output";
const CONFIG = `${OUTPUT}/config.json`;
const FUNCTION_ENTRY = `${OUTPUT}/functions/__server.func/index.mjs`;
const SHELL_OUT = `${OUTPUT}/static/index.html`;
const SERVER_FN_BASE = "/_serverFn";
const FUNCTION_DEST = "/__server";
const ERROR_PAGE_MARKER = "This page didn't load";

if (!existsSync(CONFIG)) {
  console.log("[postbuild-vercel-spa] No .vercel/output — skipping (non-Vercel build).");
  process.exit(0);
}

// Must be set before the bundle is imported: the start handler reads it at
// module load to enable the X-TSS_SHELL header path.
process.env.TSS_PRERENDERING = "true";

const { default: app } = await import(new URL(`../${FUNCTION_ENTRY}`, import.meta.url));
if (typeof app?.fetch !== "function") {
  console.error(
    `[postbuild-vercel-spa] ${FUNCTION_ENTRY} has no fetch handler — unexpected bundle shape.`,
  );
  process.exit(1);
}

const shellResponse = await app.fetch(
  new Request("http://localhost/", { headers: { "X-TSS_SHELL": "true" } }),
  {},
  {},
);
const shellHtml = await shellResponse.text();

if (shellResponse.status !== 200) {
  console.error(
    `[postbuild-vercel-spa] Shell render returned ${shellResponse.status} — build is broken.`,
  );
  process.exit(1);
}
if (shellHtml.includes(ERROR_PAGE_MARKER)) {
  console.error(
    "[postbuild-vercel-spa] Shell render produced the SSR error page — the server bundle crashed during render.",
  );
  process.exit(1);
}
if (!shellHtml.includes('id="root"') && !shellHtml.includes("/assets/")) {
  console.error(
    "[postbuild-vercel-spa] Shell HTML looks empty (no #root, no client assets) — refusing to ship it.",
  );
  process.exit(1);
}

await writeFile(SHELL_OUT, shellHtml);
console.log(`[postbuild-vercel-spa] Shell written to ${SHELL_OUT} (${shellHtml.length} bytes)`);

const config = JSON.parse(await readFile(CONFIG, "utf8"));
const routes = config.routes ?? [];
const filesystemIndex = routes.findIndex((r) => r.handle === "filesystem");
if (filesystemIndex === -1) {
  console.error(
    "[postbuild-vercel-spa] No `handle: filesystem` route found — unexpected config shape.",
  );
  process.exit(1);
}

config.routes = [
  ...routes.slice(0, filesystemIndex + 1),
  // Server functions (Gemini analyzer, entry insights, suggestions) → Node
  // function. Direct /__server path (fallback cron target — primary is
  // /api/keep-alive but either shape reaches the server entry's normalizer
  // before the shell).
  { src: `${SERVER_FN_BASE}(.*)|^${FUNCTION_DEST}$`, dest: FUNCTION_DEST },
  // Everything else is a client-side route → static SPA shell
  { src: "/(.*)", dest: "/index.html" },
];

await writeFile(CONFIG, JSON.stringify(config, null, 2));
console.log(
  `[postbuild-vercel-spa] Routes updated: ${SERVER_FN_BASE}* → ${FUNCTION_DEST}, fallback → /index.html`,
);
