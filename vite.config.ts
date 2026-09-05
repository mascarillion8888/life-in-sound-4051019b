// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      host: "0.0.0.0",
      port: 3000,
      allowedHosts: true,
      cors: true,
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Deploy target: switch to Nitro's `vercel` preset only when built on Vercel
  // (Vercel injects VERCEL=1 into its CI). Everywhere else — Lovable sandbox and
  // local builds — keep the config's default (cloudflare). The preset writes
  // .vercel/output (static + serverless NODE functions), which Vercel treats
  // as zero-config Build Output API; server functions like
  // src/lib/llm/generateAnalysis.server.ts then read GEMINI_API_KEY from the
  // server-side process.env, never the client bundle.
  //
  // inlineDynamicImports: the default multi-chunk SSR bundle crashes at module
  // init ("createCsrfMiddleware is not a function") — rolldown splits the start
  // server entry into circularly-imported chunks and `var` hoisting resolves
  // the binding to undefined. Single-file output removes the chunk boundary.
  // (The lovable config spreads unknown nitro options through to Nitro at
  // runtime; its TS type is just narrower, hence the cast.)
  nitro: (process.env.VERCEL ? { preset: "vercel", inlineDynamicImports: true } : {}) as {
    preset?: string;
  },
});
