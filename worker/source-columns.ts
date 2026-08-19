export const SOURCE_COLUMNS = {
  marketId: "J",
  fixtureDate: "O",
  kickoffTime: "P",
  homeTeam: "Q",
  awayTeam: "R",
  matchBookmakerHomeProbability: "S",
  matchBookmakerDrawProbability: "T",
  matchBookmakerAwayProbability: "U",
  ouBookmakerOverProbability: "V",
  ouBookmakerUnderProbability: "W",
  matchEdge: "AG",
  ouEdge: "AH",
  matchBookmakerPrice: "AI",
  matchModelPrice: "AK",
  ouBookmakerPrice: "AM",
  ouModelPrice: "AO",
  matchPrediction: "AQ",
  ouPrediction: "AR",
  matchModelHomeProbability: "AS",
  matchModelDrawProbability: "AT",
  matchModelAwayProbability: "AU",
  homeXGoals: "AV",
  awayXGoals: "AW",
  homeXShots: "AX",
  awayXShots: "AY",
  homeXShotsOnTarget: "AZ",
  awayXShotsOnTarget: "BA",
  matchValueClassification: "BD",
  ouValueClassification: "BG",
  country: "BH",
  league: "BI",
  ouModelUnderProbability: "BJ",
  ouModelOverProbability: "BK"
} as const;

export type SourceField = keyof typeof SOURCE_COLUMNS;

export const SOURCE_INDEXES: Record<SourceField, number> = {
  marketId: 9,
  fixtureDate: 14,
  kickoffTime: 15,
  homeTeam: 16,
  awayTeam: 17,
  matchBookmakerHomeProbability: 18,
  matchBookmakerDrawProbability: 19,
  matchBookmakerAwayProbability: 20,
  ouBookmakerOverProbability: 21,
  ouBookmakerUnderProbability: 22,
  matchEdge: 32,
  ouEdge: 33,
  matchBookmakerPrice: 34,
  matchModelPrice: 36,
  ouBookmakerPrice: 38,
  ouModelPrice: 40,
  matchPrediction: 42,
  ouPrediction: 43,
  matchModelHomeProbability: 44,
  matchModelDrawProbability: 45,
  matchModelAwayProbability: 46,
  homeXGoals: 47,
  awayXGoals: 48,
  homeXShots: 49,
  awayXShots: 50,
  homeXShotsOnTarget: 51,
  awayXShotsOnTarget: 52,
  matchValueClassification: 55,
  ouValueClassification: 58,
  country: 59,
  league: 60,
  ouModelUnderProbability: 61,
  ouModelOverProbability: 62
};

export const REQUIRED_SOURCE_WIDTH = 63;

export function getCell(row: string[], field: SourceField): string {
  return row[SOURCE_INDEXES[field]] ?? "";
}
