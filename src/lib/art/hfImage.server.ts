/**
 * Hugging Face Inference — server-only image provider for Era Card artwork.
 *
 * Third tier in the card-artwork chain (after Imagen + Gemini native image,
 * see `cardArtwork.server.ts`). The Era Card face never shows the provider's
 * album cover — imagery is always a purpose-made fine-art painting generated
 * from the song's scene prompt. HF Inference supplies that painting as a
 * text-to-image call against the HF router; the same scene prompt that steers
 * Gemini steers HF, so the gothic/woodcut visual language is identical
 * regardless of which provider answers.
 *
 * SECURITY:
 *   - The key is read from `HUGGINGFACE_API_KEY` — a server-only env var,
 *     NEVER `VITE_`-prefixed. This file must only be imported from server
 *     code (`*.server.ts`).
 *   - No key is ever returned or logged. Every failure path returns null so
 *     the caller falls back to its static placeholder — never a fabricated
 *     image, never an exception.
 */

const HF_ROUTER = "https://router.huggingface.co/hf-inference/models";

/**
 * Default text-to-image model; override with HF_IMAGE_MODEL (server-only).
 * Must be in the live hf-inference catalog — SDXL base and FLUX schnell were
 * deprecated (HTTP 410); SD3-medium-diffusers is the served successor.
 */
const DEFAULT_MODEL = "stabilityai/stable-diffusion-3-medium-diffusers";

/**
 * Style anchor appended to every HF prompt — keeps the output in the
 * product's dark gothic woodcut register even for base models that drift
 * toward glossy photorealism.
 */
const STYLE_SUFFIX =
  ", dark gothic woodcut fine-art engraving, candlelit chiaroscuro, " +
  "etched ink texture, muted antique palette, no text, no watermark";

export type HfImageOptions = {
  /** Injectable fetch (for tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

function getHfServerKey(): string | null {
  const value = typeof process !== "undefined" ? process.env?.HUGGINGFACE_API_KEY : undefined;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getHfModel(): string {
  const value = typeof process !== "undefined" ? process.env?.HF_IMAGE_MODEL : undefined;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : DEFAULT_MODEL;
}

/**
 * Generate one painting via HF Inference text-to-image.
 *
 * Returns a `data:image/...;base64` URL on success, null on any failure:
 * missing key, network error, non-OK status (including 503 "model loading"),
 * JSON error bodies, or empty image bytes. Never throws, never logs the key.
 */
export async function generateHfImage(
  prompt: string,
  options: HfImageOptions = {},
): Promise<string | null> {
  const apiKey = getHfServerKey();
  if (!apiKey) return null; // provider not configured → caller falls back

  const fetchImpl = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(`${HF_ROUTER}/${getHfModel()}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "image/png",
      },
      signal: options.signal,
      body: JSON.stringify({
        inputs: `${prompt}${STYLE_SUFFIX}`,
        parameters: { guidance_scale: 7.5, num_inference_steps: 30 },
      }),
    });
  } catch {
    return null; // network error → fallback
  }

  if (!response.ok) return null; // includes 503 model-loading — retryable later

  // The router answers with raw image bytes on success, JSON on error even
  // with a 200 in some proxies — discriminate on content-type, never assume.
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) return null;

  let bytes: ArrayBuffer;
  try {
    bytes = await response.arrayBuffer();
  } catch {
    return null;
  }
  if (bytes.byteLength === 0) return null;

  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

/** Test-only introspection: the model the next call would target. */
export function __hfImageModelForTest(): string {
  return getHfModel();
}
