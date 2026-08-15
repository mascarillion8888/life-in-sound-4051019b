/**
 * Database types — source of truth for the journeys table.
 *
 * In a fully wired Supabase project these would be generated via
 * `supabase gen types typescript`; the shape below mirrors migration 0001 and
 * should be kept in sync. Keeping it hand-authored avoids a build dependency
 * on a live project while still making the DB types the single source of truth
 * (the storage layer imports from here, not ad-hoc interfaces).
 */
export type JourneyRow = {
  id: string;
  user_id: string;
  current: number;
  answers: Record<number, string>;
  version: number;
  created_at: string;
  updated_at: string;
};

export type JourneyUpsert = Pick<JourneyRow, "user_id" | "current" | "answers" | "version">;

// ---------------------------------------------------------------------------
// Music Memory Foundation (migration 0002)
// ---------------------------------------------------------------------------
export type MusicExperienceSourceType =
  "streaming" | "traditional" | "family" | "anonymous" | "unknown_title" | "live";

export type MusicExperienceRow = {
  id: string;
  user_id: string;
  source_type: MusicExperienceSourceType;
  title: string | null;
  artist: string | null;
  album: string | null;
  external_ref: string | null;
  source_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MusicExperienceInsert = {
  user_id: string;
  source_type: MusicExperienceSourceType;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  external_ref?: string | null;
  source_notes?: string | null;
};

export type EventTimeGranularity =
  "exact" | "day" | "month" | "year" | "season" | "period" | "unknown";

export type MemoryRow = {
  id: string;
  user_id: string;
  recorded_at: string;
  created_at: string;
  updated_at: string;
  original_user_note: string | null;
  user_note: string | null;
  feeling: string | null;
  life_event: string | null;
  location: string | null;
  weather: string | null;
  event_time_granularity: EventTimeGranularity | null;
  event_time_start: string | null;
  event_time_end: string | null;
  event_time_label: string | null;
  ai_context: Record<string, unknown> | null;
  ai_context_stale_at: string | null;
};

export type MemoryMusicExperienceRow = {
  memory_id: string;
  music_experience_id: string;
  user_id: string;
  position: number;
  role: string | null;
  created_at: string;
};

export type MemoryMusicExperienceInsert = {
  memory_id: string;
  music_experience_id: string;
  user_id: string;
  position: number;
  role?: string | null;
};

export type ReflectionAuthor = "user" | "companion";

export type ReflectionRow = {
  id: string;
  user_id: string;
  memory_id: string;
  author: ReflectionAuthor;
  body: string;
  reflected_at: string;
  created_at: string;
  source_context: Record<string, unknown> | null;
};

export type ReflectionInsert = {
  user_id: string;
  memory_id: string;
  author: ReflectionAuthor;
  body: string;
  source_context?: Record<string, unknown> | null;
};

// ---------------------------------------------------------------------------
// Memory Connections (migration 0003)
// ---------------------------------------------------------------------------

export type ConnectionType = "same_music" | "same_location" | "overlapping_time" | "user_linked";

export type ConnectionSource = "user" | "deterministic" | "ai_suggested";

export type MemoryConnectionRow = {
  id: string;
  user_id: string;
  source_memory_id: string;
  target_memory_id: string;
  connection_type: ConnectionType;
  source: ConnectionSource;
  confidence: number;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type MemoryConnectionInsert = {
  user_id: string;
  source_memory_id: string;
  target_memory_id: string;
  connection_type: ConnectionType;
  source: ConnectionSource;
  confidence?: number;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

// ---------------------------------------------------------------------------
// Pattern Engine Foundation (migration 0004)
// ---------------------------------------------------------------------------

export type PatternType =
  | "repeated_music"
  | "repeated_location"
  | "recurring_time_context"
  | "revisited_memory"
  | "recurring_weather_context"
  | "recurring_user_emotion";

export type PatternStatus = "candidate" | "active" | "dismissed";

export type PatternRow = {
  id: string;
  user_id: string;
  pattern_type: PatternType;
  title: string;
  summary: string;
  confidence: number;
  observed_from: string | null;
  observed_to: string | null;
  status: PatternStatus;
  fingerprint: string;
  evidence_count: number;
  // AI interpretation layer — NULL until generated.
  interpretation: string | null;
  interpretation_model: string | null;
  interpretation_prompt_version: string | null;
  interpretation_created_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PatternMemoryRow = {
  id: string;
  pattern_id: string;
  memory_id: string;
  user_id: string;
  evidence_role: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Life Events + Life Chapters (migration 0005)
// ---------------------------------------------------------------------------

export type LifeEventStatus = "active" | "archived";

export type LifeEventRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  time_precision: EventTimeGranularity;
  time_label: string | null;
  location: string | null;
  status: LifeEventStatus;
  created_at: string;
  updated_at: string;
};

export type LifeChapterRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  time_precision: EventTimeGranularity;
  time_label: string | null;
  status: LifeEventStatus;
  created_at: string;
  updated_at: string;
};

export type LifeEventMemoryRow = {
  id: string;
  user_id: string;
  event_id: string;
  memory_id: string;
  relationship_type: string | null;
  position: number;
  created_at: string;
};

export type ChapterEventRow = {
  id: string;
  user_id: string;
  chapter_id: string;
  event_id: string;
  position: number;
  created_at: string;
};

export type ChapterMemoryRow = {
  id: string;
  user_id: string;
  chapter_id: string;
  memory_id: string;
  position: number;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Media Foundation (migration 0006)
// ---------------------------------------------------------------------------

export type MediaMimeType = "image/jpeg" | "image/png" | "image/webp";

export type MediaRow = {
  id: string;
  user_id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: MediaMimeType;
  byte_size: number;
  width: number | null;
  height: number | null;
  captured_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileMediaRow = {
  id: string;
  user_id: string;
  media_id: string;
  is_current: boolean;
  position: number;
  created_at: string;
};

export type MemoryMediaRow = {
  id: string;
  user_id: string;
  media_id: string;
  memory_id: string;
  position: number;
  created_at: string;
};

export type EventMediaRow = {
  id: string;
  user_id: string;
  media_id: string;
  event_id: string;
  position: number;
  created_at: string;
};

export type ChapterMediaRow = {
  id: string;
  user_id: string;
  media_id: string;
  chapter_id: string;
  position: number;
  created_at: string;
};

export type CompanionConversationStatus = "active" | "archived";
export type CompanionTurnRole = "user" | "assistant" | "system";

export type CompanionConversationRow = {
  id: string;
  user_id: string;
  title: string | null;
  status: CompanionConversationStatus;
  started_at: string;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
};

export type CompanionTurnRow = {
  id: string;
  user_id: string;
  conversation_id: string;
  role: CompanionTurnRole;
  content: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

// ---------------------------------------------------------------------------
// Significant Interactions (migration 0008)
// ---------------------------------------------------------------------------

export type SignificantInteractionKind =
  "directive" | "preference" | "confirmed_context" | "boundary" | "decision";

export type SignificantInteractionStatus = "candidate" | "confirmed" | "dismissed" | "archived";

export type SignificantInteractionSource = "user_explicit" | "ai_classified";

export type SignificantInteractionRow = {
  id: string;
  user_id: string;
  conversation_id: string;
  turn_id: string;
  kind: SignificantInteractionKind;
  candidate_content: string;
  reason: string | null;
  status: SignificantInteractionStatus;
  source: SignificantInteractionSource;
  confidence: number | null;
  fingerprint: string;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Companion Memories (migration 0009)
// ---------------------------------------------------------------------------

/**
 * The kind of a durable Companion Memory. Same constrained set as Significant
 * Interactions — excludes ai_fact / psychological_profile / diagnosis /
 * personality_trait / inferred_relationship / inferred_biography by
 * construction (these are not in the union).
 */
export type CompanionMemoryKind =
  "directive" | "preference" | "confirmed_context" | "boundary" | "decision";

/** active = live; archived = soft-hidden, reversible. No extra lifecycle states. */
export type CompanionMemoryStatus = "active" | "archived";

/**
 * v1 source is always user_confirmed — only confirmed Significant Interactions
 * may become Companion Memory. No ai_generated source is allowed (locked by the
 * DB CHECK constraint).
 */
export type CompanionMemorySource = "user_confirmed";

export type CompanionMemoryRow = {
  id: string;
  user_id: string;
  significant_interaction_id: string;
  kind: CompanionMemoryKind;
  content: string;
  status: CompanionMemoryStatus;
  source: CompanionMemorySource;
  related_memory_id: string | null;
  related_event_id: string | null;
  related_chapter_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};
