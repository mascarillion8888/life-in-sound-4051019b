import { describe, expect, it } from "vitest";

import { fetchPreviewAudioCore, isAllowedPreviewUrl } from "./previewAudio.server";

describe("preview audio proxy", () => {
  it("only allows https preview CDNs", () => {
    expect(isAllowedPreviewUrl("https://audio-ssl.itunes.apple.com/a/b.m4a")).toBe(true);
    expect(isAllowedPreviewUrl("https://audio-ssl.itunes.apple.com.evil.com/a.m4a")).toBe(false);
    expect(isAllowedPreviewUrl("http://audio-ssl.itunes.apple.com/a.m4a")).toBe(false);
    expect(isAllowedPreviewUrl("https://169.254.169.254/latest")).toBe(false);
    expect(isAllowedPreviewUrl("not a url")).toBe(false);
  });

  it("returns base64 for an allowed clip and never throws", async () => {
    const ok = (async () =>
      new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mp4" } })) as typeof fetch;
    expect(await fetchPreviewAudioCore("https://x.mzstatic.com/a.m4a", ok)).toEqual({ ok: true, base64: "AQID" });
    const boom = (async () => { throw new Error("net"); }) as typeof fetch;
    expect(await fetchPreviewAudioCore("https://x.mzstatic.com/a.m4a", boom)).toEqual({ ok: false });
    expect(await fetchPreviewAudioCore("https://evil.com/a.m4a", ok)).toEqual({ ok: false });
  });
});
