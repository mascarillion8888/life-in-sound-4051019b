/**
 * Domain types for the Music Memory foundation.
 *
 * These are the shapes the persistence layer (memory-remote.ts) and future UI
 * work with. They are kept separate from the raw Supabase row types
 * (src/lib/supabase/types.ts) so the domain model is not coupled to the DB
 * column naming/versioning, and so the "Memory requires >=1 Music Experience"
 * invariant can be expressed at the type level.
 */
import type {
  EventTimeGranularity,
  ConnectionSource,
  ConnectionType,
  LifeEventStatus,
  MediaMimeType,
  MusicExperienceSourceType,
  PatternStatus,
  PatternType,
  ReflectionAuthor,
} from "@/lib/supabase/types";

// Re-export so consumers can import connection + pattern + life + media types from the domain module.
export type {
  ConnectionSource,
  ConnectionType,
  LifeEventStatus,
  MediaMimeType,
  PatternStatus,
  PatternType,
};

/** A piece of music the user encountered. title is optional (unknown music). */
export type MusicExperience = {
  id?: string;
  sourceType: MusicExperienceSourceType;
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  externalRef?: string | null;
  sourceNotes?: string | null;
};

/** Approximate-time model. granularity documents precision. */
export type EventTime = {
  granularity?: EventTimeGranularity;
  start?: string | null;
  end?: string | null;
  label?: string | null;
};

/**
 * A Memory capture request. At least one Music Experience is required
 * (enforced at the type level via the non-empty tuple and at runtime by the
 * persistence layer's atomic create).
 */
export type MemoryCapture = {
  musicExperiences: [MusicExperience, ...MusicExperience[]];
  userNote?: string | null;
  feeling?: string | null;
  lifeEvent?: string | null;
  location?: string | null;
  weather?: string | null;
  eventTime?: EventTime;
  recordedAt?: string;
};

/** A bridge link: which Experience, in what position, with what role. */
export type MemoryMusicExperienceLink = {
  musicExperienceId: string;
  position: number;
  role?: string | null;
};

/** A loaded Memory with its Experiences attached. */
export type Memory = {
  id: string;
  userId: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
  originalUserNote: string | null;
  userNote: string | null;
  feeling: string | null;
  lifeEvent: string | null;
  location: string | null;
  weather: string | null;
  eventTime: EventTime;
  /** AI-derived context; never source of truth. */
  aiContext: Record<string, unknown> | null;
  /** When non-null, aiContext is stale and should be regenerated. */
  aiContextStaleAt: string | null;
  musicExperiences: Array<{
    musicExperienceId: string;
    position: number;
    role: string | null;
    experience: {
      id: string;
      sourceType: MusicExperienceSourceType;
      title: string | null;
      artist: string | null;
      album: string | null;
      externalRef: string | null;
      sourceNotes: string | null;
    };
  }>;
};

/** Fields a user may update on a Memory. Never includes original_user_note. */
export type MemoryUpdate = {
  userNote?: string | null;
  feeling?: string | null;
  lifeEvent?: string | null;
  location?: string | null;
  weather?: string | null;
  eventTime?: EventTime;
};

/** A reflection to add. author = 'user' | 'companion'. */
export type ReflectionAdd = {
  memoryId: string;
  author: ReflectionAuthor;
  body: string;
  sourceContext?: Record<string, unknown> | null;
};

/** A loaded reflection. */
export type Reflection = {
  id: string;
  userId: string;
  memoryId: string;
  author: ReflectionAuthor;
  body: string;
  reflectedAt: string;
  createdAt: string;
  sourceContext: Record<string, unknown> | null;
};

// ---------------------------------------------------------------------------
// Memory Connections (migration 0003)
// ---------------------------------------------------------------------------

/**
 * A persisted connection between two memories. Stored with normalized ordering
 * (lower id = source) for undirected deterministic types. AI-suggested
 * connections carry source = "ai_suggested" and a reason; they are only created
 * after explicit user acceptance.
 */
