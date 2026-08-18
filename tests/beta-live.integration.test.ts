import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { normalizeSourceRows } from "../worker/normalize";
import { cleanCell } from "../worker/parsers";

const BETA_ORIGIN = "https://beta.mcpredict.com";
const PREDICTION_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_1dSqKC6BUuykrL9QA5_fwiIEodU3jXBCskHCA7uVU-EYnHusQWZhMFwZXNvk2bFlElmsQHZ3b4n2/pub?gid=2036795967&single=true&output=csv";
const FIXTURE_COUNT_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRoeausAAqFFCFoB0NK4vjsgmmzxP_J-WtgvUdusuau-jmJ3d3fqPAAa_ujd7nGYag5rJFOysZZUYiA/pub?gid=56710734&single=true&output=csv";

interface ApiPrediction {
  marketId: string;
  fixture: {
    date: string;
    kickoff: string | null;
    country: string | null;
    league: string | null;
    homeTeam: string;
    awayTeam: string;
  };
  prediction: {
    selection: string | null;
    probability: number | null;
    modelPrice: number | null;
    bookmakerPrice: number | null;
    edge: number | null;
    classification: string | null;
  };
  probabilities: {
    model: Record<string, number | null>;
    bookmaker: Record<string, number | null>;
  };
  analysis: {
    homeXGoals: number | null;
    awayXGoals: number | null;
    homeXShots: number | null;
    awayXShots: number | null;
    homeXShotsOnTarget: number | null;
    awayXShotsOnTarget: number | null;
  };
}

interface PredictionResponse {
  data: ApiPrediction[];
  meta: { datasetId: string | null; updatedAt: string | null; count: number };
}

interface HomeResponse {
  fixturesProcessed: number | null;
  topMatchResult: ApiPrediction[];
  topOverUnder25: ApiPrediction[];
  activeDatasetTimestamp: string | null;
  hasPredictions: boolean;
}

