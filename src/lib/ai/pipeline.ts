import { questions } from "@/lib/questions";
import { analyzeEmotions } from "./emotionAnalyzer";
import { recommendMusic } from "./musicRecommendation";
import { answeredCount, rankedDimensions, scorePersonality } from "./personalityScoring";
import { writePoeticSummary } from "./poeticSummary";
import { buildPosterModel } from "./posterModel";
import type { JourneyAnswers, PersonalityProfile } from "./types";
import type { Song } from "@/lib/song/types";
import type { LifeContext } from "@/types/musicDna";
import type { GroundedLifeStory } from "@/types/lifeStory";
import type { EmotionalTimeline } from "@/types/emotionalTimeline";
import { generateMusicDNA } from "@/engine/musicDnaEngine";
import { generateGroundedLifeStory } from "@/engine/lifeStoryEngine";
import { generateEmotionalTimeline } from "@/engine/emotionalTimelineEngine";

const ARCHETYPE_BY_DIMENSION: Record<
  string,
  { archetype: string; title: string; description: string; traits: string[] }
> = {
  introspection: {
    archetype: "The Quiet Cartographer",
    title: "You map yourself in silence",
    description:
      "You listen inward first. Songs are less soundtrack than mirror — you return to the ones that explain you to yourself.",
    traits: ["Reflective", "Observant", "Deliberate"],
  },
  nostalgia: {
    archetype: "The Keeper",
    title: "You carry every year with you",
    description:
      "Music is memory for you. A few opening seconds can return an entire era, intact, and you rarely let those eras go.",
    traits: ["Sentimental", "Loyal", "Vivid-memoried"],
  },
  energy: {
    archetype: "The Ignition",
    title: "You turn the volume into momentum",
    description:
      "You use music to move. The right track straightens your back and makes an ordinary hour feel like a scene worth watching.",
    traits: ["Driven", "Expressive", "Kinetic"],
  },
  melancholy: {
    archetype: "The Deep Listener",
    title: "You find beauty in the heavy notes",
    description:
      "You don't run from the sad songs — you sit with them. That willingness gives your taste unusual depth and honesty.",
    traits: ["Empathetic", "Honest", "Contemplative"],
  },
  hope: {
    archetype: "The Horizon Seeker",
    title: "You listen for what comes next",
    description:
      "Even in the slow songs you hear an opening. Music is how you rehearse the version of your life that hasn't happened yet.",
    traits: ["Optimistic", "Forward-looking", "Resilient"],
  },
  rebellion: {
    archetype: "The Signal Breaker",
    title: "You never took the default track",
    description:
      "Your taste has edges. The songs that matter most to you are the ones that gave you permission to disagree.",
    traits: ["Independent", "Bold", "Unfiltered"],
  },
  connection: {
    archetype: "The Bridge",
    title: "Your songs are full of other people",
    description:
      "Almost every track you love has a person inside it. Music is how you keep them near, present or not.",
    traits: ["Warm", "Devoted", "Relational"],
  },
};

/**
 * Main entry point of the AI personality pipeline.
 * Journey answers → personality → emotion → music → summary → poster.
 * Fully deterministic: identical answers always produce an identical profile.
 */
export function analyzeUserJourney(
  answers: JourneyAnswers | null | undefined,
): PersonalityProfile | null {
  const safeAnswers: JourneyAnswers = answers ?? {};
  const answered = answeredCount(safeAnswers);
  if (answered === 0) return null;

  const scores = scorePersonality(safeAnswers);
  const emotions = analyzeEmotions(scores);
  const music = recommendMusic(scores, emotions);
  const poeticSummary = writePoeticSummary(scores, emotions, music);

  const [first] = rankedDimensions(scores);
  const base = ARCHETYPE_BY_DIMENSION[first] ?? ARCHETYPE_BY_DIMENSION.introspection;

  const poster = buildPosterModel(base.archetype, base.title, emotions, music);

  const coverage = answered / Math.max(questions.length, 1);
  const confidence = Number(
    Math.min(0.96, 0.4 + coverage * 0.45 + emotions.intensity * 0.15).toFixed(2),
  );

  return {
    archetype: base.archetype,
    title: base.title,
    description: base.description,
    emotionalProfile: [emotions.dominantEmotion, ...emotions.secondaryEmotions],
    traits: base.traits,
    musicProfile: `${music.mood} — ${music.listeningStyle.toLowerCase()}`,
    recommendedGenres: [...music.primaryGenres, ...music.secondaryGenres],
    confidence,
    scores,
    emotions,
    music,
    poeticSummary,
    poster,
  };
}

/**
 * Master-gap stage names for the 8-question journey. Mirrors the default
 * EN eraTitles in lifeCards.ts — the grounded engines only need a stable
 * stage label per LifeContext.
 */
const GROUNDED_STAGE_NAMES = [
  "Childhood",
  "First Signature",
  "Rebellion",
  "Inquiry",
  "Steel",
  "Darkness",
  "Longing",
  "Acceptance",
] as const;

/**
 * Master gap integration (P0+P2+P3): build Music DNA → Grounded Life Story →
 * Emotional Timeline from the journey selections. Songs must be provider-verified
 * (Song[]); stage names come from the 8-era ordering. Fed hip from the wire
 * path: `results.tsx` reads this instead of the raw selection list.
 */
export function generateGroundedAnalysis(
  songs: Song[],
  contexts?: LifeContext[],
): {
  dna: ReturnType<typeof generateMusicDNA>;
  story: GroundedLifeStory;
  timeline: EmotionalTimeline;
} {
  if (!songs || songs.length === 0) {
    throw new Error("Grounded analysis requires at least 1 valid Song input.");
  }

  const lifeContexts: LifeContext[] =
    contexts && contexts.length
      ? contexts
      : songs.map((song, idx) => ({
          questionId: idx + 1,
          stageName: GROUNDED_STAGE_NAMES[Math.min(idx, GROUNDED_STAGE_NAMES.length - 1)],
          song,
        }));

  const dna = generateMusicDNA(songs);
  const story = generateGroundedLifeStory(dna, lifeContexts);
  const timeline = generateEmotionalTimeline(dna, lifeContexts);

  return { dna, story, timeline };
}
