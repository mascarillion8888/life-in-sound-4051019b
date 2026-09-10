/** Shared types for the AI Personality Analysis pipeline. */

/** Answers as stored by the journey: question id -> song title. */
export type JourneyAnswers = Record<number, string>;

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

/** Concrete, renderable visual spec derived from personality + emotion + music. */
export type PosterVisual = {
  /** Poster background base color. */
  background: string;
  /** Primary accent (title gradient start). */
  accent: string;
  /** Secondary accent (title gradient end). */
  accentSoft: string;
  /** Atmospheric glow color (rgba-friendly hex). */
  glow: string;
  /** Body/label text color. */
  text: string;
  /** Muted text color. */
  textMuted: string;
  /** Background motif driven by the music profile. */
  motif: "waveform" | "orbit" | "grid" | "rays";
  /** 0..1 — emotional intensity; drives glow strength and motif amplitude. */
  intensity: number;
  /** Title gradient angle in degrees, derived deterministically from the archetype. */
  gradientAngle: number;
};

export type PosterModel = {
  headline: string;
  subheadline: string;
  archetype: string;
  paletteLabel: string;
  keywords: string[];
  visual: PosterVisual;
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
