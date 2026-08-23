/**
 * Bundle leak check — fails when a server-only secret name leaks into the
 * client bundle. Runs against whichever build output exists (Vercel preset:
 * `.vercel/output/static`; default/Lovable: `.output/public` or `dist/client`).
 *
 * This guards the repo's one rule: `GEMINI_API_KEY` (and friends) are
 * server-only; only `VITE_`-prefixed vars may reach the browser. Any hit in
 * a client asset = a bug (e.g. someone inlined process.env in shared code),
 * and the check exits 1 with the offending file listed.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const FORBIDDEN = ["GEMINI_API_KEY", "GROQ_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SPOTIFY_CLIENT_SECRET"];
const SCAN_DIRS = [".vercel/output/static", ".output/public", "dist/client"];
const TEXT_EXTENSIONS = new Set([".js", ".css", ".html", ".json", ".map"]);

function textFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) textFiles(path, out);
    else if (TEXT_EXTENSIONS.has(path.slice(path.lastIndexOf(".")))) out.push(path);
  }
  return out;
}

const roots = SCAN_DIRS.filter((d) => existsSync(d));
if (roots.length === 0) {
  console.error("[check:bundle] No build output found. Run `npm run build` first.");
  process.exit(1);
}

const leaks = [];
for (const root of roots) {
  for (const file of textFiles(root)) {
    const content = await readFile(file, "utf8");
    for (const name of FORBIDDEN) {
      if (content.includes(name)) leaks.push({ file, name });
    }
  }
}

if (leaks.length > 0) {
  console.error("[check:bundle] SERVER-ONLY NAME LEAKED INTO CLIENT BUNDLE:");
  for (const { file, name } of leaks) console.error(`  ${file} → ${name}`);
  process.exit(1);
}

console.log(
  `[check:bundle] OK — client bundle clean (scanned ${roots.join(", ")}, forbidden: ${FORBIDDEN.join(", ")})`,
);
