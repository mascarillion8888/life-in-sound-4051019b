import { beforeEach, describe, expect, it, vi } from "vitest";

import { __hfImageModelForTest, generateHfImage } from "./hfImage.server";

/** Successful router response: raw PNG bytes with an image content-type. */
function hfOk(bytes = new Uint8Array([137, 80, 78, 71])) {
  return new Response(bytes.buffer as ArrayBuffer, {
    status: 200,
    headers: { "content-type": "image/png" },
  });
}

describe("generateHfImage", () => {
  beforeEach(() => {
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.HF_IMAGE_MODEL;
  });

  it("returns null without an API key — no call, no fabrication", async () => {
    const fetchImpl = vi.fn();
    const image = await generateHfImage("a candlelit room", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(image).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts to the HF router with the gothic woodcut style anchor", async () => {
    process.env.HUGGINGFACE_API_KEY = "hf-test-key";
    const fetchImpl = vi.fn().mockResolvedValue(hfOk());
    const image = await generateHfImage("a candlelit room", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(image).toMatch(/^data:image\/png;base64,/);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-3-medium-diffusers",
    );
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer hf-test-key");
    const body = JSON.parse(String(init.body)) as { inputs: string };
    expect(body.inputs).toContain("a candlelit room");
    expect(body.inputs).toContain("gothic woodcut");
  });

  it("honours HF_IMAGE_MODEL override", async () => {
    process.env.HUGGINGFACE_API_KEY = "hf-test-key";
    process.env.HF_IMAGE_MODEL = "black-forest-labs/FLUX.1-schnell";
    expect(__hfImageModelForTest()).toBe("black-forest-labs/FLUX.1-schnell");
    const fetchImpl = vi.fn().mockResolvedValue(hfOk());
    await generateHfImage("x", { fetchImpl: fetchImpl as unknown as typeof fetch });
    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).toContain("/models/black-forest-labs/FLUX.1-schnell");
  });

  it("returns null on non-OK status (including 503 model-loading)", async () => {
    process.env.HUGGINGFACE_API_KEY = "hf-test-key";
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: "Model is loading" }), { status: 503 }),
      );
    const image = await generateHfImage("x", { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(image).toBeNull();
  });

  it("returns null when a proxy answers JSON with a 200", async () => {
    process.env.HUGGINGFACE_API_KEY = "hf-test-key";
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "unexpected" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const image = await generateHfImage("x", { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(image).toBeNull();
  });

  it("returns null on network failure — never throws", async () => {
    process.env.HUGGINGFACE_API_KEY = "hf-test-key";
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const image = await generateHfImage("x", { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(image).toBeNull();
  });

  it("returns null on empty image bytes", async () => {
    process.env.HUGGINGFACE_API_KEY = "hf-test-key";
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(new ArrayBuffer(0), {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    const image = await generateHfImage("x", { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(image).toBeNull();
  });
});
