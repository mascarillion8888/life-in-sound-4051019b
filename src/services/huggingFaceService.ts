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
 */
export async function generateGothicArt(params: GenerateGothicArtParams): Promise<string> {
  const token = import.meta.env.VITE_HF_TOKEN;
  if (!token) {
    throw new Error("VITE_HF_TOKEN environment variable is not defined.");
  }

  const response = await fetch(HF_MODEL_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(gothicArtPrompt(params)),
  });

  if (!response.ok) {
    throw new Error(`HuggingFace Generation Error: ${response.status} - ${response.statusText}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
