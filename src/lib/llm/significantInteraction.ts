/**
 * Significant Interaction classification — grounded prompt contract + types.
 *
 * Flow:
 *   USER TURN (gate said shouldAnalyze)
 *       ↓
 *   SERVER-SIDE ORCHESTRA (classifySignificantInteraction.server.ts)
 *       ↓
 *   CANDIDATE { significant, kind, candidateContent, reason, confidence } | null
 *       ↓
 *   PERSISTED as status='candidate' (NEVER confirmed by the classifier)
 *       ↓
 *   USER CONFIRMS / DISMISSES
 *       ↓
 *   (LATER) PROMOTED TO COMPANION MEMORY
 *
 * The classifier must distinguish an EXPLICIT USER STATEMENT from an AI
 * INTERPRETATION. It may classify ONLY what the user explicitly said.
 *
 * This module is pure string construction + parsing — no network, no keys,
 * safe to import from tests and from the client (no I/O, no secrets).
 */
import type { CompanionTurn } from "@/lib/memory/types";
import type { SignificantInteractionKind } from "@/lib/memory/types";

/** The valid kinds (excludes ai_fact / psychological_profile / diagnosis / personality_trait). */
export const SIGNIFICANT_KINDS: readonly SignificantInteractionKind[] = [
  "directive",
  "preference",
  "confirmed_context",
  "boundary",
  "decision",
];

export type ClassifySignificantInteractionInput = {
  /** The USER turn under analysis. Only user turns are classified. */
  userTurn: Pick<CompanionTurn, "role" | "content">;
  /** Optional minimal recent context (NOT the whole history). */
  recentTurns?: Pick<CompanionTurn, "role" | "content">[];
  /** The deterministic-gate signals that triggered analysis. */
  signals: string[];
};

/**
 * The structured output the classifier must return. `significant=false` with
 * null fields means "not worth a candidate". `significant=true` requires a
 * valid kind + non-empty candidateContent. confidence ∈ [0,1].
 */
export type SignificanceClassification = {
  significant: boolean;
  kind: SignificantInteractionKind | null;
  candidateContent: string | null;
  reason: string | null;
  confidence: number | null;
};

export const SIGNIFICANCE_PROMPT_VERSION = "significance-classify-v1";

const GROUNDING_RULES = [
  "Classify ONLY what the user EXPLICITLY said in the supplied USER turn.",
  "Distinguish an EXPLICIT USER STATEMENT from an AI INTERPRETATION. Never convert your interpretation into a user fact.",
  "Never invent biography, dates, places, people, song titles, or artists absent from the user turn.",
  "Never infer psychology, mental health, trauma, relationships, or personality traits.",
  "Never infer preferences from behavior alone — only from what the user explicitly stated.",
  "Never convert assistant text into a user fact.",
  "Never diagnose.",
  "If the user did not explicitly state something durable, return significant=false.",
  "If the user expresses uncertainty ('maybe', 'I think', 'perhaps'), treat it cautiously — prefer significant=false unless they explicitly ask to remember it.",
  "If the user explicitly asks to remember something, that is a strong candidate.",
  "Return a candidate only when it is grounded in the supplied user turn.",
];

export function buildSignificancePrompt(input: ClassifySignificantInteractionInput): string {
  const rulesBlock = GROUNDING_RULES.map((r, i) => `${i + 1}. ${r}`).join("\n");

  const lines: string[] = [
    "You are the Companion of Life in a Sound, deciding whether a single USER turn in a conversation contains a durable, user-expressed statement worth remembering.",
    "Your output is advisory only and is NEVER confirmed without the user's explicit action.",
    "",
    "RULES:",
    rulesBlock,
    "",
    "KIND (choose exactly one when significant=true):",
    "- directive: the user instructs how the Companion should behave",
    "- preference: a durable personal preference the user explicitly stated",
    "- confirmed_context: explicit personal context the user said should persist",
    "- boundary: an explicit limit the user set",
    "- decision: an explicit decision the user stated",
    "",
    "Deterministic gate signals (matched in the user turn):",
    input.signals.length > 0 ? input.signals.map((s) => `- ${s}`).join("\n") : "(none)",
    "",
  ];

  if (input.recentTurns && input.recentTurns.length > 0) {
    const transcript = input.recentTurns
      .map((t) => {
        const speaker = t.role === "user" ? "User" : "Companion";
        return `${speaker}: ${t.content}`;
      })
      .join("\n");
    lines.push("Minimal recent context (for reference only):");
    lines.push(transcript);
    lines.push("");
  }

  lines.push("USER TURN UNDER ANALYSIS (classify THIS turn only):");
  lines.push(`User: ${input.userTurn.content}`);
  lines.push("");
  lines.push("OUTPUT: a single JSON object, no markdown, no code fences, exactly this shape:");
  lines.push(
    '{"significant": boolean, "kind": "directive"|"preference"|"confirmed_context"|"boundary"|"decision"|null, "candidateContent": string|null, "reason": string|null, "confidence": number|null}',
  );
  lines.push("When significant=false, set kind, candidateContent, reason, confidence to null.");

  return lines.join("\n");
}

