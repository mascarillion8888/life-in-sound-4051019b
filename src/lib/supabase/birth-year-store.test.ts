import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { birthYearStore, useBirthYear } from "./birth-year-store";

describe("birthYearStore", () => {
  afterEach(() => act(() => birthYearStore.set(null)));

  it("starts empty and returns what was set", () => {
    expect(birthYearStore.get()).toBeNull();
    act(() => birthYearStore.set(1985));
    expect(birthYearStore.get()).toBe(1985);
  });

  it("re-renders subscribers when the year changes", () => {
    const { result } = renderHook(() => useBirthYear());
    expect(result.current).toBeNull();
    act(() => birthYearStore.set(1992));
    expect(result.current).toBe(1992);
    act(() => birthYearStore.set(null));
    expect(result.current).toBeNull();
  });
});
