/**
 * Music DNA Type System — Complete Musical Identity
 *
 * Represents the deterministic analysis of 8 selected songs.
 * These types power the transformation from raw Song[] → grounded Life Story.
 *
 * Core principle: Extract only what the Song model provides.
 * Never invent metadata (genre, mood, era mappings only).
 */

/**
 * TemporalPattern — How the 8 songs distribute across decades/eras
 *
 * Used to understand whether the user's music spans generations
 * or clusters in a specific era.
 */
export interface TemporalPattern {
  /**
   * Array of (era, count) tuples.
   * Example: [{ era: "1970s", count: 2 }, { era: "1990s", count: 3 }, ...]
   */
  eraDistribution: Array<{ era: string; count: number }>;

  /** Earliest release year in the selection (or null if unknown) */
  earliestYear: number | null;

  /** Most recent release year in the selection (or null if unknown) */
  latestYear: number | null;

  /**
   * Span in years: latestYear - earliestYear
   * Null if fewer than 2 songs have release years.
   * Indicates breadth of temporal scope (e.g., 50 years = timeless selector).
   */
  spanYears: number | null;

  /**
   * Primary decade where most songs cluster.
   * Example: "1990s", "2000s", or "Unknown" if no release years.
   * Used in prose ("Your music spans the 1990s...").
   */
  dominantEra: string;
}

/**
 * MusicalIdentity — Who you listen to and how
 *
 * Characterizes artist diversity, genre preference, and listening profile.
 */
export interface MusicalIdentity {
  /**
   * Artist diversity score: 0.0–1.0
   * Calculation: uniqueArtistCount / totalSongs
   *
   * Examples:
   *   - All 8 songs by same artist = 1/8 ≈ 0.125 (very loyal)
   *   - 8 different artists = 8/8 = 1.0 (highly eclectic)
   *   - 4 different artists = 4/8 = 0.5 (mixed)
   *
   * Used to determine "Loyal", "Mixed", or "Adventurous" listening profile.
   */
  artistDiversity: number;

  /**
   * Top 3 artists by frequency.
   * Example: [
   *   { name: "The Beatles", frequency: 2 },
   *   { name: "Pink Floyd", frequency: 1 },
   *   { name: "David Bowie", frequency: 1 }
   * ]
   *
   * Frequency is raw count of songs by that artist in the selection.
   * Used in Life Story ("You return to The Beatles...").
   */
  topArtists: Array<{ name: string; frequency: number }>;

  /**
   * Dominant genre from analyzed songs.
   * Example: "Rock", "Hip-Hop", "Classical", "Electronic", "Jazz", "Pop"
   *
   * Extracted from Song.genre if available; falls back to "Unknown".
   * CRITICAL: Never invent genres. If Song.genre is null, skip it.
   */
  dominantGenre: string;

  /**
   * Secondary genres found in the selection.
   * Used for nuance in prose ("Rock with electronic undertones").
   * May be empty if insufficient genre diversity.
   */
  secondaryGenres: string[];

  /**
   * Estimated listening style based on artist diversity and genre richness.
   * Examples: "Loyal (single artist focus)", "Eclectic", "Adventurous (high variety)"
   *
   * Derived deterministically from artistDiversity thresholds:
   *   - < 0.3 → "Loyal"
   *   - 0.3–0.7 → "Eclectic"
   *   - > 0.7 → "Adventurous"
   */
  listeningStyle: string;
}

/**
 * EmotionalSignature — What your music says about your emotional world
 *
 * Captures mood, intensity, energy, and emotional orientation.
 */
export interface EmotionalSignature {
  /**
   * Dominant emotional tone across songs.
   * Examples: "melancholic", "uplifting", "peaceful", "energetic", "aggressive"
   *
   * Extracted from Song.mood if available; falls back to "Neutral".
   * CRITICAL: Never invent moods. If mood unknown, use neutral fallback.
   */
  dominantMood: string;

  /**
   * Secondary emotional tones (up to 2 additional moods).
   * Provides nuance: "Melancholic with aggressive undertones".
   * May be empty if insufficient mood diversity.
   */
  secondaryMoods: string[];

