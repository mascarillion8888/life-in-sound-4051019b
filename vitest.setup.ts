import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

// globals: false — extend expect explicitly rather than relying on globals.
expect.extend(matchers);

// Ensure each test starts with a clean DOM (auto-cleanup is opt-in without globals).
afterEach(() => {
  cleanup();
});
