import { describe, expect, it } from "vitest";

import { MOOD_SET } from "@/lib/ai/moodInference";
import { HERO_BY_MOOD, heroForMood, maxHeroLength } from "./posterHero";

/**
 * Dilim 2 (İş 3) — hero line derivation from a real inferred mood.
 *
 * Contract: a hero exists for every MOOD_SET member in both tr and en, each
 * describing the SONG LIST (never the user). Null mood / null mapping → null
 * (caller must never pass a fabricated/fallback mood — N8). Every hero stays
 * within the poster's 90-char cap so renderPoster never truncates mid-word.
 */
describe("heroForMood", () => {
  it.each([...MOOD_SET])("returns a localized hero for every Mood (%s)", (mood) => {
    const tr = heroForMood(mood, "tr");
    const en = heroForMood(mood, "en");
    expect(tr).not.toBeNull();
    expect(en).not.toBeNull();
    expect(tr!.length).toBeGreaterThan(0);
    expect(en!.length).toBeGreaterThan(0);
  });

  it("returns null for a null mood", () => {
    expect(heroForMood(null, "tr")).toBeNull();
    expect(heroForMood(undefined, "en")).toBeNull();
  });

  it("returns null for an unknown/unmapped mood string (N8 — no fabrication)", () => {
    // Casting a non-mood through the type is the only way to simulate an
    // unexpected value; heroForMood must refuse it rather than invent text.
    const unknown = "Ambient" as unknown as (typeof MOOD_SET)[number];
    expect(heroForMood(unknown, "tr")).toBeNull();
    expect(heroForMood(unknown, "en")).toBeNull();
  });

  it("every TR and EN hero describes the list, stays under 90 chars", () => {
    expect(maxHeroLength()).toBeLessThanOrEqual(90);
    // Spot-check a few entries for the intended framing (list, not user).
    expect(HERO_BY_MOOD.tr.Energetic).toContain("Bu liste");
    expect(HERO_BY_MOOD.en.Dreamy).toContain("list");
  });
});
