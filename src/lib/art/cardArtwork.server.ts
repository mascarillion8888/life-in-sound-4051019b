/**
 * Era Card fine-art artwork — TanStack Start server function.
 *
 * Visuals and audio are deliberately decoupled: the music providers (iTunes /
 * Spotify) supply ONLY track metadata + the 30s preview stream. The imagery
 * on an Era Card face is a purpose-made gothic oil painting generated from
 * the song's artist + title — never the provider's square album cover.
 *
 * Provider chain (first success wins): Imagen → Gemini native image →
 * Hugging Face Inference (`hfImage.server.ts`). Any subset of keys works;
 * with no key at all the UI keeps its dark gothic placeholder.
 *
 * SECURITY:
 *   - Keys are read from `GEMINI_API_KEY` / `HUGGINGFACE_API_KEY` —
 *     server-only env vars, NEVER `VITE_`-prefixed. This file must only be
 *     imported from server code.
 *   - No key is ever returned; failures map to `{ image: null }` so the UI
 *     keeps its dark gothic placeholder — never a fabricated image.
 *
 * Caching: generated paintings are expensive, so successes are memoized
 * server-side per process (keyed by track id / artist). The client hook adds
 * a second, persistent tier (localStorage) so a reload does not re-generate.
 */
import { createServerFn } from "@tanstack/react-start";

import { generateHfImage } from "./hfImage.server";
import { cardArtworkScene, SCENE_SPECS, type SceneSpec } from "./scene";

const IMAGEN_MODEL = () =>
  (typeof process !== "undefined" && process.env?.GEMINI_IMAGE_MODEL?.trim()) ||
  "imagen-3.0-generate-002";
const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
/** Image generation is slow — cap it hard so a hung call never stalls a card. */
const DEFAULT_TIMEOUT_MS = 25_000;

export type CardArtworkInput = {
  /** Stable cache identity: provider track id, or artist:title for manual songs. */
  trackKey: string;
  artist: string;
  title: string;
  /** Provider release year (4-digit) when known — steers the scene's era. */
  releaseYear?: number | null;
  /** The card's journey position (0-based) — the fallback era signal. */
  cardIndex?: number;
  /** Album/release name — extra genre signal text for scene selection. */
  album?: string | null;
  /**
   * The listener's preferred aesthetic family ("reggae", "jazz", "synth",
   * "gothic", …) — the strongest scene signal when supplied.
   */
  aesthetic?: string | null;
  /**
   * Client-resolved scene id (cache discriminator). When supplied, the
   * builder uses it verbatim instead of re-resolving — the client and server
   * share `cardArtworkScene` from `./scene`, so they can never disagree
   * even when the prompt itself evolves over time.
   */
  scene?: string | null;
  /**
   * Fully synthesized prompt from the multidimensional blueprint
   * (`cardBlueprint.ts`). When present it replaces the internally built
   * brief; the scene is still resolved for cache identity.
   */
  promptOverride?: string | null;
};

export type CardArtworkOutput = {
  /** data:image/...;base64 URL of the generated painting, or null on failure. */
  image: string | null;
};

/** Process-level cache — successes only (transient failures stay retryable). */
const SERVER_ART_CACHE = new Map<string, string>();

/**
 * Build the multi-dimensional fine-art brief. Four dimensions travel
 * together: the scene's lighting/medium (genre-aesthetic), the listener's
 * life-stage environment (journey position), the era's emotion, and a
 * TYPOGRAPHIC vinyl sleeve (abstract glyphs/geometry only — never a
 * photographic face or painted portrait) integrated organically into the
 * room's texture. Card titles live in the HTML layer; the painting renders
 * the scene only, never card text. Exported for tests; the identity of the
 * chosen scene feeds the cache key.
 */
/**
 * The listener's environment mirrors their age at that life era — journey
 * position stands in for the life stage when the song's own year is unknown.
 */
const LIFE_STAGE_ROOMS = [
  "a childhood bedroom",
  "a childhood bedroom",
  "a teenage den",
  "a teenage den",
  "a college dorm studio",
  "a college dorm studio",
  "a mature personal study",
  "a mature personal study",
] as const;

/** Era emotion carried into the scene's mood. */
const ERA_EMOTIONS = [
  "innocence",
  "first identity",
  "rebellion",
  "inquiry",
  "strength",
  "darkness",
  "longing",
  "acceptance",
] as const;
export function buildCardArtworkPrompt(
  artist: string,
  title: string,
  context: {
    genreText?: string;
    releaseYear?: number | null;
    aesthetic?: string | null;
    scene?: string | null;
    cardIndex?: number;
  } = {},
): { prompt: string; scene: string } {
  const subject = artist || title;
  const scene =
    context.scene ??
    cardArtworkScene(
      { aesthetic: context.aesthetic },
      context.genreText ?? `${title} ${artist}`,
      context.releaseYear ?? null,
    );
  const spec = SCENE_SPECS.find((s) => s.id === scene) ?? SCENE_SPECS[0];
  const cardIndex = context.cardIndex ?? 0;
  const room = LIFE_STAGE_ROOMS[cardIndex % LIFE_STAGE_ROOMS.length];
  const emotion = ERA_EMOTIONS[cardIndex % ERA_EMOTIONS.length];
  const prompt =
    `A high-end fine-art concept illustration representing the song '${title}' by ${subject}. ` +
    `Environment: A personalized room setting — ${room} — conveying a strong sense of ${emotion}. ` +
    `Artistic Style: ${spec.prompt(subject)} ` +
    `Integration: The child holds and gazes at a vinyl album sleeve with a pure abstract ` +
    `typographic design — stylized unreadable glyphs and geometric shapes (light rays, circles, ` +
    `angular forms) on a flat muted background, seamlessly integrated into the room's decor, ` +
    `perfectly matching the room's lighting and texture. Absolutely no photographic face, ` +
    `portrait or human figure on the sleeve, and no painted artist portrait anywhere in the ` +
    `scene. Render only the scene — never draw card titles, headings or any readable text into ` +
    `the image.`;
  return { prompt, scene: spec.id };
}

