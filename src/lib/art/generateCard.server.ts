/**
 * Multidimensional Dynamic Card — server route (Option B port).
 *
 * One server function owns the full card lifecycle that card-studio split
 * across NextAuth + Prisma + Vercel Blob:
 *
 *   1. Lore: a friendly, poetic 2-sentence nostalgia snippet for the lore
 *      box. The Orchestra `summarizer` role writes it when GROQ_API_KEY is
 *      configured; otherwise the deterministic track-seeded fallback serves
 *      (the lore box is never empty, never fabricated by the client).
 *   2. Painting: the multidimensional blueprint prompt
 *      (`cardBlueprint.ts`) flows through the existing provider chain
 *      (Imagen → Gemini native → HF) via `generateCardArtworkCore` — the
 *      card face never shows a raw album photo.
 *   3. Persistence: the painting bytes go to the private `card-artworks`
 *      Storage bucket ("<user_id>/<uuid>.png") and the full card state to
 *      the `cards` table (migration 0003), both through the caller's own
 *      Supabase session (anon key + RLS — no service role anywhere).
 *
 * SECURITY:
 *   - LLM/image keys stay server-only (orchestra.ts / cardArtwork.server.ts).
 *   - The client passes its own access token; persistence runs under that
 *     user's RLS context, so one user can never write another's cards.
 *   - Every failure degrades: lore → deterministic, image → null (gothic
 *     placeholder), persistence → skipped. This route never throws.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import { invalidateCardsCache } from "@/lib/supabase/cards-remote";
import { DEFAULT_LANGUAGE, LANGUAGE_NAMES, isLanguage, type Language } from "@/lib/i18n/languages";
import { runRole } from "@/lib/llm/orchestra";
import { callOpenRouter } from "@/lib/openrouter.server";

import { generateCardArtworkCore } from "./cardArtwork.server";
import {
  buildMultidimensionalPrompt,
  cardArtworkSceneForGenre,
  historicalEraYear,
  type CardEncounter,
} from "./cardBlueprint";
import {
  buildLoreUserPrompt,
  generateLoreCore,
  hasForbiddenPhrase,
  isGenericLore,
  LORE_STYLE_VERSION,
  LORE_SYSTEM_PROMPT,
  MAX_LORE_CHARS,
} from "./loreEngine";

// Text hygiene + the pipeline live in `loreEngine.ts`; re-exported so existing
// importers keep working and callers share one implementation.
export {
  cleanLore,
  hasForbiddenPhrase,
  isGenericLore,
  LORE_STYLE_VERSION,
  MAX_LORE_CHARS,
} from "./loreEngine";

export type GenerateCardInput = CardEncounter & {
  /** Stable cache identity: provider track id, or artist:title for manual. */
  trackKey: string;
  /** The card's journey position (0-based) — fallback era signal. */
  cardIndex?: number;
  /** Active UI language — the lore is written in this language. */
  language?: Language | null;
  /** Caller's Supabase access token — persistence is skipped without it. */
  accessToken?: string | null;
};

export type GenerateCardOutput = {
  /** 2-sentence lore snippet (LLM or deterministic fallback). Never null. */
  lore: string;
  /** data:image URL of the painting, or null → gothic placeholder. */
  image: string | null;
  /** The resolved scene family that steered the prompt. */
  scene: string;
  /** True when the card row + painting were persisted to Supabase. */
  persisted: boolean;
};

const DAILY_LIMIT = 20; // ported from card-studio's per-user quota

/* -------------------------------------------------------------------------- */
/* Lore                                                                        */
/* -------------------------------------------------------------------------- */

export function buildLorePrompt(encounter: CardEncounter & { language?: Language | null }): string {
  const language = isLanguage(encounter.language) ? encounter.language : DEFAULT_LANGUAGE;
  return buildLoreUserPrompt({
    songTitle: encounter.songTitle,
    artist: encounter.artist,
    eraYear: historicalEraYear(encounter),
    releaseYear: encounter.releaseYear ?? null,
    age: encounter.encounterAge ?? null,
    genre: encounter.genre ?? null,
    mood: encounter.mood ?? null,
    userMemory: encounter.userMemory ?? null,
    discoveredLater: encounter.discoveredLater ?? null,
    languageName: LANGUAGE_NAMES[language],
  });
}

/**
 * Provider chain for lore: OpenRouter (Gemini) first, then the Groq
 * `summarizer` role. Returns null when neither is configured or both fail,
 * so the pipeline can fall back to the deterministic lines. The single call
 * returns three candidates, so the token budget covers all of them.
 */
async function writeLoreText(userPrompt: string, fetchImpl?: typeof fetch): Promise<string | null> {
  try {
    const viaOpenRouter = await callOpenRouter(
      [
        { role: "system", content: LORE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.9, maxTokens: 900, fetchImpl },
    );
    if (viaOpenRouter != null) return viaOpenRouter;
  } catch {
    /* fall through to Groq */
  }
  return runRole("summarizer", userPrompt, { temperature: 0.9, maxTokens: 900, fetchImpl });
}

/**
 * LLM lore with deterministic fallback — never null, never throws. Delegates the
 * hygiene (leak / leading-age / copy / review-language / length) and the single
 * rewrite to `generateLoreCore` in the pure `loreEngine`.
 */
export async function generateCardLoreCore(
  encounter: GenerateCardInput,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<string> {
  const language = isLanguage(encounter.language) ? encounter.language : DEFAULT_LANGUAGE;
  const { text } = await generateLoreCore(
    { ...encounter, languageName: LANGUAGE_NAMES[language] },
    async (userPrompt) => {
      const providerText = await writeLoreText(userPrompt, options.fetchImpl);
      return { text: providerText, via: "openrouter" as const };
    },
  );
  return text;
}

/* -------------------------------------------------------------------------- */
/* Persistence (cards table + card-artworks bucket, caller's RLS context)      */
/* -------------------------------------------------------------------------- */

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { bytes, mime: match[1].toLowerCase() };
  } catch {
    return null;
  }
}

