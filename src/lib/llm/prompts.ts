/**
 * Grounded Life Story prompt — input contract and grounding rules.
 *
 * INPUT (authoritative, supplied by the deterministic AI pipeline):
 *   - PersonalityProfile (from src/lib/ai/pipeline.ts analyzeUserJourney)
 *   - songs[0..7] (user-provided song title strings, one per journey question)
 *
 * The LLM is ONLY responsible for narrative interpretation and prose. It must
 * never invent personal facts. See GROUNDING_RULES below.
 *
 * This module is pure string construction — no network, no keys, safe to import
 * from tests and from the client (it contains no secrets and performs no I/O).
 * It is kept separate from orchestra.ts so the prompt contract can be tested
 * without any provider access.
 */
import type { PersonalityProfile } from "@/lib/ai/types";

export type LifeStoryInput = {
  profile: PersonalityProfile;
  songs: string[];
};

/** The deterministic Life Story template — used as the fallback narrative. */
export function deterministicLifeStory(songs: string[]): string {
  const s = (i: number) => songs[i] ?? `Untitled track ${i + 1}`;
  return [
    `It begins with ${s(0)} — a sound from a version of you that had not yet learned to be careful. By the time ${s(1)} arrived, everything felt urgent, and music was the only language large enough for it.`,
    `Then someone became a melody: ${s(2)}. And when things came apart, ${s(3)} held the weight for you until you could carry it again.`,
    `You found your spine again in ${s(4)}, kept someone close through ${s(5)}, and changed direction to ${s(6)}. If the credits rolled tomorrow, they would roll over ${s(7)}.`,
  ].join("\n\n");
}

const GROUNDING_RULES = [
  "Use ONLY the information supplied below. Do not invent facts.",
  "Do not claim knowledge of the user's real life, real relationships, or real history.",
  "Do not invent people, places, locations, dates, times, weather, life events, or memories.",
  "Do not invent song titles or artists that were not supplied.",
  "If you have genuine knowledge of a supplied song's or album's real theme, mood, lyrical content, or cultural context, USE IT to enrich the interpretation — this is not fabrication, it is real-world knowledge about an existing work. What you must not do is invent facts about the USER's personal life (their real relationships, locations, dates, or events) — the song's own meaning is fair game, the user's biography is not.",
  "Do not invent chronology beyond the order in which the songs were supplied.",
  "Emotional interpretation is allowed, but only when grounded in the supplied personality profile and emotion information.",
  "Write empathetically and poetically, without pretending to know facts that were not supplied.",
  "Do not produce generic motivational content. Reflect on the relationship between the supplied songs and the supplied personality profile.",
  "Output narrative prose only. No JSON. No markdown headings. No bullet lists. No metadata.",
];

function summariseProfile(profile: PersonalityProfile): string {
  const emotions = profile.emotionalProfile.join(", ");
  const traits = profile.traits.join(", ");
  const genres = profile.recommendedGenres.join(", ");
  const keywords = profile.poster.keywords.join(", ");
  return [
    `Archetype: ${profile.archetype}`,
    `Archetype title: ${profile.title}`,
    `Dominant and secondary emotions: ${emotions}`,
    `Traits: ${traits}`,
    `Mood: ${profile.music.mood}`,
    `Listening style: ${profile.music.listeningStyle}`,
    `Recommended genres: ${genres}`,
    `Poetic summary (deterministic): ${profile.poeticSummary}`,
    `Poster headline: ${profile.poster.headline}`,
    `Poster subheadline: ${profile.poster.subheadline}`,
    `Poster keywords: ${keywords}`,
  ].join("\n");
}

function summariseSongs(songs: string[]): string {
  return songs.map((s, i) => `${i + 1}. ${s}`).join("\n");
}

/**
 * Build the grounded Life Story prompt. Returns the user message string that
 * is sent to the Orchestra role. Contains explicit grounding rules and only
 * the supplied factual inputs.
 */
export function buildLifeStoryPrompt(input: LifeStoryInput): string {
  const songsBlock = summariseSongs(input.songs);
  const profileBlock = summariseProfile(input.profile);
  const rulesBlock = GROUNDING_RULES.map((r, i) => `${i + 1}. ${r}`).join("\n");

  return [
    "You are the narrative voice of Life in a Sound.",
    "",
    "INPUT:",
    "A deterministic personality profile and the user's selected songs.",
    "",
    "PERSONALITY PROFILE (deterministic, factual):",
    profileBlock,
    "",
    "SELECTED SONGS (in journey order; user-provided labels only):",
    songsBlock,
    "",
    "RULES:",
    rulesBlock,
    "",
    "TASK:",
    "Write a single coherent Life Story (3-5 short paragraphs) that reflects on the relationship between the user's selected songs and the deterministic personality profile above. Weave the song titles into the narrative naturally. The story should feel personal and specific to the supplied profile and songs, not generic.",
    "Where you recognize the song or album, draw on its real, known themes and emotional tone to deepen the interpretation - don't just weave the title into generic prose. If you don't recognize a song, interpret it through the supplied personality profile instead, without pretending to know it.",
  ].join("\n");
}
