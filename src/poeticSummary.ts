// Poetic summary generator
// Input: personality data (type below)
// Output: { title, story, quote }

export interface PersonalityData {
  personalityType?: string;
  openness?: number; // 0..100
  empathy?: number;
  curiosity?: number;
  melancholy?: number;
  optimism?: number;
  creativity?: number;
  // optional complementary fields
  dominantEmotion?: string;
  secondaryEmotion?: string | null;
  emotionalIntensity?: number; // 0..100
}

export interface PoeticSummary {
  title: string;
  story: string;
  quote: string;
}

// small seeded pseudo-random generator for deterministic variation
function hashStringToSeed(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    // xorshift32
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967295;
  };
}

function pick<T>(rng: () => number, arr: T[]) {
  if (arr.length === 0) throw new Error("pick from empty array");
  const idx = Math.floor(rng() * arr.length);
  return arr[idx];
}

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n));
}

export default function generatePoeticSummary(data: PersonalityData): PoeticSummary {
  const baseString = `${data.personalityType || ""}|${data.dominantEmotion || ""}|${Math.round(
    (data.openness || 0) + (data.empathy || 0) + (data.curiosity || 0)
  )}`;

  const seed = hashStringToSeed(baseString);
  const rng = seededRng(seed);

  // Tone selection influenced by melancholy/optimism
  const mel = clamp(data.melancholy ?? 0, 0, 100) / 100;
  const opt = clamp(data.optimism ?? 0, 0, 100) / 100;
  const warmth = clamp((data.empathy ?? 0) * 0.01 + opt * 0.5 - mel * 0.3, 0, 1);

  // Imagery pools
  const landscapes = [
    "a glass sea at dawn",
    "an autumn library of turning leaves",
    "a lantern-lit city stitched with rain",
    "a silent observatory of scattered stars",
    "a wild garden of late-blooming flowers",
    "a narrow lane of warm lamplight",
    "an ocean of folded paper boats",
  ];

  const moods = [
    "quiet longing",
    "sparked wonder",
    "tender vigilance",
    "restless curiosity",
    "soft ache",
    "gentle mirth",
    "steady hope",
  ];

  const metaphors = [
    "keeps a map of unseen roads",
    "holds the echo of distant music",
    "paints small constellations on the palm",
    "weaves daylight into the edges of shadow",
    "gathers lost questions like wildflowers",
    "listens for the beginning inside an ending",
  ];

  const voices = [
    "a wandering archivist",
    "an old composer",
    "a careful archivist of feelings",
    "a curious traveller",
    "a quiet dreamer",
    "a late-night gardener",
  ];

  const adjectives = ["silvery", "sepia-toned", "luminous", "moonlit", "velvet", "wind-creased", "honeyed"];

  // Compose title components
  const titleAdj = pick(rng, adjectives);
  const titleImagery = pick(rng, landscapes);
  const typeLabel = data.personalityType || pick(rng, ["Soul", "Being", "Seeker", "Wanderer"]);

  const title = `${titleAdj} ${typeLabel} of ${titleImagery}`;

  // Compose story: 3 paragraphs/lines varying by traits
  const leadVoice = pick(rng, voices);
  const leadMood = pick(rng, moods);
  const leadMeta = pick(rng, metaphors);

  // Weight phrasing by creativity/openness/curiosity
  const creativity = clamp(data.creativity ?? 0, 0, 100) / 100;
  const openness = clamp(data.openness ?? 0, 0, 100) / 100;
  const curiosity = clamp(data.curiosity ?? 0, 0, 100) / 100;

  // line builders
  function lineA() {
    // opener
    const subject = leadVoice;
    const place = pick(rng, landscapes);
    const tone = warmth > 0.6 ? "softly" : warmth > 0.35 ? "steadily" : "quietly";
    return `${subject} walks ${tone} through ${place}, in ${leadMood}, and ${leadMeta}.`;
  }

  function lineB() {
    // middle
    const curiousClause = curiosity > 0.6 ? "asks the midnight why and keeps the answer" : "listens when a page sighs";
    const creativeClause = creativity > 0.6 ? "folding new maps from old paper" : "tracing light on familiar walls";
    const openClause = openness > 0.55 ? `open to small overturnings of fate` : `content with small certainties`;
    return `They ${curiousClause}, ${creativeClause}, ${openClause}.`;
  }

  function lineC() {
    // closer
    const hopeWeight = opt;
    const melWeight = mel;
    const endingTone = hopeWeight > melWeight ? "a ribbon of bright future" : "a soft, ancestral dusk";
    const finalTouch = pick(rng, metaphors);
    return `At the close they keep ${endingTone}, and ${finalTouch}.`;
  }

  const story = `${lineA()} ${lineB()} ${lineC()}`;

  // Compose quote: short and punchy, shaped by dominant trait
  const dominantTrait = (() => {
    const map = [
      [openness, "openness"],
      [data.empathy ? (data.empathy / 100) : 0, "empathy"],
      [curiosity, "curiosity"],
      [mel, "melancholy"],
      [opt, "optimism"],
      [creativity, "creativity"],
    ];
    map.sort((a, b) => b[0] - a[0]);
    return map[0][1];
  })();

  const quoteTemplates: Record<string, string[]> = {
    openness: [
      "I keep a door open for the unexpected.",
      "New roads whisper my name and I answer.",
      "The world is a book and I fold its corners.",
    ],
    empathy: [
      "I gather other people's quiet and keep it warm.",
      "There is a soft ledger where I write the feelings of strangers.",
      "I touch a sorrow as if it were a small, breakable glass.",
    ],
    curiosity: [
      "Questions are the lanterns I carry at night.",
      "I ask until the world is a series of unlocked doors.",
      "Wonder is the language I practise most.",
    ],
    melancholy: [
      "Melancholy is a long river I sometimes row with careful hands.",
      "I keep a pocket for old, slow aches—gentle and honest.",
      "The sweetest music sometimes comes from a blue room.",
    ],
    optimism: [
      "Hope is stubborn and I am friend to its small fires.",
      "I plant mornings like seeds and watch them rise.",
      "There is always a next page I expect to be kinder.",
    ],
    creativity: [
      "I braid new constellations from found fragments.",
      "My fingers build improbable bridges for the heart.",
      "I turn silence into a curious instrument.",
    ],
    default: [
      "A small brave thing lives inside me, always awake.",
      "I keep lighting a match to see what tomorrow might learn.",
    ],
  };

  const chosenQuoteArr = quoteTemplates[dominantTrait] || quoteTemplates.default;
  const quote = pick(rng, chosenQuoteArr);

  // Ensure strings are trimmed and reasonable length
  return {
    title: title.trim(),
    story: story.trim(),
    quote: quote.trim(),
  };
}
