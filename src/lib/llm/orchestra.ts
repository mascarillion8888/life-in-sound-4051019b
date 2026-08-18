/**
 * TypeScript-native Orchestra runtime — server-side bridge.
 *
 * Only the `summarizer` role is wired here, because it is the only Orchestra
 * role used by the product: Life Story generation in
 * `generateStory.server.ts`. The other seven roles (orchestrator, coder,
 * reviewer, researcher, verifier, triage, guardian) defined in the canonical
 * Python spec (`orchestra/router.py` + `orchestra/config.yaml`) are not part
 * of the product runtime — they exist solely as an ad-hoc multi-model
 * development tool for OpenHands authoring sessions. See `orchestra/README.md`.
 *
 * Provider calls use native `fetch` against OpenAI-compatible
 * chat-completions endpoints (no LiteLLM, no Python).
 *
 * SECURITY:
 *   - Provider API keys are read from server-only environment variables
 *     (GROQ_API_KEY for summarizer).
 *   - These are NEVER prefixed with `VITE_` and are NEVER imported by any
 *     client module. This file must only be imported from server functions
 *     (`*.server.ts`) or other server-only modules.
 *   - No key is ever returned from any function here.
 *
 * The Python `orchestra/` directory remains the canonical reference/spec and
 * is not modified by this TypeScript bridge.
 */

/**
 * Product Orchestra roles. Only `summarizer` is implemented; the dev-only
 * roles from the Python spec are deliberately absent from the product runtime.
 */
export type OrchestraRole = "summarizer";

/** Provider routing config: role -> { provider endpoint, model, api key env var }. */
type ProviderSpec = {
  /** OpenAI-compatible chat-completions endpoint. */
  endpoint: string;
  /** Model identifier accepted by the provider. */
  model: string;
  /** Name of the server-only env var holding the API key. */
  keyEnv: string;
};

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Role → provider/model/key mapping. Only `summarizer` is mapped; it is the
 * sole role the product calls. Kept consistent with the `summarizer` entry in
 * `orchestra/router.py` ROLE_MAP / `orchestra/config.yaml` model_list.
 */
const ROLE_PROVIDER: Record<OrchestraRole, ProviderSpec> = {
  summarizer: {
    endpoint: GROQ_ENDPOINT,
    model: "qwen/qwen3.6-27b",
    keyEnv: "GROQ_API_KEY",
  },
};

/** Per-role system prompts, mirrored from orchestra/router.py ROLE_PROMPTS. */
const ROLE_PROMPTS: Record<OrchestraRole, string> = {
  summarizer: "You are a summarizer. Compress to essentials. Bullet points.",
};

export type RunRoleOptions = {
  temperature?: number;
  maxTokens?: number;
  /** Optional fetch override (for tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Abort signal for request cancellation. */
  signal?: AbortSignal;
};

/** Return the role → model mapping (no secrets). Mirrors list_roles() in Python. */
export function listRoles(): Record<OrchestraRole, string> {
  const out: Partial<Record<OrchestraRole, string>> = {};
  for (const role of Object.keys(ROLE_PROVIDER) as OrchestraRole[]) {
    out[role] = ROLE_PROVIDER[role].model;
  }
  return out as Record<OrchestraRole, string>;
}

function getApiKey(keyEnv: string): string | null {
  // server-only env access. Never VITE_-prefixed.
  const value = process.env?.[keyEnv];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function extractContent(payload: unknown): string | null {
  // OpenAI-compatible response shape: choices[0].message.content
  if (typeof payload !== "object" || payload === null) return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0] as {
    message?: { content?: unknown };
  };
  const content = first?.message?.content;
  if (typeof content !== "string") return null;
  const trimmed = content.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Run a single Orchestra role call against its mapped provider.
 *
 * Returns the assistant text, or `null` on any failure (missing key, network
 * error, non-OK status, empty/malformed response). Never throws — callers can
 * treat `null` as "provider unavailable, use fallback".
 *
 * Mirrors `run_role()` in orchestra/router.py but via native fetch and without
 * LiteLLM. No API key is returned or logged.
 */
export async function runRole(
  role: OrchestraRole,
  userMessage: string,
  options: RunRoleOptions = {},
): Promise<string | null> {
  const spec = ROLE_PROVIDER[role];
  if (!spec) return null;

  const apiKey = getApiKey(spec.keyEnv);
  if (!apiKey) return null; // provider not configured → fallback

  const systemPrompt = ROLE_PROMPTS[role];
  const temperature = options.temperature ?? 0.3;
  const maxTokens = options.maxTokens ?? 512;
  const fetchImpl = options.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(spec.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      signal: options.signal,
      body: JSON.stringify({
        model: spec.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });
  } catch {
    return null; // network error → fallback
  }

  if (!response.ok) return null;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return null;
  }

  return extractContent(payload);
}
