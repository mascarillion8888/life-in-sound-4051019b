import { questions } from "@/lib/questions";
import type { JourneyAnswers, PersonalityDimension, PersonalityScores } from "./types";

/**
 * Each journey question maps to the dimensions it inherently expresses.
 * (Derived from the question texts in src/lib/questions.ts — no invented traits.)
 */
export const QUESTION_DIMENSIONS: Record<number, PersonalityDimension[]> = {
  1: ["nostalgia", "introspection"],
  2: ["rebellion", "energy"],
  3: ["connection", "nostalgia"],
  4: ["melancholy", "hope"],
  5: ["energy", "rebellion"],
  6: ["connection", "melancholy"],
  7: ["hope", "introspection"],
  8: ["introspection", "hope"],
};

export const DIMENSIONS: PersonalityDimension[] = [
  "introspection",
  "nostalgia",
  "energy",
  "melancholy",
  "hope",
  "rebellion",
  "connection",
];

/** Stable, non-random hash of a string (FNV-1a variant). */
export function stableHash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function emptyScores(): PersonalityScores {
  return {
    introspection: 0,
    nostalgia: 0,
    energy: 0,
    melancholy: 0,
    hope: 0,
    rebellion: 0,
    connection: 0,
  };
}

/**
 * Deterministic scoring: every answered question adds a base weight to its
 * dimensions, plus a small stable nuance derived from the answer text so that
 * different song choices produce different — but reproducible — profiles.
 */
export function scorePersonality(answers: JourneyAnswers): PersonalityScores {
  const raw = emptyScores();

  for (const q of questions) {
    const answer = answers?.[q.id];
    if (!answer) continue;

    const dims = QUESTION_DIMENSIONS[q.id] ?? ["introspection"];
    const nuance = stableHash(answer.trim().toLowerCase());

    dims.forEach((dim, index) => {
      const base = index === 0 ? 2 : 1;
      const bump = ((nuance >> (index * 3)) % 3) / 2; // 0, 0.5 or 1
      raw[dim] += base + bump;
    });
  }

  // Normalise to 0..1 for readable downstream logic.
  const max = Math.max(...DIMENSIONS.map((d) => raw[d]), 1);
  const normalised = emptyScores();
  for (const d of DIMENSIONS) {
    normalised[d] = Number((raw[d] / max).toFixed(3));
  }
  return normalised;
}

/** Dimensions sorted from strongest to weakest (ties broken alphabetically). */
export function rankedDimensions(scores: PersonalityScores): PersonalityDimension[] {
  return [...DIMENSIONS].sort((a, b) => scores[b] - scores[a] || a.localeCompare(b));
}

export function answeredCount(answers: JourneyAnswers): number {
  return questions.filter((q) => Boolean(answers?.[q.id])).length;
}
