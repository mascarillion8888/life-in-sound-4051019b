// Personality scoring engine
// Input: answers[]
// - Supports positional numeric answers (number[]), or keyed answers [{ key: string, value: number|string }]
// Output: {
//   personalityType,
//   openness,
//   empathy,
//   curiosity,
//   melancholy,
//   optimism,
//   creativity
// }

export type KeyedAnswer = { key: string; value: number | string };
export type InputAnswer = number | string | KeyedAnswer;

export interface ScoreResult {
  personalityType: string;
  openness: number; // 0 - 100
  empathy: number;
  curiosity: number;
  melancholy: number;
  optimism: number;
  creativity: number;
  // optional: raw normalized 0..1 scores for debugging
  raw?: {
    openness: number;
    empathy: number;
    curiosity: number;
    melancholy: number;
    optimism: number;
    creativity: number;
  };
}

// Helpers
function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function normalizeValue(val: number | string): number {
  // Normalize to 0..1
  if (typeof val === "number") {
    // assume scale 1-5 or 0-1 -- detect
    if (val >= 0 && val <= 1) return clamp01(val);
    if (val >= 1 && val <= 5) return clamp01((val - 1) / 4);
    // fallback: scale by max 10
    return clamp01(val / 10);
  }

  const s = String(val).trim().toLowerCase();
  if (s === "yes" || s === "y" || s === "true") return 1;
  if (s === "no" || s === "n" || s === "false") return 0;

  // Map simple emotion/keyword short strings via a hash to 0..1 so non-numeric answers still contribute
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  // convert to positive and normalize
  const positive = Math.abs(hash % 1000);
  return clamp01(positive / 1000);
}

// Predefined weights for positional mode (12-question template)
// Index mapping (example):
// 0: willingness to try new things (openness)
// 1: noticing others' feelings (empathy)
// 2: asking questions / wonder (curiosity)
// 3: periods of low mood (melancholy)
// 4: expecting good outcomes (optimism)
// 5: generating unusual ideas (creativity)
// 6: preference for variety (openness)
// 7: sensitivity to art/music (creativity/empathy)
// 8: tendency to reflect (melancholy/creativity)
// 9: seeking out novel experiences (curiosity/openness)
// 10: cheerfulness frequency (optimism)
// 11: concern for others (empathy)

const positionalWeights: Record<string, number[]> = {
  openness: [0.9, 0.0, 0.0, 0.0, 0.0, 0.0, 0.9, 0.0, 0.2, 0.8, 0.0, 0.0],
  empathy: [0.0, 0.9, 0.0, 0.1, 0.0, 0.0, 0.0, 0.5, 0.2, 0.0, 0.0, 0.9],
  curiosity: [0.1, 0.0, 0.95, 0.0, 0.0, 0.0, 0.2, 0.0, 0.1, 0.9, 0.0, 0.0],
  melancholy: [0.0, 0.1, 0.0, 0.95, 0.0, 0.2, 0.0, 0.2, 0.9, 0.0, 0.0, 0.0],
  optimism: [0.0, 0.0, 0.0, 0.1, 0.95, 0.0, 0.1, 0.0, 0.0, 0.0, 0.95, 0.0],
  creativity: [0.2, 0.0, 0.1, 0.1, 0.0, 0.95, 0.1, 0.9, 0.7, 0.1, 0.0, 0.0],
};

// Mapping of keyed answer keys to trait weights (used in keyed mode)
// Keys may be full words or short identifiers; weights define contribution to traits
const keyMap: Record<string, Partial<Record<keyof ScoreResult, number>>> = {
  openness: { openness: 1 },
  "try-new": { openness: 1 },
  empathy: { empathy: 1 },
  "others-feelings": { empathy: 1 },
  curiosity: { curiosity: 1 },
  "ask-questions": { curiosity: 1 },
  melancholy: { melancholy: 1 },
  sadness: { melancholy: 1 },
  optimism: { optimism: 1 },
  hopeful: { optimism: 1 },
  creativity: { creativity: 1 },
  "art-music": { creativity: 0.9, empathy: 0.2 },
  "reflective": { melancholy: 0.6, creativity: 0.3 },
  "helping": { empathy: 0.9 },
};

