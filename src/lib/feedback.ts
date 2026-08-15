/**
 * Lightweight structured product feedback.
 *
 * Collects a minimal structured signal (e.g. "Did this feel meaningful?") after
 * key first experiences. Records a `feedback_submitted` telemetry event with
 * ONLY: kind + rating. NEVER raw memory text, reflection content, or
 * conversation contents.
 *
 * Persistence: v1 records via the telemetry sink (default no-op; the closed
 * beta may log structured events server-side for dev review). No new database
 * table is required — see docs/BETA/README.md. If persistent product analytics
 * later requires a table, it will be justified there before creation.
 */
import { track, PRODUCT_EVENTS } from "@/lib/telemetry";

/** Where the feedback was collected (coarse, non-content). */
export type FeedbackKind = "first_memory" | "first_companion";

/**
 * Structured rating. Kept to a tiny closed set so it cannot accidentally carry
 * free text. The UI offers exactly these options.
 */
export type FeedbackRating = "yes" | "somewhat" | "not_really";

/** The structured feedback event recorded by `submitFeedback`. */
export type FeedbackEvent = {
  event: typeof PRODUCT_EVENTS.feedbackSubmitted;
  timestamp: string;
  kind: FeedbackKind;
  rating: FeedbackRating;
  userId?: string;
};

/**
 * Pure: build the structured feedback event. Validates the rating is one of the
 * closed set (defence in depth — a free-text rating can never be recorded).
 * Returns null if the rating is invalid.
 */
export function buildFeedbackEvent(
  kind: FeedbackKind,
  rating: FeedbackRating,
  userId?: string,
): FeedbackEvent | null {
  const valid: FeedbackRating[] = ["yes", "somewhat", "not_really"];
  if (!valid.includes(rating)) return null;
  return {
    event: PRODUCT_EVENTS.feedbackSubmitted,
    timestamp: new Date().toISOString(),
    kind,
    rating,
    userId,
  };
}

/**
 * Record a structured feedback event via the telemetry sink. Never throws,
 * never records raw content. If the rating is invalid, nothing is recorded.
 */
export function submitFeedback(
  kind: FeedbackKind,
  rating: FeedbackRating,
  userId?: string,
): FeedbackEvent | null {
  const ev = buildFeedbackEvent(kind, rating, userId);
  if (!ev) return null;
  track({
    event: ev.event,
    timestamp: ev.timestamp,
    userId: ev.userId,
    result: ev.rating,
    detail: { kind: ev.kind, rating: ev.rating },
  });
  return ev;
}
