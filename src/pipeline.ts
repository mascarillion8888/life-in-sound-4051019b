import analyzeEmotions, { EmotionResult } from './emotionAnalyzer';
import scorePersonality, { ScoreResult } from './personalityScoring';
import generatePoeticSummary, { PoeticSummary } from './poeticSummary';
import recommendSongs, { RecommendedSong, SongMetadata, PersonalityProfile, RecommendationOptions } from './musicRecommendation';
import { createPosterData, PosterData, PosterEffects, Palette } from './posterModel';

export interface ResultsPage {
  emotion: EmotionResult;
  personality: ScoreResult;
  poetic: PoeticSummary;
  recommendations: RecommendedSong[];
  poster: PosterData;
}

export interface PipelineOptions {
  catalog?: SongMetadata[]; // optional music catalog to score against
  recommendationOptions?: RecommendationOptions;
  posterOverrides?: Partial<PosterData>;
}

// Simple palette generator based on personality scores
function paletteFromPersonality(score: ScoreResult): Palette {
  const c = (hex: string) => hex;
  // prioritize colors by dominant trait
  const traits = [
    ['creativity', score.creativity],
    ['openness', score.openness],
    ['empathy', score.empathy],
    ['curiosity', score.curiosity],
    ['optimism', score.optimism],
    ['melancholy', score.melancholy],
  ] as [string, number][];
  traits.sort((a, b) => b[1] - a[1]);
  const top = traits[0][0];

  switch (top) {
    case 'creativity':
      return { primary: '#7C3AED', secondary: '#06B6D4', accent: '#F472B6', colors: ['#7C3AED', '#06B6D4', '#F472B6'] };
    case 'openness':
      return { primary: '#06B6D4', secondary: '#10B981', accent: '#F59E0B', colors: ['#06B6D4', '#10B981', '#F59E0B'] };
    case 'empathy':
      return { primary: '#F97316', secondary: '#FCA5A5', accent: '#FDE68A', colors: ['#F97316', '#FCA5A5', '#FDE68A'] };
    case 'curiosity':
      return { primary: '#06B6D4', secondary: '#7C3AED', accent: '#F59E0B', colors: ['#06B6D4', '#7C3AED', '#F59E0B'] };
    case 'optimism':
      return { primary: '#F59E0B', secondary: '#FDE68A', accent: '#10B981', colors: ['#F59E0B', '#FDE68A', '#10B981'] };
    case 'melancholy':
      return { primary: '#0EA5E9', secondary: '#3B82F6', accent: '#94A3B8', colors: ['#0EA5E9', '#3B82F6', '#94A3B8'] };
    default:
      return { primary: '#FFFFFF', secondary: '#A1A1AA', accent: '#7C3AED', colors: ['#FFFFFF', '#A1A1AA', '#7C3AED'] };
  }
}

// Small default catalog used when none provided
const DEFAULT_CATALOG: SongMetadata[] = [
  {
    id: 's1',
    title: 'Open Roads',
    artist: 'Aurora Lane',
    genres: ['indie', 'ambient'],
    tempoBpm: 95,
    energy: 0.45,
    valence: 0.6,
    acousticness: 0.6,
    moodTags: ['uplifting', 'calm'],
    durationSeconds: 210,
    explicit: false,
  },
  {
    id: 's2',
    title: 'Midnight Questions',
    artist: 'The Quiet Few',
    genres: ['ambient', 'experimental'],
    tempoBpm: 60,
    energy: 0.2,
    valence: 0.35,
    acousticness: 0.8,
    moodTags: ['melancholy', 'reflective'],
    durationSeconds: 260,
    explicit: false,
  },
  {
    id: 's3',
    title: 'Bright Tomorrow',
    artist: 'Fable Sun',
    genres: ['electro-pop'],
    tempoBpm: 120,
    energy: 0.8,
    valence: 0.9,
    acousticness: 0.1,
    moodTags: ['uplifting', 'hopeful'],
    durationSeconds: 180,
    explicit: false,
  },
  {
    id: 's4',
    title: 'Paper Boats',
    artist: 'Harbor Scenes',
    genres: ['folk', 'acoustic'],
    tempoBpm: 78,
    energy: 0.35,
    valence: 0.5,
    acousticness: 0.9,
    moodTags: ['nostalgic', 'melancholy'],
    durationSeconds: 240,
    explicit: false,
  },
];

export default function runPipeline(answers: any[], options: PipelineOptions = {}): ResultsPage {
  // Step 1: Emotion analysis
  const emotion = analyzeEmotions(answers);

  // Step 2: Personality scoring
  const personality = scorePersonality(answers);

  // Step 3: Poetic/story generation
  const poetic = generatePoeticSummary({
    personalityType: personality.personalityType,
    openness: personality.openness,
    empathy: personality.empathy,
    curiosity: personality.curiosity,
    melancholy: personality.melancholy,
    optimism: personality.optimism,
    creativity: personality.creativity,
    dominantEmotion: emotion.dominantEmotion,
    secondaryEmotion: emotion.secondaryEmotion,
    emotionalIntensity: emotion.emotionalIntensity,
  });

  // Step 4: Music recommendations
  // Map personality score result to PersonalityProfile shape
  const profile: PersonalityProfile = {
    personalityType: personality.personalityType,
    openness: personality.openness,
    empathy: personality.empathy,
    curiosity: personality.curiosity,
    melancholy: personality.melancholy,
    optimism: personality.optimism,
    creativity: personality.creativity,
    dominantEmotion: emotion.dominantEmotion,
    secondaryEmotion: emotion.secondaryEmotion || undefined,
    emotionalIntensity: emotion.emotionalIntensity,
    preferredGenres: undefined,
    dislikedGenres: undefined,
    allowExplicit: false,
    contextTags: undefined,
  };

  const catalog = options.catalog ?? DEFAULT_CATALOG;
  const recOptions = options.recommendationOptions ?? { count: 6, diversity: 0.25, seed: personality.personalityType };
  const recommendations = recommendSongs(profile, catalog, recOptions);

  // Step 5: Poster generation data
  const palette = paletteFromPersonality(personality);
  const posterBase = createPosterData({
    title: poetic.title,
    subtitle: poetic.quote,
    palette,
    imagePrompt: typeof options.posterOverrides?.imagePrompt === 'string' ? options.posterOverrides?.imagePrompt : options.posterOverrides?.imagePrompt ?? poetic.story,
  });

  // Merge overrides if provided (shallow)
  const poster = { ...posterBase, ...(options.posterOverrides || {}) } as PosterData;

  // Results page
  const results: ResultsPage = {
    emotion,
    personality,
    poetic,
    recommendations,
    poster,
  };

  return results;
}