  /**
   * Overall emotional intensity: 1–10 scale
   *
   * Represents how strongly the dominant mood appears.
   * Calculation: frequency of top mood (capped at 10).
   *
   * Examples:
   *   - Intensity 2: Subtle mood signal
   *   - Intensity 5–6: Moderate mood presence
   *   - Intensity 10: Overwhelmingly dominant mood
   */
  intensity: number;

  /**
   * Emotional valency: −1.0 to +1.0
   *
   * Represents emotional direction on a sad-to-happy spectrum.
   * Calculated from mood mapping:
   *   - −1.0 = "sad", "melancholic", "angry"
   *   - 0.0 = "neutral"
   *   - +1.0 = "joyful", "uplifting"
   *
   * Used to understand emotional trajectory in poster theme selection.
   */
  valency: number;

  /**
   * Energy level: 1–10 scale
   *
   * Estimated from genre patterns.
   * Examples:
   *   - Rock, Electronic, Hip-Hop → 7–8 (high energy)
   *   - Jazz, Pop → 5–6 (moderate)
   *   - Classical, Ambient, Folk → 2–4 (low energy)
   *
   * Fallback to 5 if no genre data available.
   * Used to understand listening profile (e.g., "calming" vs "energizing").
   */
  energy: number;
}

/**
 * MusicDNA — The Complete Musical Identity
 *
 * Master data type synthesizing temporal, identity, and emotional analysis.
 * This is the output of generateMusicDNA() and input to grounded Life Story.
 *
 * Guarantees:
 *   - Never invents data beyond deterministic calculations
 *   - Gracefully handles missing/null Song fields
 *   - Confidence score reflects data completeness
 *   - AnalyzedSongs count for transparency
 */
export interface MusicDNA {
  /** Temporal characteristics of the 8 songs */
  temporal: TemporalPattern;

  /** Artist & genre identity profile */
  identity: MusicalIdentity;

  /** Emotional signature and mood profile */
  emotional: EmotionalSignature;

  /**
   * Prose summary synthesizing all three dimensions.
   * Example: "Adventurous 1990s rock with melancholic undertones"
   *
   * Format: [listening style] [era] [genre] with [mood] undertones
   * Used as headline in Results page and Emotional Timeline.
   */
  summary: string;

  /**
   * Confidence score: 0.0–1.0
   *
   * Reflects how complete this analysis is.
   * Calculation: analyzedSongs / 8
   *
   * Examples:
   *   - 8 songs with full metadata → 1.0 (high confidence)
   *   - 4 songs → 0.5 (moderate)
   *   - 0 songs → 0.0 (no data)
   *
   * Used to display certainty warnings in UI and fallback appropriately.
   */
  confidence: number;

  /**
   * Count of non-null songs analyzed.
   * Reflects how much data fed this Music DNA.
   *
   * Examples:
   *   - analyzedSongs = 8 → all 8 questions answered
   *   - analyzedSongs = 4 → incomplete journey (resume case)
   *   - analyzedSongs = 0 → no songs selected (fallback only)
   *
   * Stored for debugging and transparency in analytics.
   */
  analyzedSongs: number;
}

/**
 * Fallback MusicDNA for missing/empty data
 *
 * Returned by generateMusicDNA() when no valid songs are provided.
 * Allows graceful degradation without throwing errors.
 */
export const FALLBACK_MUSIC_DNA: MusicDNA = {
  temporal: {
    eraDistribution: [],
    earliestYear: null,
    latestYear: null,
    spanYears: null,
    dominantEra: "Unknown",
  },
  identity: {
    artistDiversity: 0,
    topArtists: [],
    dominantGenre: "Unknown",
    secondaryGenres: [],
    listeningStyle: "Undefined",
  },
  emotional: {
    dominantMood: "Neutral",
    secondaryMoods: [],
    intensity: 0,
    valency: 0,
    energy: 5,
  },
  summary: "No songs analyzed",
  confidence: 0,
  analyzedSongs: 0,
};
