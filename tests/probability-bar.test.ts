import { describe, expect, it } from "vitest";
import { normalizeSegments } from "../src/components/ProbabilityBar";

describe("probability bar geometry", () => {
  it("normalises bookmaker 1X2 raw implied probabilities to exactly 1", () => {
    const result = normalizeSegments([
      { key: "home", label: "Home", value: .58 }, { key: "draw", label: "Draw", value: .25 }, { key: "away", label: "Away", value: .21 }
    ]);
    expect(result.reduce((sum, item) => sum + item.width, 0)).toBeCloseTo(1);
  });

  it("normalises O/U and preserves separate Over/Under values", () => {
    const result = normalizeSegments([
      { key: "over", label: "Over", value: .64 }, { key: "under", label: "Under", value: .43 }
    ]);
    expect(result[0].width).not.toBe(result[1].width);
    expect(result.reduce((sum, item) => sum + item.width, 0)).toBeCloseTo(1);
  });
});
