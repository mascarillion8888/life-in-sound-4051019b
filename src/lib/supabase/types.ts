/**
 * Database types — source of truth for the journeys table.
 *
 * In a fully wired Supabase project these would be generated via
 * `supabase gen types typescript`; the shape below mirrors migrations 0001 and
 * 0002 and should be kept in sync. Keeping it hand-authored avoids a build
 * dependency on a live project while still making the DB types the single
 * source of truth (the storage layer imports from here, not ad-hoc interfaces).
 */
import type { Song } from "../song/types";
import type { MusicDNA } from "../analytics/music-dna-engine";

export type JourneyRow = {
  id: string;
  user_id: string;
  current: number;
  answers: Record<number, string>;
  /** Structured Song selections per question id (migration 0002). */
  songs: Record<number, Song>;
  musicDNA?: MusicDNA | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type JourneyUpsert = Pick<
  JourneyRow,
  "user_id" | "current" | "answers" | "songs" | "musicDNA" | "version"
>;