export default function scorePersonality(answers: InputAnswer[]): ScoreResult {
  // Initialize accumulators
  const traits = {
    openness: 0,
    empathy: 0,
    curiosity: 0,
    melancholy: 0,
    optimism: 0,
    creativity: 0,
  } as Record<string, number>;

  const weightSums: Record<string, number> = {
    openness: 0,
    empathy: 0,
    curiosity: 0,
    melancholy: 0,
    optimism: 0,
    creativity: 0,
  };

  // Detect mode: keyed if any answer is object with key
  const isKeyed = answers.some(
    (a) => typeof a === "object" && a !== null && "key" in (a as any)
  );

  if (isKeyed) {
    // keyed mode
    for (const raw of answers) {
      if (typeof raw === "object" && raw !== null && "key" in (raw as any)) {
        const ans = raw as KeyedAnswer;
        const norm = normalizeValue(ans.value);
        const key = ans.key.trim().toLowerCase();

        // try direct mapping
        const mapping = keyMap[key];
        if (mapping) {
          for (const t of Object.keys(mapping) as Array<keyof ScoreResult>) {
            const w = mapping[t] ?? 0;
            traits[t] += norm * (w as number);
            weightSums[t] += Math.abs(w as number);
          }
          continue;
        }

        // fuzzy: match any keyMap entry contained in key
        let matched = false;
        for (const mk of Object.keys(keyMap)) {
          if (key.includes(mk)) {
            const mapping2 = keyMap[mk];
            for (const t of Object.keys(mapping2) as Array<keyof ScoreResult>) {
              const w = mapping2[t] ?? 0;
              traits[t] += norm * (w as number);
              weightSums[t] += Math.abs(w as number);
            }
            matched = true;
          }
        }

        if (!matched) {
          // fallback: distribute lightly across all traits
          const share = norm / 6;
          for (const t of Object.keys(traits)) {
            traits[t] += share;
            weightSums[t] += 1 / 6;
          }
        }
      } else {
        // non-keyed entry in keyed mode: try to normalize and spread
        const norm = normalizeValue(raw as number | string);
        const share = norm / 6;
        for (const t of Object.keys(traits)) {
          traits[t] += share;
          weightSums[t] += 1 / 6;
        }
      }
    }
  } else {
    // positional mode
    // build numeric array normalized
    const nums = answers.map((a) => normalizeValue(a as number | string));

    const expectedLen = 12;
    // If provided fewer answers, treat missing as neutral (0.5)
    while (nums.length < expectedLen) nums.push(0.5);

    for (const traitName of Object.keys(positionalWeights)) {
      const weights = positionalWeights[traitName];
      // if answers longer than weights, only use first weights.length
      const len = Math.min(weights.length, nums.length);
      for (let i = 0; i < len; i++) {
        const w = weights[i];
        const v = nums[i];
        traits[traitName] += w * v;
        weightSums[traitName] += w;
      }
    }
  }

  // Compute normalized scores 0..1
  const normalized: Record<string, number> = {};
  for (const t of Object.keys(traits)) {
    const sumW = weightSums[t] || 1; // avoid divide by zero
    normalized[t] = clamp01(traits[t] / sumW);
  }

  // Convert to 0..100 rounded to 2 decimals
  const openness = Math.round(normalized.openness * 10000) / 100;
  const empathy = Math.round(normalized.empathy * 10000) / 100;
  const curiosity = Math.round(normalized.curiosity * 10000) / 100;
  const melancholy = Math.round(normalized.melancholy * 10000) / 100;
  const optimism = Math.round(normalized.optimism * 10000) / 100;
  const creativity = Math.round(normalized.creativity * 10000) / 100;

  // Determine a personalityType via heuristics
  let personalityType = "Balanced";
  // pick dominant trait(s)
  const pairs: Array<[string, number]> = [
    ["openness", normalized.openness],
    ["empathy", normalized.empathy],
    ["curiosity", normalized.curiosity],
    ["melancholy", normalized.melancholy],
    ["optimism", normalized.optimism],
    ["creativity", normalized.creativity],
  ];
  pairs.sort((a, b) => b[1] - a[1]);

  const top = pairs[0];
  const second = pairs[1];

  if (top[1] >= 0.7) {
    if (top[0] === "openness") personalityType = "Explorer";
    else if (top[0] === "empathy") personalityType = "Caretaker";
    else if (top[0] === "curiosity") personalityType = "Seeker";
    else if (top[0] === "melancholy") personalityType = "Reflective";
    else if (top[0] === "optimism") personalityType = "Optimist";
    else if (top[0] === "creativity") personalityType = "Artist";

    // combinations
    if (top[1] >= 0.6 && second[1] >= 0.5) {
      const combo = [top[0], second[0]].sort().join(" & ");
      personalityType = `${combo} Blend`;
    }
  } else {
    // no dominant strong trait; use descriptive blends
    const topNames = pairs.slice(0, 3).map((p) => p[0]);
    personalityType = topNames.map((n) => n[0].toUpperCase() + n.slice(1)).join("-");
  }

  return {
    personalityType,
    openness,
    empathy,
    curiosity,
    melancholy,
    optimism,
    creativity,
    raw: {
      openness: Math.round(normalized.openness * 10000) / 100,
      empathy: Math.round(normalized.empathy * 10000) / 100,
      curiosity: Math.round(normalized.curiosity * 10000) / 100,
      melancholy: Math.round(normalized.melancholy * 10000) / 100,
      optimism: Math.round(normalized.optimism * 10000) / 100,
      creativity: Math.round(normalized.creativity * 10000) / 100,
    },
  } as ScoreResult;
}
