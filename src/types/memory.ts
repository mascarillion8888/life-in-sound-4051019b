/**
 * QuestionMemory — user-authored personal memory attached to a single
 * journey question.
 *
 * This type represents **user-authored personal memory only**. It must never
 * represent AI interpretation, MusicDNA, EST output, generated lore or
 * insight, provider metadata, or card presentation state.
 *
 * Architectural boundary (must stay explicit end-to-end):
 *
 *   Music Metadata  ≠  User Memory  ≠  AI Interpretation
 *
 * A memory is a raw fact the user supplied. When no memory is supplied,
 * the field stays null — the system must never invent personal meaning from
 * genre, era, or AI inference. This mirrors the `isGrounded` contract used
 * elsewhere in the codebase: no data → no fabrication.
 *
 * Future consumption (NOT wired in this phase): the `memories` map will
 * live beside `answers`/`songs` in JourneyProgress;`CardEncounter.userMemory`
 * and `LifeContext.contextText` will derive from this single source of truth.
 */
export interface QuestionMemory {
  /**
   * The existing journey question identifier. The current journey has 8
   * questions (ids 1–8, see `src/lib/questions.ts`). No separate
   * question-ID system is introduced here.
   */
  questionId: number;
  /**
   * Stable identifier connecting this memory to the song associated with the
   * question. It intentionally does NOT duplicate the complete Song object;
   * the Song already lives in the journey's `songs` map. This key follows the
   * same stable song-key convention used elsewhere in the codebase (e.g.
   * `cardArtworkKey`: "provider:providerId", manual entries
   * "manual:artist:title").
   */
  songTrackKey: string;
  /**
   * The user's own memory. `null` = no memory supplied;`string` =
   * user-authored memory. An empty/whitespace-only string is NOT treated as
   * meaningful personal memory (normalization/validation is handled in a
   * later phase, not by this type).
   */
  text: string | null;
  /**
   * Optional ISO-8601 timestamp representing when the memory was
   * captured. `null` when the user supplied no memory (or when no capture
   * time exists). No date library or helper is introduced by this type.
   */
  capturedAt: string | null;
}