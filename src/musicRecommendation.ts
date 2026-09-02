// Music recommendation engine interfaces and a lightweight deterministic example implementation.
// Input: PersonalityProfile
// Output: RecommendedSong[]

export type EmotionLabel =
  | 'joy'
  | 'sadness'
  | 'anger'
  | 'fear'
  | 'surprise'
  | 'disgust'
  | 'trust'
  | 'anticipation'
  | 'melancholy'
  | 'calm'
  | string; // allow extension

// Personality profile shape accepted by the recommender
export interface PersonalityProfile {
  // Core trait scores 0..100
  personalityType?: string;
  openness?: number;
  empathy?: number;
  curiosity?: number;
  melancholy?: number;
  optimism?: number;
  creativity?: number;

  // Emotional context
  dominantEmotion?: EmotionLabel;
  secondaryEmotion?: EmotionLabel | null;
  emotionalIntensity?: number; // 0..100

  // Optional user preferences that the engine can use to refine results
  preferredGenres?: string[]; // e.g., ['ambient', 'indie', 'classical']
  dislikedGenres?: string[];
  preferredTempoBpm?: { min?: number; max?: number };
  allowExplicit?: boolean;
  // A free-form tag set such as moods, activities, or contexts (e.g., ['focus','workout'])
  contextTags?: string[];
}

// Catalog metadata for a single song — the recommendation engine uses these fields to score
export interface SongMetadata {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  genres?: string[]; // free-form genre tags
  durationSeconds?: number;
  tempoBpm?: number; // beats per minute if known
  energy?: number; // 0..1 (higher = more energetic)
  valence?: number; // 0..1 (lower = sad/negative, higher = happy/positive)
  acousticness?: number; // 0..1 (higher = more acoustic/softer)
  danceability?: number; // 0..1
  moodTags?: string[]; // e.g., ['melancholy','uplifting']
  explicit?: boolean;
  // any additional metadata the caller provides
  [k: string]: any;
}

// Recommended song structure returned by the engine
export interface RecommendedSong extends SongMetadata {
  matchScore: number; // 0..100 overall match score
  reason?: string; // short human-readable explanation for why the song was recommended
}

// Options to tune recommendation behaviour
export interface RecommendationOptions {
  count?: number; // number of recommendations to return (default 10)
  diversity?: number; // 0..1, higher means prefer genre variety (default 0.3)
  seed?: number | string; // optional deterministic seed
  allowExplicit?: boolean; // override profile
}

// Utility: clamp between 0 and 1
function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function seededRngFromString(seedStr: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let s = h;
  return () => {
    // xorshift32
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967295;
  };
}

// Basic mapping from personality profile to target audio/mood features.
// This is intentionally simple and transparent — replace with learned models as desired.
function buildTargetFromProfile(profile: PersonalityProfile) {
  const openness = clamp01((profile.openness ?? 50) / 100);
  const empathy = clamp01((profile.empathy ?? 50) / 100);
  const curiosity = clamp01((profile.curiosity ?? 50) / 100);
  const melancholy = clamp01((profile.melancholy ?? 50) / 100);
  const optimism = clamp01((profile.optimism ?? 50) / 100);
  const creativity = clamp01((profile.creativity ?? 50) / 100);
  const intensity = clamp01((profile.emotionalIntensity ?? 50) / 100);

  // target valence: optimism and empathy push valence up, melancholy pulls it down
  const targetValence = clamp01(optimism * 0.7 + empathy * 0.2 - melancholy * 0.6 + 0.5 * (creativity - 0.5));

  // target energy: creativity, openness, curiosity increase energy; melancholy reduces it
  const targetEnergy = clamp01(openness * 0.3 + creativity * 0.4 + curiosity * 0.2 - melancholy * 0.3 + intensity * 0.2);

  // target acousticness: melancholy and empathy prefer more acoustic / intimate textures
  const targetAcousticness = clamp01((melancholy + empathy * 0.6 - creativity * 0.2 + (1 - targetEnergy) * 0.4));

  // target tempo (bpm) relative preference — returns a preferred bpm center
  const baseBpm = 100;
  const bpmShift = (targetEnergy - targetAcousticness) * 60; // energy pushes tempo up, acousticness down
  const targetTempo = Math.max(50, Math.min(180, baseBpm + bpmShift));

  // mood boosts from dominantEmotion
  const emotionBoost: Record<string, { valence?: number; energy?: number; tags?: string[] }> = {
    joy: { valence: 0.2, energy: 0.15, tags: ['uplifting', 'happy'] },
    sadness: { valence: -0.3, energy: -0.2, tags: ['melancholy', 'sad'] },
    anger: { valence: -0.2, energy: 0.3, tags: ['angry'] },
    fear: { valence: -0.25, energy: -0.1, tags: ['tense'] },
    surprise: { valence: 0.05, energy: 0.1, tags: ['surprising', 'quirky'] },
    calm: { valence: 0.05, energy: -0.2, tags: ['ambient', 'calm'] },
    melancholy: { valence: -0.2, energy: -0.15, tags: ['melancholy'] },
    optimism: { valence: 0.25, energy: 0.1, tags: ['hopeful'] },
    creativity: { valence: 0.05, energy: 0.1, tags: ['experimental'] },
  };

  const emotion = (profile.dominantEmotion || '').toLowerCase();
  const boost = emotionBoost[emotion] ?? {};

  return {
    valence: clamp01(targetValence + (boost.valence ?? 0)),
    energy: clamp01(targetEnergy + (boost.energy ?? 0)),
    acousticness: clamp01(targetAcousticness),
    tempo: targetTempo,
    moodTags: boost.tags ?? [],
  };
}