/**
 * Parse the classifier's JSON response into a validated
 * `SignificanceClassification`, or null on malformed output. Never throws.
 *
 * Rejections:
 *   - non-JSON, JSON with code fences, non-object
 *   - significant=true but kind is null/unknown
 *   - significant=true but candidateContent is empty
 *   - confidence present but outside [0,1] or non-finite
 *   - unknown kind value
 *   - candidateContent not grounded in the user turn (token overlap check)
 */
export function parseSignificanceResponse(
  response: string,
  userTurn: Pick<CompanionTurn, "content">,
): SignificanceClassification | null {
  if (typeof response !== "string") return null;
  const trimmed = response.trim();
  if (trimmed.length === 0) return null;
  // Strip a single surrounding code fence if present.
  const stripped = stripCodeFence(trimmed);
  if (!stripped.startsWith("{") || !stripped.endsWith("}")) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  const significant = obj.significant;
  if (typeof significant !== "boolean") return null;

  if (!significant) {
    return {
      significant: false,
      kind: null,
      candidateContent: null,
      reason: null,
      confidence: null,
    };
  }

  // significant === true: validate kind + candidateContent + confidence.
  const kind = obj.kind;
  if (typeof kind !== "string" || !SIGNIFICANT_KINDS.includes(kind as SignificantInteractionKind)) {
    return null;
  }

  const candidateContent = obj.candidateContent;
  if (typeof candidateContent !== "string" || candidateContent.trim().length === 0) {
    return null;
  }

  const reason = obj.reason;
  const reasonValue = typeof reason === "string" && reason.trim().length > 0 ? reason.trim() : null;

  let confidence: number | null = null;
  if (obj.confidence !== null && obj.confidence !== undefined) {
    const c = obj.confidence;
    if (typeof c !== "number" || !Number.isFinite(c) || c < 0 || c > 1) return null;
    confidence = c;
  }

  // Grounding check: the candidate must be rooted in the user turn. Use a
  // token-overlap heuristic — the candidate must share at least one
  // significant word (length > 3) with the user turn, case-insensitively.
  if (!isGroundedIn(candidateContent, userTurn.content)) return null;

  return {
    significant: true,
    kind: kind as SignificantInteractionKind,
    candidateContent: candidateContent.trim(),
    reason: reasonValue,
    confidence,
  };
}

function stripCodeFence(s: string): string {
  if (s.startsWith("```")) {
    // Remove first fence line.
    const afterOpen = s.replace(/^```[a-zA-Z]*\n?/, "");
    // Remove trailing fence.
    return afterOpen.replace(/```\s*$/, "").trim();
  }
  return s;
}

/**
 * Grounding heuristic: does the candidate share at least one significant
 * word (length > 3, after lowercasing + stripping punctuation) with the user
 * turn? This rejects candidates that introduce content absent from the turn.
 */
export function isGroundedIn(candidateContent: string, userTurnContent: string): boolean {
  const tokenize = (s: string): Set<string> => {
    const tokens = s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3);
    return new Set(tokens);
  };
  const candidateTokens = tokenize(candidateContent);
  const turnTokens = tokenize(userTurnContent);
  if (candidateTokens.size === 0 || turnTokens.size === 0) return false;
  for (const t of candidateTokens) {
    if (turnTokens.has(t)) return true;
  }
  return false;
}
