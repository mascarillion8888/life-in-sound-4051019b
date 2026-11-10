import { describe, expect, it } from "vitest";

import {
  buildLoreUserPrompt,
  cleanLore,
  exceedsWordLimit,
  hasForbiddenPhrase,
  isGenericLore,
  lifePeriodForAge,
  LORE_STYLE_VERSION,
  LORE_SYSTEM_PROMPT,
  MAX_LORE_WORDS,
  truncateToWordLimit,
  wordCount,
} from "./loreEngine";

describe("lifePeriodForAge", () => {
  it("maps each boundary to exactly one guide period", () => {
    expect(lifePeriodForAge(8)?.key).toBe("discovery"); // < 9 folds into the first period
    expect(lifePeriodForAge(9)?.key).toBe("discovery");
    expect(lifePeriodForAge(12)?.key).toBe("discovery");
    expect(lifePeriodForAge(13)?.key).toBe("identity");
    expect(lifePeriodForAge(18)?.key).toBe("identity");
    expect(lifePeriodForAge(28)?.key).toBe("exploration");
    expect(lifePeriodForAge(29)?.key).toBe("choices");
    expect(lifePeriodForAge(34)?.key).toBe("choices");
    expect(lifePeriodForAge(35)?.key).toBe("memory");
    expect(lifePeriodForAge(80)?.key).toBe("memory");
  });

  it("returns null when the age is unknown or invalid", () => {
    expect(lifePeriodForAge(null)).toBeNull();
    expect(lifePeriodForAge(undefined)).toBeNull();
    expect(lifePeriodForAge(Number.NaN)).toBeNull();
    expect(lifePeriodForAge(-3)).toBeNull();
  });

  it("exposes the period's conflict/emotion cue words", () => {
    expect(lifePeriodForAge(40)?.cues).toContain("kabullenme");
    expect(lifePeriodForAge(10)?.cues).toContain("hayal gücü");
  });
});

describe("LORE_SYSTEM_PROMPT (style guide)", () => {
  it("carries the core formula", () => {
    expect(LORE_SYSTEM_PROMPT).toContain(
      "SONG → AGE → LIFE PERIOD → INNER CONFLICT → EMOTION → LORE",
    );
  });

  it("carries the length rule (1–3 sentences, 8–30, never over 40)", () => {
    expect(LORE_SYSTEM_PROMPT).toContain("1–3 sentences");
    expect(LORE_SYSTEM_PROMPT).toContain("8–30 words");
    expect(LORE_SYSTEM_PROMPT).toContain("40 words");
  });

  it("carries the forbidden phrasings (TR + EN)", () => {
    expect(LORE_SYSTEM_PROMPT).toContain("Bu şarkı bize");
    expect(LORE_SYSTEM_PROMPT).toContain("Müzikal olarak");
    expect(LORE_SYSTEM_PROMPT).toContain("Mutlaka dinlemelisiniz");
    expect(LORE_SYSTEM_PROMPT).toContain("This song");
    expect(LORE_SYSTEM_PROMPT).toContain("unforgettable journey");
    expect(LORE_SYSTEM_PROMPT).toContain("must-listen");
  });

  it("carries the no-fabrication ban", () => {
    expect(LORE_SYSTEM_PROMPT).toContain("NO FABRICATION");
    expect(LORE_SYSTEM_PROMPT).toContain("Never quote or paraphrase lyrics");
  });

  it("carries all five few-shot references with their narrative logic", () => {
    for (const song of [
      "The Trooper",
      "For Whom the Bell Tolls",
      "Operation: Mindcrime",
      "Painkiller",
      "The Curse of Silence",
    ]) {
      expect(LORE_SYSTEM_PROMPT).toContain(song);
    }
    // TR example + faithful EN equivalent + "logic" note, once per example.
    expect(LORE_SYSTEM_PROMPT.match(/logic:/g)).toHaveLength(5);
    expect(LORE_SYSTEM_PROMPT).toContain('TR: "Melankoli. Kabullenme. Derinlik.');
    expect(LORE_SYSTEM_PROMPT).toContain(
      'EN: "Melancholy. Acceptance. Depth. This is not the end. This is your peace."',
    );
  });

  it("carries the 5-question final check", () => {
    expect(LORE_SYSTEM_PROMPT).toContain("FINAL CHECK");
    expect(LORE_SYSTEM_PROMPT).toContain("Could this text be applied to any song?");
    expect(LORE_SYSTEM_PROMPT).toContain('"this is a moment from my life"');
  });

  it("has a versioned style id", () => {
    expect(LORE_STYLE_VERSION).toBe("lore-v2");
  });
});

