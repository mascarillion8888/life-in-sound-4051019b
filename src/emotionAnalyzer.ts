// Emotion analyzer
// Input: answers[]
// Supports numbers, strings, or keyed answers: { key: string, value: number|string }
// Output: { dominantEmotion, secondaryEmotion, emotionalIntensity }

export type KeyedAnswer = { key: string; value: number | string };
export type InputAnswer = number | string | KeyedAnswer;

export interface EmotionResult {
  dominantEmotion: string;
  secondaryEmotion: string | null;
  emotionalIntensity: number; // 0 - 100
  // optional detailed scores for debugging
  scores?: Record<string, number>;
}

const EMOTIONS = [
  "joy",
  "sadness",
  "anger",
  "fear",
  "surprise",
  "disgust",
  "trust",
  "anticipation",
  "melancholy",
  "calm",
];

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function normalizeValue(val: number | string): number {
  if (typeof val === "number") {
    if (val >= 0 && val <= 1) return clamp01(val);
    if (val >= 1 && val <= 5) return clamp01((val - 1) / 4);
    return clamp01(val / 10);
  }
  const s = String(val).trim().toLowerCase();
  if (s === "yes" || s === "y" || s === "true") return 1;
  if (s === "no" || s === "n" || s === "false") return 0;

  // simple sentiment-ish heuristics for words that convey intensity
  const positiveWords = ["happy", "joy", "excited", "delighted", "glad", "cheerful", "optimistic", "hopeful"];
  const negativeWords = ["sad", "depressed", "down", "lonely", "melancholy", "angry", "mad", "furious", "anxious", "afraid", "fearful"];

  for (const p of positiveWords) if (s.includes(p)) return 0.9;
  for (const n of negativeWords) if (s.includes(n)) return 0.9;

  // fallback: hash-based pseudo-random mapping to 0..1
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const positive = Math.abs(h % 1000);
  return clamp01(positive / 1000);
}

// Keyword to emotion weight map (weights should sum <= 1 per keyword set)
const KEYWORD_MAP: Record<string, Record<string, number>> = {
  happy: { joy: 1 },
  joy: { joy: 1 },
  excited: { joy: 0.7, anticipation: 0.3 },
  sad: { sadness: 1 },
  depressed: { melancholy: 1 },
  angry: { anger: 1 },
  anxious: { fear: 0.7, sadness: 0.3 },
  afraid: { fear: 1 },
  scared: { fear: 1 },
  surprised: { surprise: 1 },
  disgusted: { disgust: 1 },
  trust: { trust: 1 },
  calm: { calm: 1 },
  reflective: { melancholy: 0.6, calm: 0.4 },
  "melancholy": { melancholy: 1 },
  hopeful: { optimism: 1, anticipation: 0.4 },
  optimistic: { optimism: 1, joy: 0.3 },
  creative: { anticipation: 0.4, joy: 0.2, trust: 0.4 },
  lonely: { sadness: 0.9, melancholy: 0.1 },
  "art-music": { melancholy: 0.4, joy: 0.3, calm: 0.3 },
};

// keyed map for explicit keyed answers
const KEY_MAP: Record<string, Record<string, number>> = {
  joy: { joy: 1 },
  sadness: { sadness: 1 },
  anger: { anger: 1 },
  fear: { fear: 1 },
  surprise: { surprise: 1 },
  disgust: { disgust: 1 },
  trust: { trust: 1 },
  anticipation: { anticipation: 1 },
  melancholy: { melancholy: 1 },
  calm: { calm: 1 },
  emotion: {},
};