function getGeminiServerKey(): string | null {
  const value = typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

type ImagenPredictResponse = {
  predictions?: { bytesBase64Encoded?: string; mimeType?: string }[];
};

type GeminiImageResponse = {
  candidates?: {
    content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
  }[];
};

/** Primary: Imagen `:predict` (dedicated image model). Null on any failure. */
async function tryImagen(
  prompt: string,
  apiKey: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<string | null> {
  const response = await fetchImpl(`${API_BASE}/${IMAGEN_MODEL()}:predict`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    signal,
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: "1:1" },
    }),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as ImagenPredictResponse;
  const prediction = payload.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) return null;
  return `data:${prediction.mimeType ?? "image/png"};base64,${prediction.bytesBase64Encoded}`;
}

/** Fallback: Gemini native image generation via `generateContent`. */
async function tryGeminiImage(
  prompt: string,
  apiKey: string,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<string | null> {
  const response = await fetchImpl(`${API_BASE}/${GEMINI_IMAGE_MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    signal,
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as GeminiImageResponse;
  const part = payload.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) return null;
  return `data:${part.inlineData.mimeType ?? "image/png"};base64,${part.inlineData.data}`;
}

export type GenerateCardArtworkOptions = {
  /** Injectable fetch (for tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/**
 * Core generation logic, exported for tests. Never throws; returns the data
 * URL on success, null when no key is configured or every provider path
 * failed. Successful results are memoized per process.
 */
export async function generateCardArtworkCore(
  input: CardArtworkInput,
  options: GenerateCardArtworkOptions = {},
): Promise<string | null> {
  const built = buildCardArtworkPrompt(input.artist, input.title, {
    genreText: `${input.title} ${input.artist} ${input.album ?? ""}`,
    releaseYear: input.releaseYear ?? null,
    aesthetic: input.aesthetic,
    scene: input.scene ?? null,
    cardIndex: input.cardIndex,
  });
  // A blueprint-supplied brief wins over the internally built one; the
  // resolved scene still feeds the cache identity below.
  const prompt = input.promptOverride?.trim() || built.prompt;
  const scene = built.scene;
  // The scene is part of the cache identity — the same track re-imagined in
  // a different aesthetic must generate a new painting, never reuse the old.
  const cacheKey = `${input.trackKey}::${scene}`;

  const cached = SERVER_ART_CACHE.get(cacheKey);
  if (cached) return cached;

  const apiKey = getGeminiServerKey();
  const fetchImpl = options.fetchImpl ?? fetch;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    // Provider chain: Imagen → Gemini native image → HF Inference. Each tier
    // returns null on failure; the first painting wins. Gemini tiers are
    // skipped without GEMINI_API_KEY; HF reads its own HUGGINGFACE_API_KEY
    // and stays silent without it — either key alone is enough to serve.
    const image =
      (apiKey
        ? await tryImagen(prompt, apiKey, fetchImpl, controller.signal).catch(() => null)
        : null) ??
      (apiKey
        ? await tryGeminiImage(prompt, apiKey, fetchImpl, controller.signal).catch(() => null)
        : null) ??
      (await generateHfImage(prompt, {
        fetchImpl,
        signal: controller.signal,
      }).catch(() => null));
    if (image) SERVER_ART_CACHE.set(cacheKey, image);
    return image;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Test-only: reset the process-level memoization. */
export function __clearCardArtworkServerCache(): void {
  SERVER_ART_CACHE.clear();
}

export const generateCardArtwork = createServerFn({ method: "POST" })
  .inputValidator((input: CardArtworkInput) => ({
    trackKey: String(input.trackKey ?? "").slice(0, 200),
    artist: String(input.artist ?? "").slice(0, 200),
    title: String(input.title ?? "").slice(0, 200),
    releaseYear:
      typeof input.releaseYear === "number" && Number.isFinite(input.releaseYear)
        ? Math.floor(input.releaseYear)
        : null,
    cardIndex:
      typeof input.cardIndex === "number" && Number.isFinite(input.cardIndex)
        ? Math.floor(input.cardIndex)
        : undefined,
    album: typeof input.album === "string" ? input.album.slice(0, 200) : null,
    aesthetic: typeof input.aesthetic === "string" ? input.aesthetic.slice(0, 100) : null,
    promptOverride:
      typeof input.promptOverride === "string" ? input.promptOverride.slice(0, 2000) : null,
  }))
  .handler(async ({ data }): Promise<CardArtworkOutput> => {
    if (!data.trackKey || !data.title) return { image: null };
    const image = await generateCardArtworkCore(data);
    return { image };
  });
