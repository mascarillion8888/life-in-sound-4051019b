import { describe, expect, it } from "vitest";
import {
  GothicArtError,
  gothicArtPrompt,
  isRetryableHfError,
  kindForStatus,
  type GothicArtErrorKind,
} from "./huggingFaceService";

describe("huggingFaceService prompt wrapper", () => {
  it("wraps the user prompt in the gothic woodcut template", () => {
    const wrapped = gothicArtPrompt({ prompt: "guitar under moonlight" });
    expect(wrapped.inputs).toContain("guitar under moonlight");
    expect(wrapped.inputs).toContain("dark gothic woodcut");
    expect(wrapped.inputs).toContain("chiaroscuro");
    expect(wrapped.inputs).toContain("etched ink");
  });

  it("defaults the negative prompt when none is provided", () => {
    const wrapped = gothicArtPrompt({ prompt: "stage lights" });
    expect(wrapped.parameters.negative_prompt).toContain("cartoon");
    expect(wrapped.parameters.num_inference_steps).toBe(30);
  });

  it("respects a custom negative prompt", () => {
    const wrapped = gothicArtPrompt({ prompt: "x", negativePrompt: "watermark" });
    expect(wrapped.parameters.negative_prompt).toBe("watermark");
  });
});

describe("huggingFaceService error classification", () => {
  const cases: Array<[number, GothicArtErrorKind]> = [
    [401, "auth"],
    [403, "auth"],
    [429, "rate-limit"],
    [500, "rate-limit"],
    [503, "rate-limit"],
    [400, "provider"],
    [404, "provider"],
    [418, "unknown"],
  ];
  it.each(cases)("maps HTTP %i to %s", (status, expected) => {
    expect(kindForStatus(status)).toBe(expected);
  });

  it("classifies a retryable rate-limit error", () => {
    const err = new GothicArtError("rate-limit", "too many");
    expect(isRetryableHfError(err)).toBe(true);
    expect(err.kind).toBe("rate-limit");
  });

  it("classifies a retryable network error", () => {
    const err = new GothicArtError("network", "down");
    expect(isRetryableHfError(err)).toBe(true);
  });

  it("treats auth/missing-token/provider errors as non-retryable", () => {
    expect(isRetryableHfError(new GothicArtError("auth", "denied"))).toBe(false);
    expect(isRetryableHfError(new GothicArtError("missing-token", "none"))).toBe(false);
    expect(isRetryableHfError(new GothicArtError("provider", "bad model"))).toBe(false);
  });

  it("returns false for arbitrary thrown errors", () => {
    expect(isRetryableHfError(new Error("boom"))).toBe(false);
    expect(isRetryableHfError("not an error")).toBe(false);
  });
});