export default function analyzeEmotions(answers: InputAnswer[]): EmotionResult {
  // Initialize scores
  const scores: Record<string, number> = {};
  for (const e of EMOTIONS) scores[e] = 0;

  let totalContribution = 0; // sum of per-answer contributions (each answer contributes at most its normalized value)

  for (const raw of answers) {
    // normalize and compute distribution per answer so sum of added values == norm
    if (typeof raw === "object" && raw !== null && "key" in (raw as any)) {
      const ka = raw as KeyedAnswer;
      const key = String(ka.key || "").trim().toLowerCase();
      const norm = normalizeValue(ka.value);

      // find mapping
      const direct = KEY_MAP[key];
      if (direct && Object.keys(direct).length > 0) {
        // distribute according to weights (weights sum might be >1, normalize)
        const wsum = Object.values(direct).reduce((s, v) => s + Math.abs(v), 0) || 1;
        for (const [emo, w] of Object.entries(direct)) {
          scores[emo] = (scores[emo] || 0) + (norm * Math.abs(w)) / wsum;
        }
        totalContribution += norm;
        continue;
      }

      // fallback: try keyword map for the key string
      const kwMatches: Array<[string, number]> = [];
      for (const km of Object.keys(KEYWORD_MAP)) {
        if (key.includes(km)) {
          const mapping = KEYWORD_MAP[km];
          for (const [emo, w] of Object.entries(mapping)) kwMatches.push([emo, w]);
        }
      }
      if (kwMatches.length) {
        // combine weights by emotion
        const combined: Record<string, number> = {};
        for (const [emo, w] of kwMatches) combined[emo] = (combined[emo] || 0) + w;
        const wsum = Object.values(combined).reduce((s, v) => s + Math.abs(v), 0) || 1;
        for (const [emo, w] of Object.entries(combined)) {
          scores[emo] = (scores[emo] || 0) + (norm * Math.abs(w)) / wsum;
        }
        totalContribution += norm;
        continue;
      }

      // last fallback: distribute norm evenly
      const per = norm / EMOTIONS.length;
      for (const e of EMOTIONS) scores[e] += per;
      totalContribution += norm;
    } else if (typeof raw === "string") {
      const s = raw.trim().toLowerCase();
      const norm = normalizeValue(s);

      // find keyword matches (whole-word or substring)
      const matches: Array<[string, number]> = [];
      for (const kw of Object.keys(KEYWORD_MAP)) {
        if (s.includes(kw)) {
          const mapping = KEYWORD_MAP[kw];
          for (const [emo, w] of Object.entries(mapping)) matches.push([emo, w]);
        }
      }

      if (matches.length > 0) {
        // combine & normalize weights
        const combined: Record<string, number> = {};
        for (const [emo, w] of matches) combined[emo] = (combined[emo] || 0) + w;
        const wsum = Object.values(combined).reduce((a, b) => a + Math.abs(b), 0) || 1;
        for (const [emo, w] of Object.entries(combined)) {
          scores[emo] = (scores[emo] || 0) + (norm * Math.abs(w)) / wsum;
        }
        totalContribution += norm;
        continue;
      }

      // if string is a short single emotion word like "happy"
      if (KEYWORD_MAP[s]) {
        const mapping = KEYWORD_MAP[s];
        const wsum = Object.values(mapping).reduce((a, b) => a + Math.abs(b), 0) || 1;
        for (const [emo, w] of Object.entries(mapping)) scores[emo] += (norm * Math.abs(w)) / wsum;
        totalContribution += norm;
        continue;
      }

      // fallback hash to pick an emotion to credit
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      const idx = Math.abs(h) % EMOTIONS.length;
      scores[EMOTIONS[idx]] += norm;
      totalContribution += norm;
    } else if (typeof raw === "number") {
      const norm = normalizeValue(raw);

      // distribute based on valence-like heuristic
      if (norm >= 0.66) {
        // positive
        const dist: Record<string, number> = { joy: 0.4, anticipation: 0.3, trust: 0.3 };
        for (const [emo, w] of Object.entries(dist)) scores[emo] += norm * w;
        totalContribution += norm;
      } else if (norm <= 0.33) {
        // negative
        const dist: Record<string, number> = { sadness: 0.5, fear: 0.3, anger: 0.2 };
        for (const [emo, w] of Object.entries(dist)) scores[emo] += norm * w;
        totalContribution += norm;
      } else {
        // neutral/mixed
        const dist: Record<string, number> = { calm: 0.5, surprise: 0.3, trust: 0.2 };
        for (const [emo, w] of Object.entries(dist)) scores[emo] += norm * w;
        totalContribution += norm;
      }
    } else {
      // unknown type, ignore
    }
  }

  // If no answers or totalContribution is 0 -> neutral
  if (answers.length === 0 || totalContribution === 0) {
    return {
      dominantEmotion: "neutral",
      secondaryEmotion: null,
      emotionalIntensity: 0,
      scores,
    };
  }

  // Determine dominant and secondary emotions by raw scores
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0][0];
  const secondary = sorted[1] && sorted[1][1] > 0 ? sorted[1][0] : null;

  // Emotional intensity: average per-answer contribution normalized to 0..1
  // Each answer contributed at most its normalized value, so max totalContribution == answers.length
  const intensity01 = clamp01(totalContribution / answers.length);
  const emotionalIntensity = Math.round(intensity01 * 100);

  // Optionally include normalized scores scaled to 0..100
  const normalizedScores: Record<string, number> = {};
  // Normalize by max score so the highest becomes 100, but keep relative shape
  const maxScore = Math.max(...Object.values(scores), 0) || 1;
  for (const [k, v] of Object.entries(scores)) {
    normalizedScores[k] = Math.round((v / maxScore) * 100);
  }

  return {
    dominantEmotion: dominant,
    secondaryEmotion: secondary,
    emotionalIntensity,
    scores: normalizedScores,
  };
}
