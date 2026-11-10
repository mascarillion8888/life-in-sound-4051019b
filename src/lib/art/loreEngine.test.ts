import { describe, expect, it, vi } from "vitest";

import {
  buildLoreUserPrompt,
  cleanLore,
  exceedsWordLimit,
  generateLoreCore,
  hasForbiddenPhrase,
  hasLeadingAge,
  hasPromptLeak,
  isCopiedLore,
  isGenericLore,
  lifePeriodForAge,
  LORE_STYLE_VERSION,
  LORE_SYSTEM_PROMPT,
  maxCopySimilarity,
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

  it("exposes at most three cue words per period", () => {
    for (const age of [10, 15, 22, 30, 40]) {
      expect(lifePeriodForAge(age)?.hints.length).toBeLessThanOrEqual(3);
    }
    expect(lifePeriodForAge(40)?.cues).toContain("kabullenme");
    expect(lifePeriodForAge(10)?.cues).toContain("hayal gücü");
  });
});

describe("LORE_SYSTEM_PROMPT (style guide)", () => {
  const mustInclude = (needle: string) => expect(LORE_SYSTEM_PROMPT).toContain(needle);

  it("carries the core formula", () => {
    mustInclude("SONG → AGE → LIFE PERIOD → INNER CONFLICT → EMOTION → LORE");
  });

  it("carries the length rule (1–3 sentences, 8–30, never over 40)", () => {
    mustInclude("1–3 sentences");
    mustInclude("8–30 words");
    mustInclude("40 words");
  });

  it("puts the song first", () => {
    mustInclude("SONG FIRST");
    mustInclude("must never replace the song");
    mustInclude("sentences that could swap places");
  });

  it("forbids opening with the age", () => {
    mustInclude("never begin with the age");
  });

  it("forbids leaking the brief skeleton", () => {
    mustInclude("NEVER LEAK THE BRIEF");
    mustInclude('"Age:"');
    mustInclude('"clues"');
  });

  it("forbids review language anywhere, not only at the start", () => {
    mustInclude("anywhere in the text (not only at the start)");
    mustInclude("Bu şarkı");
    mustInclude("Bu albüm");
    mustInclude("This song");
    mustInclude("This album");
    mustInclude("must-listen");
  });

  it("bans copying the few-shot examples", () => {
    mustInclude("NEVER copy");
  });

  it("carries the no-fabrication ban", () => {
    mustInclude("NO FABRICATION");
    mustInclude("Never quote or paraphrase lyrics");
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

  it("no longer carries the copyable weak/right example lines", () => {
    expect(LORE_SYSTEM_PROMPT).not.toContain("Weak:");
    expect(LORE_SYSTEM_PROMPT).not.toContain("Right:");
    expect(LORE_SYSTEM_PROMPT).not.toContain("The years you first questioned your own limits");
  });

  it("carries the 5-question final check", () => {
    expect(LORE_SYSTEM_PROMPT).toContain("FINAL CHECK");
    expect(LORE_SYSTEM_PROMPT).toContain("Could this text be applied to any song?");
    expect(LORE_SYSTEM_PROMPT).toContain('"this is a moment from my life"');
  });

  it("has a versioned style id", () => {
    expect(LORE_STYLE_VERSION).toBe("lore-v3");
  });
});

describe("buildLoreUserPrompt", () => {
  const base = { songTitle: "Fragile", artist: "Sting", languageName: "English" };

  it("is natural language with no 'key: value' lines", () => {
    const prompt = buildLoreUserPrompt({
      ...base,
      age: 22,
      eraYear: 1987,
      genre: "Gothic Folk",
      releaseYear: 1987,
    });
    expect(prompt).not.toMatch(/\b(age|period|genre|release year|yaş|dönem|tür)\s*:/i);
    expect(prompt).toContain('about the song "Fragile" by Sting');
    expect(prompt).toContain("the genre is Gothic Folk");
    expect(prompt).toContain("it was released in 1987");
  });

  it("states the real age and at most three period cue words", () => {
    const prompt = buildLoreUserPrompt({ ...base, age: 22 });
    expect(prompt).toContain("at age 22");
    expect(prompt).toContain("kendini bulma");
    expect(prompt).toContain("soft frame");
  });

  it("omits the period hint and forbids inventing one when the age is unknown", () => {
    const prompt = buildLoreUserPrompt(base);
    expect(prompt).toContain("age when they first heard it is unknown");
    expect(prompt).toContain("Do not invent an age or a life period");
  });

  it("names the target UI language", () => {
    expect(buildLoreUserPrompt({ ...base, languageName: "Türkçe" })).toContain("in Türkçe");
  });

  it("carries the song-first, no-leading-age and anti-fabrication rules", () => {
    const prompt = buildLoreUserPrompt({ ...base, age: 9 });
    expect(prompt).toContain("Work out the song's own character first");
    expect(prompt).toContain("Do not start with the age");
    expect(prompt).toContain("do not invent lyrics");
    expect(prompt).toContain("never diagnose, label, or pathologize");
  });

  it("ends with the prose-only instruction", () => {
    expect(buildLoreUserPrompt({ ...base, age: 9 })).toContain(
      "Write ONLY the lore text — no labels, no headings, no age/period line, no lists.",
    );
  });

  it("weaves the personal memory when supplied", () => {
    const prompt = buildLoreUserPrompt({ ...base, age: 9, userMemory: "rain on the window" });
    expect(prompt).toContain("Honour this personal memory from the listener: rain on the window");
  });
});

describe("copy protection (few-shot echo)", () => {
  const copied = [
    // EN few-shot, verbatim
    "Epic stories and a world that pushes its own limits.",
    // TR few-shot, verbatim
    "Hız, enerji, isyan ve başkaldırı.",
    // the guide's "right" example, verbatim
    "The years you first questioned your own limits. The moment you began to learn what power is.",
  ];

  it("flags a verbatim few-shot / guide example as GENERIC", () => {
    for (const text of copied) {
      expect(isCopiedLore(text)).toBe(true);
      expect(isGenericLore(text)).toBe(true);
      expect(maxCopySimilarity(text)).toBeGreaterThanOrEqual(1);
    }
  });

  it("passes a fresh, song-specific line", () => {
    const fresh = "Kendi sınırlarını ilk kez zorladığın yıllar. Gücün ne olduğunu öğrendiğin an.";
    expect(isCopiedLore(fresh)).toBe(false);
    expect(isGenericLore(fresh)).toBe(false);
  });
});

describe("prompt-leak filter", () => {
  const leaks = [
    "Age: 40, Period: Memory & acceptance. Conflict/Emotion clues: kabullenme. Genre: Doom Metal. Release year: 2011.",
    "Yaş: 40, Dönem: hafıza, Tür: Doom Metal.",
    "Release year: 1983. The Trooper opens a door.",
    "clues: power, pride",
  ];

  it("flags brief-skeleton output as GENERIC", () => {
    for (const text of leaks) {
      expect(hasPromptLeak(text)).toBe(true);
      expect(isGenericLore(text)).toBe(true);
    }
  });

  it("does not flag ordinary prose", () => {
    expect(hasPromptLeak("Yıllar sonra o dönem bir anahtar oldu.")).toBe(false);
  });
});

describe("leading-age filter", () => {
  const leading = [
    "Age 22. The nights you first tested your own edges.",
    "22 yaş. Kendi sınırlarını ilk kez zorladığın yıllar.",
    "Kırk yaşında. Sessizliğin sana öğrettiği derinlik.",
    "At 22, the world finally had edges.",
  ];

  it("flags a leading age as GENERIC", () => {
    for (const text of leading) {
      expect(hasLeadingAge(text)).toBe(true);
      expect(isGenericLore(text)).toBe(true);
    }
  });

  it("allows the age inside the prose", () => {
    const inside = "Yirmi iki yaşındaydın; o şarkı sana gücü öğretti.";
    expect(hasLeadingAge(inside)).toBe(false);
  });
});

describe("forbidden-phrase filter (TR + EN, anywhere)", () => {
  const rejects = (phrases: string[], alsoGeneric: boolean) => {
    for (const phrase of phrases) {
      expect(hasForbiddenPhrase(phrase)).toBe(true);
      if (alsoGeneric) expect(isGenericLore(phrase)).toBe(true);
    }
  };

  it("catches the English review/ad copy patterns", () => {
    rejects(
      [
        "This song is a must-listen.",
        "This track touches your heart.",
        "Musically, it is unforgettable journey material.",
        "It inspires you every time.",
      ],
      true,
    );
  });

  it("catches the Turkish review/ad copy patterns", () => {
    rejects(
      [
        "Bu şarkı bize huzur verir.",
        "Müzikal olarak çok güçlü.",
        "Kalbinize dokunur.",
        "Size ilham verir.",
        "Mutlaka dinlemelisiniz.",
      ],
      false,
    );
  });

  it("catches the banned phrasing mid-text, not only at the start", () => {
    expect(hasForbiddenPhrase("Yıllar geçti ve bu şarkı hâlâ seninle.")).toBe(true);
    expect(hasForbiddenPhrase("Years passed and this song stayed with you.")).toBe(true);
    expect(isGenericLore("Yıllar geçti ve bu şarkı hâlâ seninle.")).toBe(true);
  });

  it("passes a proper, specific lore line", () => {
    const good = "Epik hikâyeler ve sınırlarını zorlayan bir dünya.";
    expect(hasForbiddenPhrase(good)).toBe(false);
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

describe("generateLoreCore (pipeline)", () => {
  const ENCOUNTER = {
    artist: "Sting",
    songTitle: "Fragile",
    genre: "Gothic Folk",
    releaseYear: 1987,
    encounterAge: 22,
    languageName: "English",
  };
  const GOOD =
    "The nights you first tested your own edges. The moment power stopped being an idea.";

  it("returns provider output on the first clean answer", async () => {
    const write = vi.fn().mockResolvedValue({ text: GOOD, via: "openrouter" });
    const result = await generateLoreCore(ENCOUNTER, write);
    expect(result).toEqual({ text: GOOD, path: "provider" });
    expect(write).toHaveBeenCalledOnce();
  });

  it("rewrites once when the first answer leaks the brief", async () => {
    const write = vi
      .fn()
      .mockResolvedValueOnce({
        text: "Age: 22, Period: exploration. clues: power.",
        via: "openrouter",
      })
      .mockResolvedValueOnce({ text: GOOD, via: "openrouter" });
    const result = await generateLoreCore(ENCOUNTER, write);
    expect(result).toEqual({ text: GOOD, path: "rewrite" });
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1][0]).toContain("write it again");
  });

  it("rewrites once when the first answer copies a few-shot line", async () => {
    const write = vi
      .fn()
      .mockResolvedValueOnce({ text: "Hız, enerji, isyan ve başkaldırı.", via: "openrouter" })
      .mockResolvedValueOnce({ text: GOOD, via: "openrouter" });
    const result = await generateLoreCore(ENCOUNTER, write);
    expect(result.path).toBe("rewrite");
  });

  it("falls to the template when the provider keeps failing the filter", async () => {
    const write = vi
      .fn()
      .mockResolvedValue({ text: "Age: 22. This song is a must-listen.", via: "openrouter" });
    const result = await generateLoreCore(ENCOUNTER, write);
    expect(result.path).toBe("template");
    expect(result.text.length).toBeGreaterThan(20);
  });

  it("falls to the template when there is no provider key (null)", async () => {
    const write = vi.fn().mockResolvedValue({ text: null, via: "openrouter" });
    const result = await generateLoreCore(ENCOUNTER, write);
    expect(result.path).toBe("template");
    expect(write).toHaveBeenCalledOnce();
  });

  it("falls to the template when the provider throws", async () => {
    const write = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await generateLoreCore(ENCOUNTER, write);
    expect(result.path).toBe("template");
  });
});
