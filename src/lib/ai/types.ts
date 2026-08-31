import type { MusicDNA } from "../analytics/music-dna-engine";

/** Shared types for the AI Personality Analysis pipeline. */

/** Answers as stored by the journey: question id -> song title. */
export type JourneyAnswers = Record<number, string>;

/** Optional deterministic Music DNA attached to a journey payload (computed exclusively from `songs[]`, never from `answers[]`). */
export type JourneyWithDna = {
  musicDNA?: MusicDNA;
};

/** Deterministic personality dimensions supported by the 8 journey questions. */
export type PersonalityDimension =
  "introspection" | "nostalgia" | "energy" | "melancholy" | "hope" | "rebellion" | "connection";

export type PersonalityScores = Record<PersonalityDimension, number>;

export type EmotionProfile = {
  dominantEmotion: string;
  secondaryEmotions: string[];
  intensity: number; // 0..1
};

export type MusicProfile = {
  primaryGenres: string[];
  secondaryGenres: string[];
  mood: string;
  listeningStyle: string;
};

export type PosterModel = {
  headline: string;
  subheadline: string;
  archetype: string;
  paletteLabel: string;
  keywords: string[];
};

export type PersonalityProfile = {
  archetype: string;
  title: string;
  description: string;
  emotionalProfile: string[];
  traits: string[];
  musicProfile: string;
  recommendedGenres: string[];
  confidence: number; // 0..1
  scores: PersonalityScores;
  emotions: EmotionProfile;
  music: MusicProfile;
  poeticSummary: string;
  poster: PosterModel;
};