export type MemoryConnection = {
  id: string;
  userId: string;
  sourceMemoryId: string;
  targetMemoryId: string;
  connectionType: ConnectionType;
  source: ConnectionSource;
  confidence: number;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

/** A request to create a connection. */
export type ConnectionAdd = {
  sourceMemoryId: string;
  targetMemoryId: string;
  connectionType: ConnectionType;
  source: ConnectionSource;
  confidence?: number;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * A related memory with the connection reason, for the Related Memories UI.
 * Carries a short excerpt of the related memory's user note.
 */
export type RelatedMemory = {
  memoryId: string;
  /** The id of the other memory in the connection. */
  connectionId: string;
  connectionType: ConnectionType;
  connectionSource: ConnectionSource;
  reason: string | null;
  confidence: number;
  /** The related memory's display title (music title/artist). */
  title: string;
  /** Short excerpt of the related memory's user/original note. */
  excerpt: string;
  /** Event-time label if known. */
  eventTimeLabel: string | null;
};

/**
 * A discovered (not yet persisted) deterministic connection candidate.
 * Discovery is a preview; it never silently persists.
 */
export type DiscoveredConnection = {
  sourceMemoryId: string;
  targetMemoryId: string;
  connectionType: ConnectionType;
  reason: string;
  /** Whether an identical persisted connection already exists. */
  alreadyPersisted: boolean;
};

// ---------------------------------------------------------------------------
// Pattern Engine Foundation (migration 0004)
// ---------------------------------------------------------------------------

/**
 * A single piece of evidence linking a Pattern to a Memory. Authoritative
 * (stored in pattern_memories), not an opaque blob.
 */
export type PatternEvidence = {
  memoryId: string;
  /** Advisory: how this memory supports the pattern. */
  evidenceRole: string | null;
};

/**
 * A discovered (not yet persisted) deterministic pattern candidate. Pure output
 * of the discovery engine; the caller decides whether to persist. NEVER carries
 * AI interpretation — that is a separate, optional layer.
 */
export type PatternCandidate = {
  patternType: PatternType;
  title: string;
  summary: string;
  confidence: number;
  /** Stable key for (type, value/evidence set) — prevents duplicate patterns. */
  fingerprint: string;
  evidenceCount: number;
  observedFrom: string | null;
  observedTo: string | null;
  evidence: PatternEvidence[];
};

/**
 * A persisted Pattern with its evidence. AI interpretation fields are null
 * until explicitly generated; they never modify source data.
 */
export type Pattern = {
  id: string;
  userId: string;
  patternType: PatternType;
  title: string;
  summary: string;
  confidence: number;
  observedFrom: string | null;
  observedTo: string | null;
  status: PatternStatus;
  fingerprint: string;
  evidenceCount: number;
  evidence: PatternEvidence[];
  // AI interpretation layer — null until generated.
  interpretation: string | null;
  interpretationModel: string | null;
  interpretationPromptVersion: string | null;
  interpretationCreatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A related memory for the Pattern UI: evidence memory + display data. */
export type PatternRelatedMemory = {
  memoryId: string;
  evidenceRole: string | null;
  title: string;
  excerpt: string;
  eventTimeLabel: string | null;
};

// ---------------------------------------------------------------------------
// Life Events + Life Chapters (migration 0005)
// ---------------------------------------------------------------------------

/** A Life Event: a meaningful event or period in the user's life. */
export type LifeEvent = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  startAt: string | null;
  endAt: string | null;
  timePrecision: EventTimeGranularity;
  /** Human time wording preserved verbatim (e.g. "late 1990s"). */
  timeLabel: string | null;
  location: string | null;
  status: LifeEventStatus;
  createdAt: string;
  updatedAt: string;
};

/** Fields for creating/updating a Life Event. title is required. */
export type LifeEventInput = {
  title: string;
  description?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  timePrecision?: EventTimeGranularity;
  timeLabel?: string | null;
  location?: string | null;
  status?: LifeEventStatus;
};

/** A Life Chapter: a larger grouping of Events and/or Memories. */
export type LifeChapter = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  startAt: string | null;
  endAt: string | null;
  timePrecision: EventTimeGranularity;
  timeLabel: string | null;
  status: LifeEventStatus;
  createdAt: string;
  updatedAt: string;
};

/** Fields for creating/updating a Life Chapter. title is required. */
export type LifeChapterInput = {
  title: string;
  description?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  timePrecision?: EventTimeGranularity;
  timeLabel?: string | null;
  status?: LifeEventStatus;
};

/** A Memory attached to an Event, with display data. */
export type EventMemory = {
  memoryId: string;
  relationshipType: string | null;
  position: number;
  title: string;
  excerpt: string;
  eventTimeLabel: string | null;
};

/** A Chapter containing Events and/or direct Memories, with display data. */
export type ChapterEvent = {
  eventId: string;
  title: string;
  timeLabel: string | null;
  location: string | null;
  position: number;
  memoryCount: number;
};

export type ChapterDirectMemory = {
  memoryId: string;
  position: number;
  title: string;
  excerpt: string;
  eventTimeLabel: string | null;
};

/** A loaded Chapter with its Events and direct Memories. */
export type ChapterDetail = LifeChapter & {
  events: ChapterEvent[];
  directMemories: ChapterDirectMemory[];
};

/** A loaded Event with its attached Memories and Chapters. */
export type EventDetail = LifeEvent & {
  memories: EventMemory[];
  chapters: Array<{ chapterId: string; title: string }>;
};

/** An AI-suggested Event/Chapter grouping (advisory, never auto-saved). */
export type StructureSuggestion = {
  kind: "event" | "chapter";
  title: string;
  description: string | null;
  timeLabel: string | null;
  memoryIds: string[];
};

// ---------------------------------------------------------------------------
// Media Foundation (migration 0006)
// ---------------------------------------------------------------------------

/** A user-owned personal image. Binary lives in Storage; this is metadata. */
export type Media = {
  id: string;
  userId: string;
  storagePath: string;
  originalFilename: string | null;
  mimeType: MediaMimeType;
  byteSize: number;
  width: number | null;
  height: number | null;
  capturedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Input for creating a media record (after the file is uploaded). */
export type MediaCreateInput = {
  storagePath: string;
  originalFilename?: string | null;
  mimeType: MediaMimeType;
  byteSize: number;
  width?: number | null;
  height?: number | null;
  capturedAt?: string | null;
};

/** A media item with its display signed URL + relationship position. */
export type MediaWithUrl = Media & {
  signedUrl: string | null;
  position: number;
};

/** Profile media relationship (at most one is_current per user). */
export type ProfileMedia = {
  mediaId: string;
  isCurrent: boolean;
  position: number;
};

// ---------------------------------------------------------------------------
// Companion Conversation Foundation
// ---------------------------------------------------------------------------

export type CompanionConversationStatus = "active" | "archived";
export type CompanionTurnRole = "user" | "assistant" | "system";

/** A companion conversation. Historical context only — NOT memory. */
export type CompanionConversation = {
  id: string;
  userId: string;
  title: string | null;
  status: CompanionConversationStatus;
  startedAt: string;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
};

/** A single turn in a conversation. Content preserved exactly as produced. */
export type CompanionTurn = {
  id: string;
  userId: string;
  conversationId: string;
  role: CompanionTurnRole;
  content: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

// ---------------------------------------------------------------------------
// Significant Interaction Foundation (migration 0008)
// ---------------------------------------------------------------------------

/**
 * The kind of a durable, user-expressed significant interaction. Excludes
 * ai_fact / psychological_profile / diagnosis / personality_trait by
 * construction (these are not in the union).
 */
export type SignificantInteractionKind =
  "directive" | "preference" | "confirmed_context" | "boundary" | "decision";

/** candidate = proposed by classifier; confirmed = explicit user action required. */
export type SignificantInteractionStatus = "candidate" | "confirmed" | "dismissed" | "archived";

/** user_explicit = the user asked to remember; ai_classified = classifier proposed. */
export type SignificantInteractionSource = "user_explicit" | "ai_classified";

/**
 * A Significant Interaction CANDIDATE — the middle layer between a conversation
 * turn and (later) a durable Companion Memory.
 *
 * Provenance: points back to its source conversation_id + turn_id. The original
 * turn is NEVER mutated; candidateContent is an explicitly-marked PROPOSED
 * normalized memory statement, NOT the truth and NOT a copy of the turn.
 *
 * A candidate is created by the classifier but can NEVER become 'confirmed'
 * without explicit user action. Promotion to Companion Memory happens in a
 * later phase — confirmed candidates STOP here for now.
 */
export type SignificantInteraction = {
  id: string;
  userId: string;
  conversationId: string;
  turnId: string;
  kind: SignificantInteractionKind;
  candidateContent: string;
  reason: string | null;
  status: SignificantInteractionStatus;
  source: SignificantInteractionSource;
  confidence: number | null;
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Companion Memory Foundation (migration 0009)
// ---------------------------------------------------------------------------

/**
 * The kind of a durable Companion Memory. Same constrained set as Significant
 * Interactions — excludes ai_fact / psychological_profile / diagnosis /
 * personality_trait / inferred_relationship / inferred_biography by construction.
 */
export type CompanionMemoryKind =
  "directive" | "preference" | "confirmed_context" | "boundary" | "decision";

/** active = live; archived = soft-hidden, reversible. No extra lifecycle states. */
export type CompanionMemoryStatus = "active" | "archived";

/** v1 source is always user_confirmed. No ai_generated Companion Memory. */
export type CompanionMemorySource = "user_confirmed";

/**
 * A durable Companion Memory — promoted from a CONFIRMED Significant
 * Interaction via explicit user action.
 *
 * Provenance: every Companion Memory references exactly one
 * significantInteractionId, which itself references a conversation turn. The
 * original turn is NEVER mutated; `content` is a concise user-approved
 * representation copied from the confirmed candidate at promotion time.
 *
 * Promotion is explicit, ownership-verified, and reversible (archive/delete).
 * No unconfirmed interaction may become Companion Memory. A Significant
 * Interaction is promoted at most once (DB UNIQUE on significant_interaction_id).
 *
 * Optional related Memory/Event/Chapter links reference EXISTING user-owned
 * objects and use ON DELETE SET NULL — deleting a related object detaches the
 * link but preserves the Companion Memory and its content.
 */
export type CompanionMemory = {
  id: string;
  userId: string;
  significantInteractionId: string;
  kind: CompanionMemoryKind;
  content: string;
  status: CompanionMemoryStatus;
  source: CompanionMemorySource;
  relatedMemoryId: string | null;
  relatedEventId: string | null;
  relatedChapterId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

/**
 * Provenance detail for the "Why do you remember this?" affordance. Carries
 * the source Significant Interaction + its source conversation/turn, so the
 * user can see: "This memory exists because you explicitly confirmed it."
 */
export type CompanionMemoryProvenance = {
  /** The Companion Memory this provenance describes. */
  companionMemoryId: string;
  /** The source Significant Interaction id. */
  significantInteractionId: string;
  /** The Significant Interaction's kind/source (mirrored for display). */
  kind: CompanionMemoryKind;
  source: CompanionMemorySource;
  /** The source conversation id + title (if any). */
  conversationId: string;
  conversationTitle: string | null;
  /** The original user turn id + verbatim content (never mutated). */
  turnId: string;
  turnContent: string;
  /** When the Significant Interaction was confirmed by the user. */
  confirmedAt: string;
  /** When the Companion Memory was created (promotion time). */
  promotedAt: string;
};