// Score a song given a target
function scoreSong(song: SongMetadata, target: ReturnType<typeof buildTargetFromProfile>, profile: PersonalityProfile) {
  // start with 0..1 score
  let score = 0;
  let weightSum = 0;

  if (typeof song.valence === 'number') {
    const d = 1 - Math.abs((song.valence - target.valence));
    score += d * 1.2; // valence is important
    weightSum += 1.2;
  }

  if (typeof song.energy === 'number') {
    const d = 1 - Math.abs((song.energy - target.energy));
    score += d * 1.1;
    weightSum += 1.1;
  }

  if (typeof song.acousticness === 'number') {
    const d = 1 - Math.abs(song.acousticness - target.acousticness);
    score += d * 0.9;
    weightSum += 0.9;
  }

  if (typeof song.tempoBpm === 'number') {
    // prefer songs within a window of 20bpm of target
    const delta = Math.abs(song.tempoBpm - target.tempo);
    const tempoScore = clamp01(1 - delta / 60);
    score += tempoScore * 0.6;
    weightSum += 0.6;
  }

  // genre and mood tag matches
  const prefGenres = (profile.preferredGenres || []).map(g => g.toLowerCase());
  const songGenres = (song.genres || []).map(g => String(g).toLowerCase());
  const genreMatch = prefGenres.length ? prefGenres.filter(g => songGenres.includes(g)).length / prefGenres.length : 0;
  if (genreMatch > 0) {
    score += genreMatch * 0.9;
    weightSum += 0.9;
  }

  // mood tag overlap
  const targetMoodTags = target.moodTags || [];
  const songMoods = (song.moodTags || []).map(t => String(t).toLowerCase());
  const moodMatch = targetMoodTags.length ? targetMoodTags.filter(t => songMoods.includes(t)).length / targetMoodTags.length : 0;
  if (moodMatch > 0) {
    score += moodMatch * 0.8;
    weightSum += 0.8;
  }

  // penalize explicit if user disallows
  if (song.explicit && profile.allowExplicit === false) {
    score -= 0.5;
    weightSum += 0.5;
  }

  // small random tie-breaker based on song id
  const rng = seededRngFromString(song.id || song.title || '');
  const noise = rng() * 0.05; // up to 0.05 noise
  score += noise;
  weightSum += 0.05;

  const finalNormalized = weightSum > 0 ? clamp01(score / weightSum) : 0;
  return finalNormalized;
}

// Public API: recommend songs from a catalog for a given PersonalityProfile
export default function recommendSongs(
  profile: PersonalityProfile,
  catalog: SongMetadata[],
  options: RecommendationOptions = {}
): RecommendedSong[] {
  const count = options.count ?? 10;
  const allowExplicit = options.allowExplicit ?? profile.allowExplicit ?? true;

  const seedStr = typeof options.seed === 'string' ? options.seed : (String(options.seed ?? profile.personalityType ?? ''));
  const rng = seededRngFromString(seedStr || '');

  const target = buildTargetFromProfile(profile);

  // build scored list
  const scored = catalog
    .filter(s => allowExplicit || !s.explicit)
    .map(s => ({
      song: s,
      score: scoreSong(s, target, { ...profile, allowExplicit }),
    }))
    .sort((a, b) => b.score - a.score);

  // apply a lightweight diversity re-ranking if requested
  const diversity = clamp01(options.diversity ?? 0.3);
  const selected: RecommendedSong[] = [];
  const seenGenres: Set<string> = new Set();

  for (const item of scored) {
    if (selected.length >= count) break;
    const s = item.song;
    // compute genre novelty factor
    const genres = (s.genres || []).map(g => String(g).toLowerCase());
    const genreOverlap = genres.some(g => seenGenres.has(g)) ? 1 : 0;

    // diversity penalty: prefer songs with new genres when diversity high
    const diversityPenalty = genreOverlap * diversity * 0.4; // scales how strongly to penalize
    const adjustedScore = item.score - diversityPenalty;

    // simple thresholding + small randomness for determinism
    if (adjustedScore > 0.05 || selected.length < Math.max(2, Math.floor(count * 0.2))) {
      selected.push({
        ...s,
        matchScore: Math.round(clamp01(adjustedScore) * 10000) / 100, // 0..100 two decimals
        reason: `Match ${Math.round(item.score * 100)}% to profile targets`,
      });
      // mark genres
      for (const g of genres) seenGenres.add(g);
    }
  }

  // if not enough recommendations, fill from top of scored
  if (selected.length < count) {
    for (const item of scored) {
      if (selected.length >= count) break;
      if (selected.some(x => x.id === item.song.id)) continue;
      selected.push({
        ...item.song,
        matchScore: Math.round(clamp01(item.score) * 10000) / 100,
        reason: `Match ${Math.round(item.score * 100)}% to profile targets (fallback)`,
      });
    }
  }

  // final deterministic shuffle by seed to present varied but repeatable ordering
  const final = selected.slice();
  for (let i = final.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = final[i];
    final[i] = final[j];
    final[j] = tmp;
  }

  return final.slice(0, count);
}
