/**
 * TypeScript-native Orchestra runtime — server-side bridge for the Node +
 * Nitro deployment.
 *
 * Mirrors the canonical Python Orchestra spec in `orchestra/router.py` +
 * `orchestra/config.yaml` (role → provider/model + per-role system prompts),
 * WITHOUT executing Python or importing LiteLLM. Provider calls use native
 * `fetch` against OpenAI-compatible chat-completions endpoints.
 *
 * SECURITY:
 *   - Provider API keys are read from server-only environment variables
 *     (GROQ_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY, OPENROUTER_API_KEY).
 *   - These are NEVER prefixed with `VITE_` and are NEVER imported by any
 *     client module. This file must only be imported from server functions
 *     (`*.server.ts`) or other server-only modules.
 *   - No key is ever returned from any function here.
 *
 * The Python `orchestra/` directory remains the canonical reference/spec and
 * is not modified by this TypeScript bridge.
 */

/** Roles mirrored from orchestra/router.py ROLE_MAP. */
export type OrchestraRole =
  | "orchestrator"
  | "coder"
  | "reviewer"
  | "researcher"
  | "verifier"
  | "summarizer"
  | "triage"
  | "guardian";

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
const GEMINI_OPENAI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Role → provider/model/key mapping. Kept in sync with
 * `orchestra/router.py` ROLE_MAP and `orchestra/config.yaml` model_list.
 * Only the providers actually configured in the project are used; no new
 * credentials are invented.
 */
const ROLE_PROVIDER: Record<OrchestraRole, ProviderSpec> = {
  orchestrator: {
    endpoint: GEMINI_OPENAI_ENDPOINT,
    model: "gemini-3-flash-preview",
    keyEnv: "GEMINI_API_KEY",
  },
  coder: {
    endpoint: GROQ_ENDPOINT,
    model: "llama-3.3-70b-versatile",
    keyEnv: "GROQ_API_KEY",
  },
  reviewer: {
    endpoint: OPENROUTER_ENDPOINT,
    model: "anthropic/claude-sonnet-4.6",
    keyEnv: "OPENROUTER_API_KEY",
  },
  researcher: {
    endpoint: GEMINI_OPENAI_ENDPOINT,
    model: "gemini-3.1-flash-lite",
    keyEnv: "GEMINI_API_KEY",
  },
  verifier: {
    endpoint: MISTRAL_ENDPOINT,
    model: "mistral-large-latest",
    keyEnv: "MISTRAL_API_KEY",
  },
  summarizer: {
    endpoint: GROQ_ENDPOINT,
    model: "qwen/qwen3.6-27b",
    keyEnv: "GROQ_API_KEY",
  },
  triage: {
    endpoint: MISTRAL_ENDPOINT,
    model: "mistral-small-latest",
    keyEnv: "MISTRAL_API_KEY",
  },
  guardian: {
    endpoint: OPENROUTER_ENDPOINT,
    model: "openai/gpt-5.2",
    keyEnv: "OPENROUTER_API_KEY",
  },
};

/** Per-role system prompts, mirrored from orchestra/router.py ROLE_PROMPTS. */
const ROLE_PROMPTS: Record<OrchestraRole, string> = {
  orchestrator:
    "You are the orchestrator. Decompose the task, assign sub-tasks to roles, and synthesize results.",
  coder: "You are a coder. Produce clean, minimal, correct code. No commentary unless asked.",
  reviewer: "You are a reviewer. Give brutally honest, actionable feedback. Flag risks.",
  researcher: "You are a researcher. Gather concise facts with sources. No filler.",
  verifier: "You are a verifier. Check claims against evidence. Pass/fail with reasons.",
  summarizer: "You are a summarizer. Compress to essentials. Bullet points.",
  triage: "You are triage. Classify and route. Output one role label only.",
  guardian: "You are the guardian. Block unsafe/illegal actions. If safe, say OK.",
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
