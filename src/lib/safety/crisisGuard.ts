/**
 * CrisisGuard — deterministic, client-safe free-text guard.
 *
 * WHY (see docs/ETHICAL_AI.md): the product turns the user's words into poetic
 * narrative. When the user's OWN unedited free text expresses distress or
 * self-harm intent, it must NEVER be fed to the LLM (which would narrate it
 * poetically) nor persisted as a memory note. This module detects that signal
 * FIRST, before any LLM call, so the app can step out of the storyteller role
 * and show a plain, humane support surface instead.
 *
 * DESIGN PRINCIPLES:
 *   - Pure and deterministic: no I/O, no randomness, no network. Safe to import
 *     from tests and from the client bundle.
 *   - Precision-biased: patterns target explicit self-harm / suicid(al) intent
 *     in the app's supported languages. It favours NOT disturbing the many
 *     melancholy-but-healthy notes over theoretical recall; the real signal is
 *     the user's own words, and we want a strong, specific match before we
 *     interrupt the storytelling flow.
 *   - ANA_YASA §0: this is deterministic logic, never mimicked/fabricated data.
 *   - Disable switch: `VITE_CRISIS_GUARD="off"` disables detection at the call
 *     site (guard is ON by default — this exists only for demos/tests).
 *
 * NOTE: detection is not exhaustive and is NOT a substitute for human care or
 * professional help. When it trips we show a support surface; when it does not
 * trip the app simply continues normally. Language coverage: en/tr/es/de/fr
 * (the app's SUPPORTED_LANGUAGES).
 */

/**
 * Explicit self-harm / suicid(al) intent patterns, per language family.
 * Kept deliberately specific — each regex requires an explicit intent verb or
 * noun, so common melancholy phrasing ("missing someone", "sad song",
 * "dark days") does NOT trip the guard.
 */
const CRISIS_PATTERNS: RegExp[] = [
  // English
  /\b(kill (myself|me|yourself)|suicid[a-z]*|end (my\s+)?(own\s+)?life|take (my\s+)?(own\s+)?life|want(ed|s)?\s+to\s+di(e|ing)|wanna\s+die|don'?t\s+want\s+to\s+(be\s+(alive|here)|live( anymore|\s+no more)?|wake\s+up)|(wish|hope)(\s+I)?\s+(wouldn'?t|won'?t|never)\s+wake\s+up|never\s+wake\s+up|better\s+(off|be)\s+(dead|gone)|self[- ]?harm|cutt?ing\s+(myself|myself again)|overdos[e]\s*\(?|no\s+reason\s+to\s+(live|go\s+on))/i,
  // Türkçe
  /\b(intihar|kendimi\s+(öldür|vur|as|yara|kese)|canımı\s+(yak|almak)|yaşamak\s+istemiyorum|ölmek\s+istiyorum|hayatıma\s+son\s+verece(m|gim?))/i,
  // Español
  /\b(suicid[a-z]*|quiero\s+morir|no\s+quiero\s+(vivir|seguir)|hacerme\s+daño|matarme|quitarme\s+la\s+vida)/i,
  // Deutsch
  /\b(suizid|selbstmord|ich\s+will\s+nicht\s+mehr\s+(leben|weiter)|will\s+sterben|mich\s+umbringen|mir\s+(selbst\s+)?wehtun)/i,
  // Français
  /\b(suicid[a-z]*|je\s+veux\s+mourir|(ne\s+)?veux\s+plus\s+vivre|me\s+faire\s+du\s+mal|me\s+tuer|en\s+finir)/i,
];

/** Normalize for matching: lowercase + trim (keeps internal punctuation). */
export function normalizeNote(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * Deterministic detection. Returns true when the (trimmed, lowercased) text
 * contains an explicit self-harm / suicid(al) intent pattern. Empty or
 * whitespace-only input never trips the guard. Case-insensitive.
 */
export function detectCrisisNote(text: string): boolean {
  const normalized = normalizeNote(text);
  if (!normalized) return false;
  return CRISIS_PATTERNS.some((re) => re.test(normalized));
}

/**
 * Global safeguard toggling, read once from the client env. Guard is ON by
 * default; `VITE_CRISIS_GUARD="off"` disables it (demos/tests only).
 */
let cachedEnabled: boolean | null = null;
export function crisisGuardEnabled(): boolean {
  if (cachedEnabled !== null) return cachedEnabled;
  const raw =
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    typeof import.meta.env.VITE_CRISIS_GUARD === "string"
      ? import.meta.env.VITE_CRISIS_GUARD
      : undefined;
  cachedEnabled = raw !== "off";
  return cachedEnabled;
}
