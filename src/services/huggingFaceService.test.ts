import { describe, expect, it } from "vitest";
import { gothicArtPrompt } from "./huggingFaceService";

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
