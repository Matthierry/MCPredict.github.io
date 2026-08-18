export type Mode = "value" | "probability";

export interface Fixture {
  date: string;
  kickoff: string | null;
  country: string | null;
  league: string | null;
  homeTeam: string;
  awayTeam: string;
}

export interface Analysis {
  homeXGoals: number | null;
  awayXGoals: number | null;
  homeXShots: number | null;
  awayXShots: number | null;
  homeXShotsOnTarget: number | null;
  awayXShotsOnTarget: number | null;
}

export interface MatchPrediction {
  marketId: string;
  fixture: Fixture;
  prediction: {
    selection: "Home" | "Draw" | "Away";
    probability: number;
    modelPrice: number;
    bookmakerPrice: number;
    edge: number;
    classification: string;
  };
  probabilities: {
    model: { home: number; draw: number; away: number };
    bookmaker: { home: number; draw: number; away: number };
  };
  analysis: Analysis;
}

export interface OuPrediction {
  marketId: string;
  fixture: Fixture;
  prediction: {
    selection: "Over 2.5" | "Under 2.5";
    probability: number;
    modelPrice: number;
    bookmakerPrice: number;
    edge: number;
    classification: string;
  };
  probabilities: {
    model: { over: number; under: number };
    bookmaker: { over: number; under: number };
  };
  analysis: Analysis;
}

export interface PredictionResponse<T> {
  data: T[];
  meta: {
    datasetId: string | null;
    updatedAt: string | null;
    count: number;
  };
}

export interface HomeResponse {
  fixturesProcessed: number | null;
  topMatchResult: MatchPrediction[];
  topOverUnder25: OuPrediction[];
  activeDatasetTimestamp: string | null;
  hasPredictions: boolean;
}
