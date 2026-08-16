// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
//
// Deployment target: standard Node.js + Nitro (node-server preset). The production
// server entry is `.output/server/index.mjs`, run with `node .output/server/index.mjs`.
// `process.env` is populated natively by Node at runtime, which is how the
// Orchestra bridge reads provider API keys.
//
// Build chunking fix (deployment-agnostic): the Nitro/rolldown build splits the
// TanStack Start SSR service assets (under node_modules/.nitro/vite/services/ssr/assets/)
// into separate chunks, which creates an ESM live-binding cycle: the chunk that
// defines `createCsrfMiddleware` imports `server_exports` back from the chunk that
// consumes it, so the consumer's top-level
// `defaultCsrfMiddleware = createCsrfMiddleware(...)` runs before the export is
// initialised and throws `createCsrfMiddleware is not a function` at runtime.
// Forcing these service assets into a single chunk removes the cycle. Client
// bundle and product semantics are unchanged.
//
// `rolldownConfig` is a real Nitro option but is not in the Lovable plugin's
// narrow `nitro` type schema, so it is passed via a cast; the Lovable config
// spreads `userNitroOpts` into nitroOpts verbatim.
import { defineConfig, type LovableViteTanstackOptions } from "@lovable.dev/vite-tanstack-config";

const nitroBuildConfig = {
  preset: "node-server",
  rolldownConfig: {
    output: {
      codeSplitting: {
        groups: [
          {
            test: /[\\/]node_modules[\\/]\.nitro[\\/]vite[\\/]services[\\/]ssr[\\/]assets[\\/]/,
            name: "tanstack-start-ssr",
          },
        ],
      },
    },
  },
} as unknown as NonNullable<LovableViteTanstackOptions>["nitro"];

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: nitroBuildConfig,
});
