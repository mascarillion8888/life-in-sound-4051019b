#!/usr/bin/env node
/**
 * lore-eval — local quality-evaluation harness for the cinematic life-journey
 * lore. NOT part of CI and NOT wired into package.json (run it by hand).
 *
 * It runs the SAME pipeline the app uses (`generateLoreCore`: clean → GENERIC
 * filter → one rewrite → 40-word cut → deterministic template), so the WORDS
 * and FLAG columns reflect the text the user actually sees, and each row shows
 * which path produced it: provider / rewrite / template.
 *
 * Usage (from the repo root):
 *
 *   OPENROUTER_API_KEY=... node scripts/lore-eval.mjs
 *   # or put OPENROUTER_API_KEY in .env (gitignored) and just run:
 *   node scripts/lore-eval.mjs
 *
 * Options:
 *   --model <id>     override the OpenRouter model (sets OPENROUTER_PRIMARY_MODEL)
 *   --lang <tr,en>   comma-separated UI languages to evaluate
 *   --songs <N>      use only the first N reference songs
 *   --ages <10,22,40> comma-separated ages
 *
 * The API key and any network detail are NEVER printed; with no key it prints a
 * clear message and exits. Every result is written immediately and also appended
 * to scripts/lore-eval-output.txt (gitignored). Real model quality is NOT
 * asserted here — read the table and judge it yourself.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const moduleUrl = (rel) => pathToFileURL(join(repoRoot, rel)).href;
const OUTPUT_PATH = join(here, "lore-eval-output.txt");

/** Minimal .env reader (no dependency). Values are never printed. */
function loadDotEnv() {
  const path = join(repoRoot, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}

/** Parse `--flag value` options. */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === "--model") out.model = argv[++i];
    else if (key === "--lang") out.lang = argv[++i];
    else if (key === "--songs") out.songs = Number(argv[++i]);
    else if (key === "--ages") out.ages = argv[++i];
  }
  return out;
}

loadDotEnv();
const args = parseArgs(process.argv.slice(2));
if (args.model) process.env.OPENROUTER_PRIMARY_MODEL = args.model;

if (!process.env.OPENROUTER_API_KEY?.trim()) {
  console.log(
    "[lore-eval] OPENROUTER_API_KEY is not set (environment or .env) — nothing to do, exiting.",
  );
  process.exit(0);
}

const { generateLoreCore, LORE_SYSTEM_PROMPT } = await import(
  moduleUrl("src/lib/art/loreEngine.ts")
);
const { callOpenRouter } = await import(moduleUrl("src/lib/openrouter.server.ts"));
const { runRole } = await import(moduleUrl("src/lib/llm/orchestra.ts"));
const { DEFAULT_LANGUAGE, LANGUAGE_NAMES, isLanguage } = await import(
  moduleUrl("src/lib/i18n/languages.ts")
);

const ALL_SONGS = [
  { artist: "Iron Maiden", title: "The Trooper", genre: "Heavy Metal", releaseYear: 1983 },
  {
    artist: "Metallica",
    title: "For Whom the Bell Tolls",
    genre: "Thrash Metal",
    releaseYear: 1984,
  },
  {
    artist: "Queensrÿche",
    title: "Operation: Mindcrime",
    genre: "Progressive Metal",
    releaseYear: 1988,
  },
  { artist: "Judas Priest", title: "Painkiller", genre: "Heavy Metal", releaseYear: 1990 },
  { artist: "Draconian", title: "The Curse of Silence", genre: "Doom Metal", releaseYear: 2011 },
  { artist: "Michael Jackson", title: "Bad", genre: "Pop", releaseYear: 1987 },
  { artist: "Madonna", title: "Like a Prayer", genre: "Pop", releaseYear: 1989 },
  { artist: "Nirvana", title: "Smells Like Teen Spirit", genre: "Grunge", releaseYear: 1991 },
];
const ALL_AGES = [10, 22, 40];

const songs =
  Number.isFinite(args.songs) && args.songs > 0 ? ALL_SONGS.slice(0, args.songs) : ALL_SONGS;
