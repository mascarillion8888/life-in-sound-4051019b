/**
 * Preview audio proxy — server side.
 *
 * Browsers cannot read the bytes of provider preview clips (iTunes/Spotify
 * send no CORS headers), and wiring such an <audio> element into Web Audio
 * silences it. So the SERVER fetches the clip once and the client analyses a
 * decoded copy offline (see previewSpectrum.ts) while the real <audio> element
 * keeps playing untouched. Failures never throw: the card then falls back to
 * its generic equalizer animation.
 *
 * SECURITY: this is a fetch proxy, so it only talks to an allow-list of
 * preview CDNs over https, never follows redirects, and caps the body size.
 */
import { createServerFn } from "@tanstack/react-start";

const ALLOWED_HOST_SUFFIXES = [".mzstatic.com", ".itunes.apple.com", ".scdn.co"];
const MAX_BYTES = 4 * 1024 * 1024;

export type PreviewAudioResult = { ok: boolean; base64?: string };

export function isAllowedPreviewUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some((s) => host.endsWith(s));
  } catch {
    return false;
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export async function fetchPreviewAudioCore(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PreviewAudioResult> {
  if (!isAllowedPreviewUrl(url)) return { ok: false };
  try {
    const res = await fetchImpl(url, { redirect: "manual" });
    if (!res.ok) return { ok: false };
    const type = res.headers.get("content-type") ?? "";
    if (type && !type.startsWith("audio/") && !type.includes("octet-stream")) {
      return { ok: false };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) return { ok: false };
    return { ok: true, base64: toBase64(buf) };
  } catch {
    return { ok: false };
  }
}

export const fetchPreviewAudio = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => ({
    url: String(input?.url ?? "").slice(0, 500),
  }))
  .handler(async ({ data }): Promise<PreviewAudioResult> => fetchPreviewAudioCore(data.url));
