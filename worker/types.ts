export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  SYNC_TOKEN?: string;
  ENVIRONMENT?: string;
}

export type MatchSelection = "Home" | "Draw" | "Away";
export type OuSelection = "Over 2.5" | "Under 2.5";

export interface NormalizedPrediction {
  marketId: string;
  fixtureDate: string;
  kickoffTime: string | null;
  country: string | null;
  league: string | null;
  homeTeam: string;
  awayTeam: string;

  matchPrediction: MatchSelection | null;
  matchModelHomeProbability: number | null;
  matchModelDrawProbability: number | null;
  matchModelAwayProbability: number | null;
  matchModelPrice: number | null;
  matchBookmakerHomeProbability: number | null;
  matchBookmakerDrawProbability: number | null;
  matchBookmakerAwayProbability: number | null;
  matchBookmakerPrice: number | null;
  matchEdge: number | null;
  matchValueClassification: string | null;
  matchValid: boolean;

  ouPrediction: OuSelection | null;
  ouModelOverProbability: number | null;
  ouModelUnderProbability: number | null;
  ouModelPrice: number | null;
  ouBookmakerOverProbability: number | null;
  ouBookmakerUnderProbability: number | null;
  ouBookmakerPrice: number | null;
  ouEdge: number | null;
  ouValueClassification: string | null;
  ouValid: boolean;

  homeXGoals: number | null;
  awayXGoals: number | null;
  homeXShots: number | null;
  awayXShots: number | null;
  homeXShotsOnTarget: number | null;
  awayXShotsOnTarget: number | null;

  fixtureFingerprint: string;
}

export interface NormalizationResult {
  predictions: NormalizedPrediction[];
  sourceRowCount: number;
  validFixtureCount: number;
  validMatchResultCount: number;
  validOuCount: number;
  duplicateCount: number;
  invalidRowCount: number;
  diagnostics: string[];
  conflictingMarketIds: string[];
  hadDataLikeRows: boolean;
}

export type SyncResult =
  | "success_changed"
  | "success_no_change"
  | "success_empty"
  | "failed_fetch"
  | "failed_parse"
  | "failed_validation"
  | "failed_database";

export interface ActiveDataset {
  id: string;
  source_hash: string;
  source_fetched_at: string;
  activated_at: string | null;
  valid_fixture_count: number;
  valid_match_result_count: number;
  valid_ou_count: number;
}