/**
 * Persist one card under the caller's own session. Uses the anon key with
 * the user's JWT — RLS (migration 0003) enforces ownership; no service-role
 * key exists in this codebase. Failures are swallowed: a network blip must
 * never cost the user their card.
 */
export async function persistCardCore(
  input: GenerateCardInput,
  lore: string,
  scene: string,
  image: string | null,
  options: { supabaseUrl?: string; anonKey?: string } = {},
): Promise<boolean> {
  const token = input.accessToken?.trim();
  const url = options.supabaseUrl ?? process.env.VITE_SUPABASE_URL;
  const anonKey = options.anonKey ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !url || !anonKey) return false;

  try {
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const userId = (await supabase.auth.getUser(token)).data.user?.id;
    if (!userId) return false;

    // Daily quota — same rule as card-studio's DAILY_LIMIT, enforced here
    // because RLS counts rows, not rate.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if ((count ?? 0) >= DAILY_LIMIT) return false;

    const cardId = crypto.randomUUID();
    let imagePath: string | null = null;

    if (image) {
      const decoded = dataUrlToBytes(image);
      if (decoded) {
        const ext = decoded.mime === "image/jpeg" ? "jpg" : "png";
        imagePath = `${userId}/${cardId}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("card-artworks")
          .upload(imagePath, decoded.bytes, { contentType: decoded.mime });
        if (uploadError) imagePath = null;
      }
    }

    const { error } = await supabase.from("cards").insert({
      id: cardId,
      user_id: userId,
      track_key: input.trackKey,
      title: input.songTitle,
      artist: input.artist,
      genre: input.genre ?? null,
      release_year: input.releaseYear ?? null,
      birth_year: input.birthYear ?? null,
      encounter_age: input.encounterAge ?? null,
      user_memory: input.userMemory ?? null,
      scene,
      lore,
      image_path: imagePath,
    });
    if (!error) invalidateCardsCache();
    return !error;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Server function                                                             */
/* -------------------------------------------------------------------------- */

export const generateCard = createServerFn({ method: "POST" })
  .inputValidator((input: GenerateCardInput): GenerateCardInput => ({
    trackKey: String(input.trackKey ?? "").slice(0, 200),
    artist: String(input.artist ?? "").slice(0, 200),
    songTitle: String(input.songTitle ?? "").slice(0, 200),
    genre: typeof input.genre === "string" ? input.genre.slice(0, 100) : null,
    releaseYear:
      typeof input.releaseYear === "number" && Number.isFinite(input.releaseYear)
        ? Math.floor(input.releaseYear)
        : null,
    birthYear:
      typeof input.birthYear === "number" && Number.isFinite(input.birthYear)
        ? Math.floor(input.birthYear)
        : null,
    encounterAge:
      typeof input.encounterAge === "number" && Number.isFinite(input.encounterAge)
        ? Math.floor(input.encounterAge)
        : null,
    mood: typeof input.mood === "string" ? input.mood.slice(0, 40) : null,
    userMemory: typeof input.userMemory === "string" ? input.userMemory.slice(0, 500) : null,
    discoveredLater: input.discoveredLater === true,
    cardIndex:
      typeof input.cardIndex === "number" && Number.isFinite(input.cardIndex)
        ? Math.floor(input.cardIndex)
        : undefined,
    language: isLanguage(input.language) ? input.language : null,
    accessToken: typeof input.accessToken === "string" ? input.accessToken.slice(0, 4096) : null,
  }))
  .handler(async ({ data }): Promise<GenerateCardOutput> => {
    if (!data.trackKey || !data.songTitle) {
      return { lore: "", image: null, scene: "gothic", persisted: false };
    }

    const encounter: CardEncounter = data;
    const scene = cardArtworkSceneForGenre(encounter);
    const prompt = buildMultidimensionalPrompt(encounter);

    // Lore + painting are independent — run both, degrade each separately.
    // The painting uses the SAME trackKey as the artwork hook
    // (useCardArtwork → cardArtwork.server.ts), so both share one process-level
    // cache entry per `trackKey::scene`. The generated painting is persisted to
    // the gallery, and the QuizCard face shows it from the same cache tier —
    // a "::card" suffix would mint a second key and silently double image
    // generation (and archive a painting that differs from the on-screen one).
    const [lore, image] = await Promise.all([
      generateCardLoreCore(data),
      generateCardArtworkCore({
        trackKey: data.trackKey,
        artist: data.artist,
        title: data.songTitle,
        releaseYear: data.releaseYear,
        cardIndex: data.cardIndex,
        aesthetic: data.genre,
        promptOverride: prompt,
      }),
    ]);

    const persisted = await persistCardCore(data, lore, scene, image);
    return { lore, image, scene, persisted };
  });
