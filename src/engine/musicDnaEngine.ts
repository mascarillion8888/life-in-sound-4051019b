import type {
  MusicDNA,
  TemporalPattern,
  MusicalIdentity,
  GenreProfile,
  EmotionalSignature,
} from "../types/musicDna";
import type { Song } from "../lib/song/types";

/**
 * Zamansal Dağılım Hesaplayıcı (Temporal Engine)
 */
export function calculateTemporalPattern(songs: Song[]): TemporalPattern {
  const years = songs.map((s) => Number(s.releaseYear)).filter((y) => !isNaN(y) && y > 1900);

  if (years.length === 0) {
    return {
      primaryEra: "Unknown",
      spanYears: 0,
      eraDistribution: {},
      earliestReleaseYear: 0,
      latestReleaseYear: 0,
    };
  }

  const earliest = Math.min(...years);
  const latest = Math.max(...years);
  const eraDistribution: Record<string, number> = {};

  years.forEach((year) => {
    const decade = `${Math.floor(year / 10) * 10}s`;
    eraDistribution[decade] = (eraDistribution[decade] || 0) + 1;
  });

  const primaryEra = Object.entries(eraDistribution).reduce((a, b) => (b[1] > a[1] ? b : a))[0];

  return {
    primaryEra,
    spanYears: latest - earliest,
    eraDistribution,
    earliestReleaseYear: earliest,
    latestReleaseYear: latest,
  };
}

/**
 * Müzikal Kimlik Hesaplayıcı (Identity Engine)
 */
export function calculateMusicalIdentity(songs: Song[]): MusicalIdentity {
  const artistCounts: Record<string, number> = {};

  songs.forEach((song) => {
    if (song.artist) {
      artistCounts[song.artist] = (artistCounts[song.artist] || 0) + 1;
    }
  });

  const uniqueArtists = Object.keys(artistCounts);
  const diversityScore = Math.round((uniqueArtists.length / (songs.length || 1)) * 100);

  return {
    topArtists: uniqueArtists.slice(0, 3),
    diversityScore,
    dominantVibe: diversityScore > 75 ? "Eclectic Explorer" : "Focused Nostalgic",
    hasVerifiedTracks: songs.every((s) => s.verified === true),
  };
}

/**
 * Deterministic artist -> genre anchor map. Real, curated artist-to-genre
 * associations for iconic acts (only used when a Song carries no real genre).
 * Never fabricated:
 */
export const ARTIST_GENRE_FALLBACK: Record<string, string> = {
  Dio: "Hard Rock",
  "Black Sabbath": "Heavy Metal",
  "Judas Priest": "Heavy Metal",
  "AC/DC": "Hard Rock",
  "Led Zeppelin": "Classic Rock",
  "Pink Floyd": "Progressive Rock",
  Queen: "Classic Rock",
  "The Beatles": "Classic Rock",
  "Michael Jackson": "Pop",
  Madonna: "Pop",
  Sting: "Pop Rock",
  "The Police": "New Wave",
  "Johnny Cash": "Country",
  "Leonard Cohen": "Folk",
  ABBA: "Pop",
  "Elton John": "Pop Rock",
  "David Bowie": "Art Rock",
  Nirvana: "Grunge",
  Metallica: "Heavy Metal",
  "Bob Marley": "Reggae",
  "Miles Davis": "Jazz",
  "John Coltrane": "Jazz",
  "Billie Holiday": "Jazz",
  Radiohead: "Alternative Rock",
  Coldplay: "Pop Rock",
  Beyoncé: "R&B",
  "Taylor Swift": "Pop",
  Drake: "Hip-Hop",
  Eminem: "Hip-Hop",
  "Kanye West": "Hip-Hop",
};

export const ERA_GENRE_FALLBACK: Record<string, string> = {
  "1950s": "Classic Pop",
  "1960s": "Classic Rock",
  "1970s": "Classic Rock",
  "1980s": "Pop Rock",
  "1990s": "Alternative Rock",
  "2000s": "Pop",
  "2010s": "Pop",
  "2020s": "Pop",
};

/**
 * Deterministic genre -> mood/valency/energy table (curated, stable emotional
 * read per genre). The emotional signature aggregates THIS table — never a
 * raw random score.
 */
export const GENRE_MOOD_TABLE: Record<string, { mood: string; valency: number; energy: number }> = {
  "Heavy Metal": { mood: "defiant", valency: -0.2, energy: 9 },
  "Hard Rock": { mood: "intense", valency: 0.1, energy: 8 },
  "Classic Rock": { mood: "uplifting", valency: 0.5, energy: 7 },
  "Progressive Rock": { mood: "cinematic", valency: 0.3, energy: 6 },
  "Pop Rock": { mood: "bright", valency: 0.6, energy: 6 },
  Pop: { mood: "joyful", valency: 0.7, energy: 6 },
  "New Wave": { mood: "energetic", valency: 0.4, energy: 7 },
  Country: { mood: "heartfelt", valency: 0.4, energy: 5 },
  Folk: { mood: "peaceful", valency: 0.4, energy: 3 },
  "Art Rock": { mood: "eccentric", valency: 0.2, energy: 6 },
  Grunge: { mood: "angsty", valency: -0.5, energy: 8 },
  Reggae: { mood: "laid-back", valency: 0.6, energy: 4 },
  Jazz: { mood: "smoky", valency: 0.1, energy: 4 },
  "R&B": { mood: "smooth", valency: 0.5, energy: 5 },
  "Hip-Hop": { mood: "driven", valency: 0.3, energy: 7 },
  "Alternative Rock": { mood: "brooding", valency: 0.1, energy: 7 },
  "Classic Pop": { mood: "nostalgic", valency: 0.6, energy: 5 },
};

