/**
 * HuggingFace Inference — gothic woodcut art generator.
 *
 * The prompt wrapper is a fixed template (dark gothic woodcut + chiaroscuro
 * keywords) so generated art stays stable across callers. Note: the token
 * here is `VITE_HF_TOKEN` — Vite exposes `VITE_*` to the browser, so this
 * client-side helper only works with intentionally public Inference tokens.
 * Server-side calls should use a non-VITE secret instead.
 */

const HF_MODEL_URL = "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1";

export interface GenerateGothicArtParams {
  prompt: string;
  negativePrompt?: string;
}

const DEFAULT_NEGATIVE = "bright colors, cheerful, cartoon, low contrast, blurry, smooth 3d render";

export function gothicArtPrompt({ prompt, negativePrompt }: GenerateGothicArtParams) {
  return {
    inputs: `${prompt}, dark gothic woodcut, candlelit chiaroscuro style, etched ink lines, deep shadows, dramatic mood`,
    parameters: {
      negative_prompt: negativePrompt || DEFAULT_NEGATIVE,
      num_inference_steps: 30,
      guidance_scale: 7.5,
    },
  };
}

/**
 * Returns an object-URL blob for display. The caller is responsible for
 * `URL.revokeObjectURL` after unmount — not freed here.
 *
 * Failures are thrown as classified {@link GothicArtError}s so the UI can
 * pick the right fallback (rate limit vs network vs provider error) without
 * parsing HTTP wording itself.
 */
export type GothicArtErrorKind =
  "missing-token" | "rate-limit" | "auth" | "network" | "provider" | "unknown";

/** Error thrown by `generateGothicArt`, carrying a stable, UI-actionable kind. */
export class GothicArtError extends Error {
  override name = "GothicArtError";
  kind: GothicArtErrorKind;
  status?: number;

  constructor(kind: GothicArtErrorKind, message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

/** Map an HTTP status to an actionable error kind. */
export function kindForStatus(status: number): GothicArtErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 429 || (status >= 500 && status <= 599)) return "rate-limit";
  if (status === 400 || status === 404) return "provider";
  return "unknown";
}

/** True when a retry is likely to succeed (rate-limit / flaky network). */
export function isRetryableHfError(error: unknown): boolean {
  return error instanceof GothicArtError
    ? error.kind === "rate-limit" || error.kind === "network"
    : false;
}

async function toHfError(cause: unknown): Promise<GothicArtError> {
  if (cause instanceof GothicArtError) return cause;
  if ((cause as { status?: unknown }).status != null) {
    const status = Number((cause as { status: unknown }).status);
    return new GothicArtError(
      kindForStatus(status),
      `HuggingFace Generation Error: ${status}`,
      status,
    );
  }
  if ((cause as Error).name === "AbortError") {
    return new GothicArtError("network", "HuggingFace request was aborted");
  }
  return new GothicArtError("network", "HuggingFace network error");
}

export async function generateGothicArt(params: GenerateGothicArtParams): Promise<string> {
  const token = import.meta.env.VITE_HF_TOKEN;
  if (!token) {
    throw new GothicArtError("missing-token", "VITE_HF_TOKEN environment variable is not defined.");
  }

  let response: Response;
  try {
    response = await fetch(HF_MODEL_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(gothicArtPrompt(params)),
    });
  } catch (cause) {
    throw await toHfError(cause);
  }

  if (!response.ok) {
    throw await toHfError({ status: response.status, statusText: response.statusText });
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
