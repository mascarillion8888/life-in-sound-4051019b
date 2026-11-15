import { describe, expect, it } from "vitest";

import { stageLabelForAge } from "./lifeStageLabel";

/**
 * The nine life periods' eight age bands. These cut-offs are the SINGLE source
 * of the period thresholds — `listenerPeriod.ts` derives from them — so the
 * boundary table below is the contract every other module relies on.
 */
describe("stageLabelForAge", () => {
  const boundaries: Array<[number, string]> = [
    [0, "Childhood"],
    [9, "Childhood"],
    [10, "Pre-teen"],
    [12, "Pre-teen"],
    [13, "Teen years"],
    [17, "Teen years"],
    [18, "Youth"],
    [22, "Youth"],
    [23, "Young adult"],
    [29, "Young adult"],
    [30, "Adulthood"],
    [39, "Adulthood"],
    [40, "Midlife"],
    [59, "Midlife"],
    [60, "Later life"],
    [100, "Later life"],
  ];

  it.each(boundaries)("labels age %i as %s", (age, expected) => {
    expect(stageLabelForAge(age)).toBe(expected);
  });

  it("labels a 20-year-old as Youth", () => {
    expect(stageLabelForAge(20)).toBe("Youth");
  });
});
