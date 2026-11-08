import { describe, expect, it } from "vitest";

import { stageLabelForAge } from "./lifeStageLabel";

describe("stageLabelForAge", () => {
  it("labels a 20-year-old as Youth", () => {
    expect(stageLabelForAge(20)).toBe("Youth");
  });

  it("keeps the original thresholds", () => {
    expect(stageLabelForAge(5)).toBe("Childhood");
    expect(stageLabelForAge(12)).toBe("Childhood");
    expect(stageLabelForAge(13)).toBe("Teen years");
    expect(stageLabelForAge(17)).toBe("Teen years");
    expect(stageLabelForAge(18)).toBe("Youth");
    expect(stageLabelForAge(24)).toBe("Youth");
    expect(stageLabelForAge(25)).toBe("Young adult");
    expect(stageLabelForAge(39)).toBe("Young adult");
    expect(stageLabelForAge(40)).toBe("Adulthood");
    expect(stageLabelForAge(59)).toBe("Adulthood");
    expect(stageLabelForAge(60)).toBe("Later life");
  });
});
