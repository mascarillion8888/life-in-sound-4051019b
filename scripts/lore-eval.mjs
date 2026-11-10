#!/usr/bin/env node
/**
 * lore-eval — local quality-evaluation harness for the cinematic life-journey
 * lore prompt. NOT part of CI and NOT wired into package.json (run it by hand).
 *
 * Usage (from the repo root):
 *
 *   OPENROUTER_API_KEY=... node scripts/lore-eval.mjs
 *   # or put OPENROUTER_API_KEY in .env (gitignored) and just run:
 *   node scripts/lore-eval.mjs
 *
 * It generates lore for 8 reference songs × 3 ages (10, 22, 40) × 2 languages
 * (tr, en) through the SAME OpenRouter bridge the app uses, then prints a
 * compact table: song, age, life period, language, word count, generic-flag and
 * the lore text. The API key and any network detail are NEVER printed; with no
 * key it prints a clear message and exits. Real model quality is NOT asserted
 * here — read the table and judge it yourself.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const moduleUrl = (rel) => pathToFileURL(join(repoRoot, rel)).href;

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

loadDotEnv();

if (!process.env.OPENROUTER_API_KEY?.trim()) {
  console.log(
    "[lore-eval] OPENROUTER_API_KEY is not set (environment or .env) — nothing to do, exiting.",
  );
  process.exit(0);
}

const { callOpenRouter } = await import(moduleUrl("src/lib/openrouter.server.ts"));
const {
  LORE_SYSTEM_PROMPT,
  buildLoreUserPrompt,
  cleanLore,
  hasForbiddenPhrase,
  lifePeriodForAge,
  wordCount,
} = await import(moduleUrl("src/lib/art/loreEngine.ts"));

const SONGS = [
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
const AGES = [10, 22, 40];
const LANGS = [
  { code: "tr", name: "Türkçe" },
  { code: "en", name: "English" },
];

const pad = (value, width) => String(value).slice(0, width).padEnd(width);

const rows = [];
for (const song of SONGS) {
  for (const age of AGES) {
    for (const lang of LANGS) {
      const prompt = buildLoreUserPrompt({
        songTitle: song.title,
        artist: song.artist,
        age,
        genre: song.genre,
        releaseYear: song.releaseYear,
        languageName: lang.name,
      });
      let lore;
      try {
        const out = await callOpenRouter(
          [
            { role: "system", content: LORE_SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          { temperature: 0.9, maxTokens: 300 },
        );
        lore = cleanLore(out) || "(no provider output)";
      } catch {
        // Static line only — never surface the error, the key or network detail.
        lore = "(request failed)";
      }
      rows.push({
        song: `${song.artist} — ${song.title}`,
        age,
        period: lifePeriodForAge(age)?.key ?? "-",
        lang: lang.code,
        words: wordCount(lore),
        flag: hasForbiddenPhrase(lore) ? "GENERIC" : "ok",
        lore,
      });
    }
  }
}

console.log(
  `[lore-eval] ${rows.length} samples (${SONGS.length} songs × ${AGES.length} ages × ${LANGS.length} languages)\n`,
);
console.log(
  `${pad("SONG", 34)} ${pad("AGE", 4)} ${pad("PERIOD", 12)} ${pad("LANG", 5)} ${pad("WORDS", 6)} ${pad("FLAG", 8)} LORE`,
);
console.log("-".repeat(120));
for (const row of rows) {
  console.log(
    `${pad(row.song, 34)} ${pad(row.age, 4)} ${pad(row.period, 12)} ${pad(row.lang, 5)} ${pad(row.words, 6)} ${pad(row.flag, 8)} ${row.lore}`,
  );
}
