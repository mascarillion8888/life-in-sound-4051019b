import { Song } from '../../types/musicDna';

export interface ExtractedMusicFeatures {
  genre: string | null;
  mood: string | null;
  energyLevel?: number;
  acousticness?: number;
  valence?: number;
}

export function extractMusicFeatures(song: Song): ExtractedMusicFeatures {
  const songData = song as Record<string, unknown>;
  
  const genreVal = song.genre ?? songData.genre;
  const moodVal = song.mood ?? songData.mood;

  return {
    genre: typeof genreVal === 'string' ? genreVal : null,
    mood: typeof moodVal === 'string' ? moodVal : null,
  };
}
