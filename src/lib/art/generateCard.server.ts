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

import { runRole } from "@/lib/llm/orchestra";

import { generateCardArtworkCore } from "./cardArtwork.server";
import {
  buildMultidimensionalPrompt,
  cardArtworkSceneForGenre,
  deterministicLore,
  historicalEraYear,
  type CardEncounter,
} from "./cardBlueprint";

export type GenerateCardInput = CardEncounter & {
  /** Stable cache identity: provider track id, or artist:title for manual. */
  trackKey: string;
  /** The card's journey position (0-based) — fallback era signal. */
  cardIndex?: number;
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

function buildLorePrompt(encounter: CardEncounter): string {
  const eraYear = historicalEraYear(encounter);
  const parts = [
    `Write a friendly, poetic nostalgia snippet of exactly 2 sentences for a music memory card.`,
    `The listener first heard "${encounter.songTitle}" by ${encounter.artist || "an artist"}`,
  ];
  if (typeof encounter.encounterAge === "number") {
    parts.push(`at age ${Math.floor(encounter.encounterAge)}`);
  }
  if (eraYear) parts.push(`(around ${eraYear})`);
  parts.push(".");
  if (encounter.genre) parts.push(`Genre: ${encounter.genre}.`);
  if (encounter.userMemory?.trim()) {
    parts.push(`Personal memory to honour: ${encounter.userMemory.trim()}.`);
  }
  parts.push(
    "Warm, gentle, second-person-free prose about a child absorbed in music. " +
      "No artist face descriptions, no lyrics, no quotes. Reply with ONLY the 2 sentences.",
  );
  return parts.join(" ");
}

/** LLM lore with deterministic fallback — never null, never throws. */
export async function generateCardLoreCore(
  encounter: CardEncounter,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<string> {
  try {
    const llm = await runRole("summarizer", buildLorePrompt(encounter), {
      temperature: 0.8,
      maxTokens: 160,
      fetchImpl: options.fetchImpl,
    });
    const cleaned = llm?.trim();
    if (cleaned && cleaned.length >= 20 && cleaned.length <= 600) return cleaned;
  } catch {
    /* fall through to deterministic */
  }
  return deterministicLore(encounter);
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
    userMemory: typeof input.userMemory === "string" ? input.userMemory.slice(0, 500) : null,
    cardIndex:
      typeof input.cardIndex === "number" && Number.isFinite(input.cardIndex)
        ? Math.floor(input.cardIndex)
        : undefined,
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
    const [lore, image] = await Promise.all([
      generateCardLoreCore(encounter),
      generateCardArtworkCore({
        trackKey: `${data.trackKey}::card`,
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
