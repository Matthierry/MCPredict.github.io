import { describe, expect, it } from "vitest";
import { normalizeSourceRows, selectedMatchProbability, selectedOuProbability } from "../worker/normalize";
import { SOURCE_INDEXES } from "../worker/source-columns";

function row(overrides: Partial<Record<keyof typeof SOURCE_INDEXES, string>> = {}) {
  const cells = Array.from({ length: 63 }, () => "");
  const values: Record<string, string> = {
    marketId: "001234567890", fixtureDate: "22/08/2026", kickoffTime: "15:00", homeTeam: "Arsenal", awayTeam: "Leeds",
    matchBookmakerHomeProbability: "1.72", matchBookmakerDrawProbability: "4.00", matchBookmakerAwayProbability: "4.76",
    ouBookmakerOverProbability: "1.62", ouBookmakerUnderProbability: "2.33", matchEdge: "10.3%", ouEdge: "10.2%",
    matchBookmakerPrice: "1.72", matchModelPrice: "1.56", ouBookmakerPrice: "1.62", ouModelPrice: "1.47",
    matchPrediction: "HOME WIN", ouPrediction: "Over", matchModelHomeProbability: "64%", matchModelDrawProbability: "22%",
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

  it("accepts live AQ HOME WIN and AWAY WIN labels", () => {
    const home = normalizeSourceRows([row({ matchPrediction: "HOME WIN" })]).predictions[0];
    const away = normalizeSourceRows([row({ matchPrediction: "AWAY WIN", matchModelHomeProbability: "20%", matchModelDrawProbability: "25%", matchModelAwayProbability: "55%" })]).predictions[0];
    expect(home.matchPrediction).toBe("Home");
    expect(home.matchValid).toBe(true);
    expect(away.matchPrediction).toBe("Away");
    expect(away.matchValid).toBe(true);
  });

  it("derives selected display probability from selected model price", () => {
    const prediction = normalizeSourceRows([row()]).predictions[0];
    expect(selectedMatchProbability(prediction)).toBeCloseTo(1 / 1.56);
    expect(selectedOuProbability(prediction)).toBeCloseTo(1 / 1.47);
  });

  it("maps bookmaker O/U Over from V and Under from W as decimal odds", () => {
    const prediction = normalizeSourceRows([row({ ouBookmakerOverProbability: "1.88", ouBookmakerUnderProbability: "1.84" })]).predictions[0];
    expect(prediction.ouBookmakerOverProbability).toBeCloseTo(1 / 1.88);
    expect(prediction.ouBookmakerUnderProbability).toBeCloseTo(1 / 1.84);
  });

  it("maps bookmaker 1X2 S/T/U decimal odds to implied probabilities", () => {
    const prediction = normalizeSourceRows([row({ matchBookmakerHomeProbability: "2.26", matchBookmakerDrawProbability: "3.39", matchBookmakerAwayProbability: "2.92" })]).predictions[0];
    expect(prediction.matchBookmakerHomeProbability).toBeCloseTo(1 / 2.26);
    expect(prediction.matchBookmakerDrawProbability).toBeCloseTo(1 / 3.39);
    expect(prediction.matchBookmakerAwayProbability).toBeCloseTo(1 / 2.92);
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

  it("keeps valid markets when an optional xMetric contains a spreadsheet error", () => {
    const result = normalizeSourceRows([row({ homeXGoals: "#REF!", awayXShotsOnTarget: "#N/A" })]);
    expect(result.predictions).toHaveLength(1);
    expect(result.predictions[0].matchValid).toBe(true);
    expect(result.predictions[0].ouValid).toBe(true);
    expect(result.predictions[0].homeXGoals).toBeNull();
    expect(result.predictions[0].awayXShotsOnTarget).toBeNull();
    expect(result.diagnostics.some((message) => message.includes("optional shared field error"))).toBe(true);
  });

  it("normalises optional fixture metadata spreadsheet errors to null", () => {
    const result = normalizeSourceRows([row({ kickoffTime: "#VALUE!", country: "#REF!", league: "#N/A" })]);
    expect(result.predictions).toHaveLength(1);
    expect(result.predictions[0].kickoffTime).toBeNull();
    expect(result.predictions[0].country).toBeNull();
    expect(result.predictions[0].league).toBeNull();
    expect(result.predictions[0].matchValid).toBe(true);
    expect(result.predictions[0].ouValid).toBe(true);
  });

  it("rejects a spreadsheet error in a critical shared fixture field", () => {
    const result = normalizeSourceRows([row({ homeTeam: "#REF!" })]);
    expect(result.predictions).toHaveLength(0);
    expect(result.invalidRowCount).toBe(1);
  });

  it("rejects an empty Market ID", () => {
    const result = normalizeSourceRows([row({ marketId: "" })]);
    expect(result.predictions).toHaveLength(0);
    expect(result.invalidRowCount).toBe(1);
  });
});
