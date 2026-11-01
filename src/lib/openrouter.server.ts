/**
 * Server-only OpenRouter bridge — OpenAI-compatible chat completions with a
 * cheap fallback chain.
 *
 * Strategy: try `OPENROUTER_PRIMARY_MODEL` first; on HTTP 429 (rate limit) or
 * 5xx, retry ONCE with `OPENROUTER_FALLBACK_MODEL`. Other error classes
 * (400/401/… — client errors, auth, bad request) throw immediately without a
 * fallback attempt: they are not transient and would fail the same way on the
 * fallback model.
 *
 * SECURITY:
 *   - Key is read from `OPENROUTER_API_KEY` — a server-only env var, NEVER
 *     `VITE_`-prefixed. This file must only be imported from server functions
 *     (`*.server.ts`) or other server-only modules.
 *   - No key is ever returned or logged.
 */

type OpenRouterMessage = {
  role: "system" | "user";
  content: string;
};

type CallOpenRouterOptions = {
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider for an OpenAI-format JSON object response. */
  jsonMode?: boolean;
  signal?: AbortSignal;
  /** Optional fetch override (for tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
};

type AttemptResult = {
  status: number;
  text: string;
  model: string;
};

function getEnv(name: string): string | null {
  const value = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function parseContent(text: string): string | null {
  try {
    const payload = JSON.parse(text) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim().length > 0 ? content.trim() : null;
  } catch {
    return null;
  }
}

async function attempt(
  apiKey: string,
  baseUrl: string,
  model: string,
  messages: OpenRouterMessage[],
  options: CallOpenRouterOptions & { fetchImpl: typeof fetch },
): Promise<AttemptResult> {
  const response = await options.fetchImpl(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      // OpenRouter ranking/analytics: site adı + URL.
      "HTTP-Referer": "https://lifeinasound.app/",
      "X-Title": "Life in a Sound",
    },
    signal: options.signal,
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 2400,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  return { status: response.status, text: await response.text(), model };
}

/**
 * Call OpenRouter with the given messages. Returns the raw completion text on
 * success, `null` when no API key is configured. On transient provider errors
 * (429/5xx) retries once with the fallback model; on any other status throws.
 */
export async function callOpenRouter(
  messages: OpenRouterMessage[],
  options: CallOpenRouterOptions = {},
): Promise<string | null> {
  const apiKey = getEnv("OPENROUTER_API_KEY");
  if (!apiKey) return null;

  const baseUrl = getEnv("OPENROUTER_BASE_URL") ?? "https://openrouter.ai/api/v1";
  const primaryModel = getEnv("OPENROUTER_PRIMARY_MODEL") ?? "google/gemini-2.5-flash-lite";
  const fallbackModel = getEnv("OPENROUTER_FALLBACK_MODEL") ?? "openrouter/free";
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  const abortFromCaller = () => controller.abort();

  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    let result: AttemptResult;
    let usedModel = primaryModel;
    let didFallback = false;

    try {
      result = await attempt(apiKey, baseUrl, primaryModel, messages, {
        ...options,
        signal: controller.signal,
        fetchImpl,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new Error("OpenRouter request timed out or was cancelled");
      }

      // Retry one network failure with the fallback model.
      console.warn(
        `[openrouter] ${primaryModel} ağ hatası → fallback deneniyor: ${fallbackModel}`,
        "network failure",
      );
      result = await attempt(apiKey, baseUrl, fallbackModel, messages, {
        ...options,
        signal: controller.signal,
        fetchImpl,
      });
      usedModel = fallbackModel;
      didFallback = true;
    }

    if (result.status === 429 || result.status >= 500) {
      if (!didFallback) {
        console.warn(
          `[openrouter] ${primaryModel} → ${result.status} (rate limit / sunucu), fallback deneniyor: ${fallbackModel}`,
        );
        result = await attempt(apiKey, baseUrl, fallbackModel, messages, {
          ...options,
          signal: controller.signal,
          fetchImpl,
        });
        usedModel = fallbackModel;
        didFallback = true;
      }
    }

    if (!(result.status >= 200 && result.status < 300)) {
      if (result.status === 429 || result.status >= 500) {
        console.error(
          `[openrouter] hata model=${result.model} status=${result.status}`,
        );
        throw new Error(
          `OpenRouter ${result.model} başarısız: HTTP ${result.status} (fallback de başarısız)`,
        );
      }

      console.error(
        `[openrouter] istemci hatası model=${usedModel} status=${result.status}`,
      );
      throw new Error(`OpenRouter isteği reddedildi: HTTP ${result.status}`);
    }

    const content = parseContent(result.text);
    if (content === null) {
      console.error(`[openrouter] parse edilemeyen yanıt model=${usedModel}`);
      return null;
    }

    console.log(`[openrouter] OK model=${usedModel}${didFallback ? " (fallback)" : ""}`);
    return content;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