const ages = args.ages
  ? args.ages
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v))
  : ALL_AGES;
const langCodes = args.lang
  ? args.lang
      .split(",")
      .map((v) => v.trim())
      .filter(isLanguage)
  : ["tr", "en"];
const languages = langCodes.length ? langCodes : [DEFAULT_LANGUAGE];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One provider call, with 429 retry (3s/6s/12s) and a 1500ms inter-call gap. */
async function writeLore(userPrompt) {
  const delays = [3000, 6000, 12000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const viaOpenRouter = await callOpenRouter(
        [
          { role: "system", content: LORE_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        { temperature: 0.9, maxTokens: 300 },
      );
      if (viaOpenRouter != null) return { text: viaOpenRouter, via: "openrouter" };
      const viaGroq = await runRole("summarizer", userPrompt, { temperature: 0.9, maxTokens: 300 });
      return { text: viaGroq, via: "groq" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/429|rate limit/i.test(message) && attempt < delays.length) {
        await sleep(delays[attempt]);
        continue;
      }
      return { text: null, via: "openrouter" };
    }
  }
  return { text: null, via: "openrouter" };
}

const pad = (value, width) => String(value).slice(0, width).padEnd(width);

writeFileSync(OUTPUT_PATH, "");
const emit = (line) => {
  console.log(line);
  appendFileSync(OUTPUT_PATH, `${line}\n`);
};

const model = process.env.OPENROUTER_PRIMARY_MODEL ?? "(default)";
emit(
  `[lore-eval] model=${model} · ${songs.length} songs × ${ages.length} ages × ${languages.length} languages = ${songs.length * ages.length * languages.length} samples`,
);
emit(
  `${pad("SONG", 30)} ${pad("AGE", 4)} ${pad("LANG", 5)} ${pad("WORDS", 6)} ${pad("FLAG", 8)} ${pad("PATH", 9)} LORE`,
);
emit("-".repeat(120));

const stats = { total: 0, failed: 0, words: [], over40: 0, template: 0, paths: {} };
let first = true;
for (const song of songs) {
  for (const age of ages) {
    for (const code of languages) {
      if (!first) await sleep(1500);
      first = false;

      const encounter = {
        artist: song.artist,
        songTitle: song.title,
        encounterAge: age,
        genre: song.genre,
        releaseYear: song.releaseYear,
        languageName: LANGUAGE_NAMES[code],
      };

      let text = "FAILED";
      let flag = "-";
      let path = "-";
      try {
        const result = await generateLoreCore(encounter, writeLore);
        text = result.text.replace(/\s+/g, " ").trim();
        path = result.path;
        flag = result.path === "template" ? "template" : "ok";
      } catch {
        stats.failed++;
        text = "FAILED";
      }

      stats.total++;
      const words = text === "FAILED" ? 0 : text.split(/\s+/).filter(Boolean).length;
      if (text !== "FAILED") {
        stats.words.push(words);
        if (words > 40) stats.over40++;
        if (path === "template") stats.template++;
        stats.paths[path] = (stats.paths[path] ?? 0) + 1;
      }
      emit(
        `${pad(`${song.artist} — ${song.title}`, 30)} ${pad(age, 4)} ${pad(code, 5)} ${pad(words, 6)} ${pad(flag, 8)} ${pad(path, 9)} ${text}`,
      );
    }
  }
}

const avg = stats.words.length
  ? (stats.words.reduce((a, b) => a + b, 0) / stats.words.length).toFixed(1)
  : "0.0";
emit("-".repeat(120));
emit(
  `[lore-eval] summary: ${stats.total - stats.failed}/${stats.total} succeeded · ${stats.failed} failed · avg ${avg} words · ${stats.over40} over 40 words · ${stats.template} fell back to the template`,
);
emit(`[lore-eval] paths: ${JSON.stringify(stats.paths)}`);
emit(`[lore-eval] output appended to ${OUTPUT_PATH}`);