describe("buildLoreUserPrompt", () => {
  const base = {
    songTitle: "Fragile",
    artist: "Sting",
    languageName: "English",
  };

  it("states the real age and its mapped life period with cue words", () => {
    const prompt = buildLoreUserPrompt({ ...base, age: 22 });
    expect(prompt).toContain("at age 22");
    expect(prompt).toContain("yaş: 22");
    expect(prompt).toContain("Self-discovery & questioning");
    expect(prompt).toContain("sorgulama");
  });

  it("omits the period line and forbids inventing one when the age is unknown", () => {
    const prompt = buildLoreUserPrompt(base);
    expect(prompt).not.toContain("yaş:");
    expect(prompt).toContain("yaş bilinmiyor");
    expect(prompt).toContain("do not invent an age or a life period");
  });

  it("names the target UI language", () => {
    expect(buildLoreUserPrompt({ ...base, languageName: "Türkçe" })).toContain("in Türkçe");
  });

  it("carries the anti-fabrication and non-clinical rules", () => {
    const prompt = buildLoreUserPrompt({ ...base, age: 9 });
    expect(prompt).toContain("do not invent lyrics");
    expect(prompt).toContain("never quote lyrics");
    expect(prompt).toContain("never diagnose, label, or pathologize");
  });

  it("weaves the personal memory and the era year when supplied", () => {
    const prompt = buildLoreUserPrompt({
      ...base,
      age: 9,
      eraYear: 1987,
      releaseYear: 1987,
      userMemory: "rain on the window that summer",
    });
    expect(prompt).toContain("(around 1987)");
    expect(prompt).toContain("Release year: 1987");
    expect(prompt).toContain("Personal memory to honour: rain on the window that summer");
  });
});

describe("forbidden-phrase filter (TR + EN)", () => {
  it("catches the English review/ad copy patterns", () => {
    for (const phrase of [
      "This song is a must-listen.",
      "This track touches your heart.",
      "Musically, it is unforgettable journey material.",
      "It inspires you every time.",
    ]) {
      expect(hasForbiddenPhrase(phrase)).toBe(true);
      expect(isGenericLore(phrase)).toBe(true);
    }
  });

  it("catches the Turkish review/ad copy patterns", () => {
    for (const phrase of [
      "Bu şarkı bize huzur verir.",
      "Müzikal olarak çok güçlü.",
      "Kalbinize dokunur.",
      "Size ilham verir.",
      "Mutlaka dinlemelisiniz.",
    ]) {
      expect(hasForbiddenPhrase(phrase)).toBe(true);
    }
  });

  it("passes a proper, specific lore line", () => {
    const good = "Epik hikâyeler ve sınırlarını zorlayan bir dünya.";
    expect(hasForbiddenPhrase(good)).toBe(false);
    expect(isGenericLore(good)).toBe(false);
  });
});

describe("word limit", () => {
  it("flags text above the 40-word ceiling", () => {
    const over = Array.from({ length: 45 }, () => "word").join(" ");
    expect(wordCount(over)).toBe(45);
    expect(exceedsWordLimit(over)).toBe(true);
    expect(isGenericLore(over)).toBe(true);
  });

  it("keeps whole sentences within the budget when cutting", () => {
    const sentence = Array.from({ length: 18 }, () => "w").join(" ") + ".";
    const three = `${sentence} ${sentence} ${sentence}`;
    const cut = truncateToWordLimit(three);
    expect(wordCount(cut)).toBeLessThanOrEqual(MAX_LORE_WORDS);
    // Two whole sentences fit (18+18=36); the third would break the ceiling.
    expect(cut.split(/(?<=[.!?])\s+/).filter(Boolean)).toHaveLength(2);
  });

  it("falls back to a word-boundary cut when a single sentence is over budget", () => {
    const oneLong = Array.from({ length: 45 }, (_, i) => `w${i}`).join(" ") + ".";
    const cut = truncateToWordLimit(oneLong);
    expect(wordCount(cut)).toBe(MAX_LORE_WORDS);
    expect(cut.endsWith(".")).toBe(false);
  });

  it("leaves text within the budget untouched", () => {
    const short = "Melankoli. Kabullenme. Derinlik. Bu, senin huzurun.";
    expect(truncateToWordLimit(short)).toBe(short);
  });
});

describe("cleanLore", () => {
  // Reasoning tags assembled from parts: a source-level tag literal can be
  // mangled by tooling, which is exactly the defect this test guards against.
  const OPEN = ["<", "think", ">"].join("");
  const CLOSE = ["<", "/", "think", ">"].join("");

  it("strips a reasoning block (with or without a leading space) and trims", () => {
    expect(cleanLore(`  ${OPEN}secret${CLOSE}  The lore.  `)).toBe("The lore.");
    expect(cleanLore(`${OPEN}secret${CLOSE}The lore.`)).toBe("The lore.");
    expect(cleanLore("The lore.  ")).toBe("The lore.");
    expect(cleanLore(null)).toBe("");
    expect(cleanLore(undefined)).toBe("");
  });
});