function parseCsv(text: string): string[][] {
  const parsed = Papa.parse<string[]>(text, { delimiter: ",", skipEmptyLines: false });
  expect(parsed.errors, JSON.stringify(parsed.errors.slice(0, 5))).toHaveLength(0);
  return parsed.data;
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": "MC-Predict-V1-Beta-Live-QA/1.0" }
  });
  expect(response.ok, `HTTP ${response.status} fetching ${url}`).toBe(true);
  return await response.text();
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BETA_ORIGIN}${path}`, {
    headers: { Accept: "application/json", "User-Agent": "MC-Predict-V1-Beta-Live-QA/1.0" }
  });
  expect(response.ok, `HTTP ${response.status} fetching ${path}`).toBe(true);
  return await response.json() as T;
}

function selectedMatchProbability(prediction: ReturnType<typeof normalizeSourceRows>["predictions"][number]) {
  if (prediction.matchPrediction === "Home") return prediction.matchModelHomeProbability;
  if (prediction.matchPrediction === "Draw") return prediction.matchModelDrawProbability;
  if (prediction.matchPrediction === "Away") return prediction.matchModelAwayProbability;
  return null;
}

function selectedOuProbability(prediction: ReturnType<typeof normalizeSourceRows>["predictions"][number]) {
  if (prediction.ouPrediction === "Over 2.5") return prediction.ouModelOverProbability;
  if (prediction.ouPrediction === "Under 2.5") return prediction.ouModelUnderProbability;
  return null;
}

function expectNullableNumber(actual: number | null, expected: number | null) {
  if (expected === null) {
    expect(actual).toBeNull();
  } else {
    expect(actual).not.toBeNull();
    expect(actual as number).toBeCloseTo(expected, 10);
  }
}

function expectFixtureAndAnalysis(api: ApiPrediction, source: ReturnType<typeof normalizeSourceRows>["predictions"][number]) {
  expect(api.fixture).toEqual({
    date: source.fixtureDate,
    kickoff: source.kickoffTime,
    country: source.country,
    league: source.league,
    homeTeam: source.homeTeam,
    awayTeam: source.awayTeam
  });
  expectNullableNumber(api.analysis.homeXGoals, source.homeXGoals);
  expectNullableNumber(api.analysis.awayXGoals, source.awayXGoals);
  expectNullableNumber(api.analysis.homeXShots, source.homeXShots);
  expectNullableNumber(api.analysis.awayXShots, source.awayXShots);
  expectNullableNumber(api.analysis.homeXShotsOnTarget, source.homeXShotsOnTarget);
  expectNullableNumber(api.analysis.awayXShotsOnTarget, source.awayXShotsOnTarget);
}

function expectDescendingEdge(rows: ApiPrediction[]) {
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1].prediction.edge;
    const current = rows[index].prediction.edge;
    expect(previous).not.toBeNull();
    expect(current).not.toBeNull();
    expect(previous as number).toBeGreaterThanOrEqual(current as number);
  }
}

const liveQa = process.env.RUN_BETA_LIVE_QA === "1" ? describe : describe.skip;

liveQa("deployed beta source-to-API reconciliation", () => {
  it("serves a healthy active dataset and matches the published Google sources", async () => {
    const [predictionCsv, fixtureCountCsv, health, home, match, ou] = await Promise.all([
      fetchText(PREDICTION_CSV_URL),
      fetchText(FIXTURE_COUNT_CSV_URL),
      fetchJson<{ status: string; database: string; activeDataset: boolean }>("/api/v1/health"),
      fetchJson<HomeResponse>("/api/v1/home"),
      fetchJson<PredictionResponse>("/api/v1/predictions/match-result"),
      fetchJson<PredictionResponse>("/api/v1/predictions/over-under-25")
    ]);

    expect(health).toEqual({ status: "ok", database: "ok", activeDataset: true });

    const sourceRows = parseCsv(predictionCsv);
    const normalized = normalizeSourceRows(sourceRows);
    expect(normalized.conflictingMarketIds).toEqual([]);
    expect(normalized.validFixtureCount).toBeGreaterThan(0);

    const fixtureCountRows = parseCsv(fixtureCountCsv);
    const rawFixtureCount = cleanCell(fixtureCountRows[0]?.[5]);
    const fixturesProcessed = Number(rawFixtureCount.replaceAll(",", ""));
    expect(Number.isFinite(fixturesProcessed)).toBe(true);
    expect(home.fixturesProcessed).toBe(fixturesProcessed);

    expect(match.meta.datasetId).toBeTruthy();
    expect(ou.meta.datasetId).toBe(match.meta.datasetId);
    expect(match.meta.count).toBe(normalized.validMatchResultCount);
    expect(ou.meta.count).toBe(normalized.validOuCount);
    expect(match.data).toHaveLength(normalized.validMatchResultCount);
    expect(ou.data).toHaveLength(normalized.validOuCount);
    expect(home.hasPredictions).toBe(normalized.validMatchResultCount > 0 || normalized.validOuCount > 0);
    expect(home.activeDatasetTimestamp).toBeTruthy();

    expectDescendingEdge(match.data);
    expectDescendingEdge(ou.data);
    expect(home.topMatchResult.map((row) => row.marketId)).toEqual(match.data.slice(0, 3).map((row) => row.marketId));
    expect(home.topOverUnder25.map((row) => row.marketId)).toEqual(ou.data.slice(0, 3).map((row) => row.marketId));

    const matchById = new Map(match.data.map((row) => [row.marketId, row]));
    const ouById = new Map(ou.data.map((row) => [row.marketId, row]));

    const matchAudit = normalized.predictions.filter((row) => row.matchValid).slice(0, 5);
    expect(matchAudit.length).toBeGreaterThan(0);
    for (const source of matchAudit) {
      const api = matchById.get(source.marketId);
      expect(api, `Match Result Market ID ${source.marketId} missing from beta API`).toBeTruthy();
      if (!api) continue;
      expectFixtureAndAnalysis(api, source);
      expect(api.prediction.selection).toBe(source.matchPrediction);
      expectNullableNumber(api.prediction.probability, selectedMatchProbability(source));
      expectNullableNumber(api.prediction.modelPrice, source.matchModelPrice);
      expectNullableNumber(api.prediction.bookmakerPrice, source.matchBookmakerPrice);
      expectNullableNumber(api.prediction.edge, source.matchEdge);
      expect(api.prediction.classification).toBe(source.matchValueClassification);
      expectNullableNumber(api.probabilities.model.home ?? null, source.matchModelHomeProbability);
      expectNullableNumber(api.probabilities.model.draw ?? null, source.matchModelDrawProbability);
      expectNullableNumber(api.probabilities.model.away ?? null, source.matchModelAwayProbability);
      expectNullableNumber(api.probabilities.bookmaker.home ?? null, source.matchBookmakerHomeProbability);
      expectNullableNumber(api.probabilities.bookmaker.draw ?? null, source.matchBookmakerDrawProbability);
      expectNullableNumber(api.probabilities.bookmaker.away ?? null, source.matchBookmakerAwayProbability);
    }

    const ouAudit = normalized.predictions.filter((row) => row.ouValid).slice(0, 5);
    expect(ouAudit.length).toBeGreaterThan(0);
    for (const source of ouAudit) {
      const api = ouById.get(source.marketId);
      expect(api, `O/U Market ID ${source.marketId} missing from beta API`).toBeTruthy();
      if (!api) continue;
      expectFixtureAndAnalysis(api, source);
      expect(api.prediction.selection).toBe(source.ouPrediction);
      expectNullableNumber(api.prediction.probability, selectedOuProbability(source));
      expectNullableNumber(api.prediction.modelPrice, source.ouModelPrice);
      expectNullableNumber(api.prediction.bookmakerPrice, source.ouBookmakerPrice);
      expectNullableNumber(api.prediction.edge, source.ouEdge);
      expect(api.prediction.classification).toBe(source.ouValueClassification);
      expectNullableNumber(api.probabilities.model.over ?? null, source.ouModelOverProbability);
      expectNullableNumber(api.probabilities.model.under ?? null, source.ouModelUnderProbability);

      // Regression-critical mapping: source V = Bookmaker Over, W = Bookmaker Under.
      expectNullableNumber(api.probabilities.bookmaker.over ?? null, source.ouBookmakerOverProbability);
      expectNullableNumber(api.probabilities.bookmaker.under ?? null, source.ouBookmakerUnderProbability);
    }

    console.log("BETA_LIVE_RECONCILIATION", {
      datasetId: match.meta.datasetId,
      fixturesProcessed,
      validFixtures: normalized.validFixtureCount,
      matchCount: match.meta.count,
      ouCount: ou.meta.count,
      auditedMatchMarketIds: matchAudit.map((row) => row.marketId),
      auditedOuMarketIds: ouAudit.map((row) => row.marketId),
      topMatchResult: home.topMatchResult.map((row) => row.marketId),
      topOverUnder25: home.topOverUnder25.map((row) => row.marketId)
    });
  }, 60_000);
});
