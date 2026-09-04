import { describe, expect, it } from "vitest";
import {
  fixtureAnalysisPath,
  fixtureApiPath,
  fixtureSlug,
  parseFixtureAnalysisPath
} from "../shared/fixture-routes";
import type { MatchPrediction } from "../src/types";

const prediction = {
  marketId: "E1 Arsenal/Leeds 123",
  fixture: {
    date: "2026-09-06",
    kickoff: "15:00",
    country: "England",
    league: "Premier League",
    homeTeam: "Arsenal",
    awayTeam: "Leeds United"
  },
  prediction: {
    selection: "Home",
    probability: 0.6,
    modelPrice: 1.67,
    bookmakerPrice: 1.8,
    edge: 7.8,
    classification: "Some Value"
  },
  probabilities: {
    model: { home: 0.6, draw: 0.23, away: 0.17 },
    bookmaker: { home: 0.56, draw: 0.27, away: 0.22 }
  },
  analysis: {
    homeXGoals: 1.8,
    awayXGoals: 0.9,
    homeXShots: 14,
    awayXShots: 9,
    homeXShotsOnTarget: 5,
    awayXShotsOnTarget: 3
  }
} satisfies MatchPrediction;

describe("fixture analysis routes", () => {
  it("builds a readable path while safely encoding the authoritative Market ID", () => {
    expect(fixtureSlug(prediction)).toBe("arsenal-v-leeds-united-2026-09-06");
    expect(fixtureAnalysisPath("match", prediction)).toBe(
      "/match-result/E1%20Arsenal%2FLeeds%20123/arsenal-v-leeds-united-2026-09-06"
    );
    expect(fixtureApiPath("match", prediction.marketId)).toBe(
      "/api/v1/predictions/match-result/E1%20Arsenal%2FLeeds%20123"
    );
    expect(parseFixtureAnalysisPath(fixtureAnalysisPath("match", prediction))).toEqual({
      market: "match",
      marketId: prediction.marketId
    });
  });
});
