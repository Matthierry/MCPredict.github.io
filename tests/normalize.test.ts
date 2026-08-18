import { describe, expect, it } from "vitest";
import { normalizeSourceRows, selectedMatchProbability, selectedOuProbability } from "../worker/normalize";
import { SOURCE_INDEXES } from "../worker/source-columns";

function row(overrides: Partial<Record<keyof typeof SOURCE_INDEXES, string>> = {}) {
  const cells = Array.from({ length: 63 }, () => "");
  const values: Record<string, string> = {
    marketId: "001234567890", fixtureDate: "22/08/2026", kickoffTime: "15:00", homeTeam: "Arsenal", awayTeam: "Leeds",
    matchBookmakerHomeProbability: "58%", matchBookmakerDrawProbability: "25%", matchBookmakerAwayProbability: "21%",
    ouBookmakerOverProbability: "64%", ouBookmakerUnderProbability: "43%", matchEdge: "10.3%", ouEdge: "10.2%",
    matchBookmakerPrice: "1.72", matchModelPrice: "1.56", ouBookmakerPrice: "1.62", ouModelPrice: "1.47",
    matchPrediction: "Home", ouPrediction: "Over", matchModelHomeProbability: "64%", matchModelDrawProbability: "22%",
    matchModelAwayProbability: "14%", homeXGoals: "1.91", awayXGoals: "0.86", homeXShots: "15.4", awayXShots: "8.8",
    homeXShotsOnTarget: "5.7", awayXShotsOnTarget: "2.9", matchValueClassification: "High Value",
    ouValueClassification: "High Value", country: "England", league: "Premier League", ouModelUnderProbability: "32%", ouModelOverProbability: "68%",
    ...overrides
  };
  Object.entries(values).forEach(([field, value]) => { cells[SOURCE_INDEXES[field as keyof typeof SOURCE_INDEXES]] = value; });
  return cells;
}

describe("normalization", () => {
  it("preserves Market ID as trimmed text including leading zeroes", () => {
    const result = normalizeSourceRows([row({ marketId: " 001234567890 " })]);
    expect(result.predictions[0].marketId).toBe("001234567890");
  });

  it("uses the selected AQ/AR probability", () => {
    const prediction = normalizeSourceRows([row()]).predictions[0];
    expect(selectedMatchProbability(prediction)).toBeCloseTo(0.64);
    expect(selectedOuProbability(prediction)).toBeCloseTo(0.68);
  });

  it("maps bookmaker O/U Over from V and Under from W", () => {
    const prediction = normalizeSourceRows([row({ ouBookmakerOverProbability: "61%", ouBookmakerUnderProbability: "44%" })]).predictions[0];
    expect(prediction.ouBookmakerOverProbability).toBeCloseTo(0.61);
    expect(prediction.ouBookmakerUnderProbability).toBeCloseTo(0.44);
  });

  it("deduplicates semantically identical Market IDs", () => {
    const result = normalizeSourceRows([row(), row()]);
    expect(result.predictions).toHaveLength(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.conflictingMarketIds).toEqual([]);
  });

  it("rejects conflicting duplicate Market IDs", () => {
    const result = normalizeSourceRows([row(), row({ awayTeam: "Chelsea" })]);
    expect(result.predictions).toHaveLength(0);
    expect(result.conflictingMarketIds).toEqual(["001234567890"]);
  });

  it("keeps a valid Match Result when O/U is invalid", () => {
    const prediction = normalizeSourceRows([row({ ouPrediction: "#REF!" })]).predictions[0];
    expect(prediction.matchValid).toBe(true);
    expect(prediction.ouValid).toBe(false);
  });

  it("rejects an empty Market ID", () => {
    const result = normalizeSourceRows([row({ marketId: "" })]);
    expect(result.predictions).toHaveLength(0);
    expect(result.invalidRowCount).toBe(1);
  });
});