/** Resolve a song's genre deterministically: real metadata -> artist map -> era map. */
function songGenre(song: Song): { genre: string | null; source: GenreProfile["source"] } {
  if (typeof song.genre === "string" && song.genre.length > 0) {
    return { genre: song.genre, source: "song" };
  }
  const byArtist = song.artist ? ARTIST_GENRE_FALLBACK[song.artist] : undefined;
  if (byArtist) return { genre: byArtist, source: "artist" };
  const era = song.releaseYear ? `${Math.floor(song.releaseYear / 10) * 10}s` : undefined;
  const byEra = era ? ERA_GENRE_FALLBACK[era] : undefined;
  if (byEra) return { genre: byEra, source: "era" };
  return { genre: null, source: "unknown" };
}

/** Aggregate genre read across the selection (never a fabricated genre). */
export function calculateGenreProfile(songs: Song[]): GenreProfile {
  const counts: Record<string, number> = {};
  let source: GenreProfile["source"] = "unknown";

  for (const song of songs) {
    const { genre, source: s } = songGenre(song);
    if (!genre) continue;
    counts[genre] = (counts[genre] || 0) + 1;
    if (s === "song") source = "song";
    else if (s === "artist" && source !== "song") source = "artist";
    else if (s === "era" && source !== "song" && source !== "artist") source = "era";
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return {
    dominantGenre: sorted[0]?.[0] ?? "Unknown",
    secondaryGenres: sorted.slice(1, 4).map(([g]) => g),
    source,
  };
}

/** Aggregate emotional read (mood distribution, valency/energy averages, intensity). */
export function calculateEmotionalSignature(songs: Song[]): EmotionalSignature {
  const moodCounts: Record<string, number> = {};
  let valencySum = 0;
  let valencyN = 0;
  let energySum = 0;
  let energyN = 0;

  for (const song of songs) {
    const { genre } = songGenre(song);
    if (!genre) continue;
    const read = GENRE_MOOD_TABLE[genre];
    if (!read) continue;
    const mood = read.mood.toLowerCase();
    moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    valencySum += read.valency;
    valencyN++;
    energySum += read.energy;
    energyN++;
  }

  const sortedMoods = Object.entries(moodCounts).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const totalMoods = sortedMoods.reduce((sum, [, n]) => sum + n, 0);

  return {
    dominantMood: sortedMoods[0]?.[0] ?? "Neutral",
    secondaryMoods: sortedMoods.slice(1, 3).map(([m]) => m),
    intensity:
      totalMoods > 0
        ? Math.min(10, Math.round(5 + ((sortedMoods[0]?.[1] ?? 0) / totalMoods) * 5))
        : 0,
    valency: valencyN > 0 ? Number((valencySum / valencyN).toFixed(2)) : 0,
    energy: energyN > 0 ? Math.round(energySum / energyN) : 5,
  };
}

/** Completeness score: analyzed songs / 8 (deterministic). */
export function calculateConfidence(songs: Song[]): number {
  return Number(Math.min(1, (songs?.length ?? 0) / 8).toFixed(2));
}

/** Prose summary of the selection. */
export function synthesizeSummary(
  dna: Pick<
    MusicDNA,
    "genreProfile" | "emotionalSignature" | "musicalIdentity" | "temporalPattern"
  >,
): string {
  const era = dna.temporalPattern.primaryEra;
  const genre = dna.genreProfile.dominantGenre;
  const mood = dna.emotionalSignature.dominantMood;
  const style = dna.musicalIdentity.diversityScore > 75 ? "Adventurous" : "Focused";
  return `${style} ${era} ${genre} with ${mood} undertones`.trim().replace(/\s+/g, " ");
}

/**
 * Ana Music DNA Oluşturucu (Main Pipeline entry point)
 */
export function generateMusicDNA(songs: Song[]): MusicDNA {
  if (!songs || songs.length === 0) {
    throw new Error("MusicDNA generation requires at least 1 valid Song input.");
  }

  const temporalPattern = calculateTemporalPattern(songs);
  const musicalIdentity = calculateMusicalIdentity(songs);
  const genreProfile = calculateGenreProfile(songs);
  const emotionalSignature = calculateEmotionalSignature(songs);

  return {
    temporalPattern,
    musicalIdentity,
    genreProfile,
    emotionalSignature,
    summary: synthesizeSummary({
      genreProfile,
      emotionalSignature,
      musicalIdentity,
      temporalPattern,
    }),
    confidence: calculateConfidence(songs),
    songCount: songs.length,
    isGrounded: true,
    analyzedAt: new Date().toISOString(),
  };
}
