import { describe, expect, it } from "vitest";

import { devOnlyGuard } from "./devGuard";

describe("devOnlyGuard — production gate", () => {
  it("throws not-found when DEV is false (never ships to users)", () => {
    expect(() => devOnlyGuard(false)).toThrow();
  });

  it("does not throw when DEV is true", () => {
    expect(() => devOnlyGuard(true)).not.toThrow();
  });

  it("the thrown value is a router not-found", () => {
    let thrown: unknown;
    try {
      devOnlyGuard(false);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeDefined();
    expect((thrown as { isNotFound?: boolean }).isNotFound).toBe(true);
  });
});
