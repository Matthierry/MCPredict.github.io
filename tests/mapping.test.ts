import { describe, expect, it } from "vitest";
import { SOURCE_COLUMNS, SOURCE_INDEXES } from "../worker/source-columns";

describe("authoritative source mapping", () => {
  it("matches every definitive spreadsheet column", () => {
    expect(SOURCE_COLUMNS).toEqual({
      marketId: "J", fixtureDate: "O", kickoffTime: "P", homeTeam: "Q", awayTeam: "R",
      matchBookmakerHomeProbability: "S", matchBookmakerDrawProbability: "T", matchBookmakerAwayProbability: "U",
      ouBookmakerOverProbability: "V", ouBookmakerUnderProbability: "W", matchEdge: "AG", ouEdge: "AH",
      matchBookmakerPrice: "AI", matchModelPrice: "AK", ouBookmakerPrice: "AM", ouModelPrice: "AO",
      matchPrediction: "AQ", ouPrediction: "AR", matchModelHomeProbability: "AS", matchModelDrawProbability: "AT",
      matchModelAwayProbability: "AU", homeXGoals: "AV", awayXGoals: "AW", homeXShots: "AX", awayXShots: "AY",
      homeXShotsOnTarget: "AZ", awayXShotsOnTarget: "BA", matchValueClassification: "BD",
      ouValueClassification: "BG", country: "BH", league: "BI", ouModelUnderProbability: "BJ", ouModelOverProbability: "BK"
    });
  });

  it("uses the correct zero-based indexes including V/W regression protection", () => {
    expect(SOURCE_INDEXES.marketId).toBe(9);
    expect(SOURCE_INDEXES.fixtureDate).toBe(14);
    expect(SOURCE_INDEXES.matchBookmakerHomeProbability).toBe(18);
    expect(SOURCE_INDEXES.matchBookmakerDrawProbability).toBe(19);
    expect(SOURCE_INDEXES.matchBookmakerAwayProbability).toBe(20);
    expect(SOURCE_INDEXES.ouBookmakerOverProbability).toBe(21);
    expect(SOURCE_INDEXES.ouBookmakerUnderProbability).toBe(22);
    expect(SOURCE_INDEXES.ouBookmakerUnderProbability).not.toBe(SOURCE_INDEXES.ouBookmakerOverProbability);
    expect(SOURCE_INDEXES.matchPrediction).toBe(42);
    expect(SOURCE_INDEXES.ouPrediction).toBe(43);
    expect(SOURCE_INDEXES.ouModelUnderProbability).toBe(61);
    expect(SOURCE_INDEXES.ouModelOverProbability).toBe(62);
  });
});
