import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { normalizeSourceRows, selectedMatchProbability, selectedOuProbability } from "../worker/normalize";
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

type SourcePrediction = ReturnType<typeof normalizeSourceRows>["predictions"][number];

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

function expectedMatchDisplayProbabilities(source: SourcePrediction) {
  const raw = {
    home: source.matchModelHomeProbability,
    draw: source.matchModelDrawProbability,
    away: source.matchModelAwayProbability
  };
  const selected = selectedMatchProbability(source);

  if (
    !source.matchPrediction ||
    selected === null ||
    raw.home === null ||
    raw.draw === null ||
    raw.away === null
  ) {
    return raw;
  }

  const values = {
    home: raw.home,
    draw: raw.draw,
    away: raw.away
  };
  const selectedKey =
    source.matchPrediction === "Home" ? "home" : source.matchPrediction === "Draw" ? "draw" : "away";
  const otherKeys = (["home", "draw", "away"] as const).filter((key) => key !== selectedKey);
  const otherRawTotal = otherKeys.reduce((sum, key) => sum + values[key], 0);
  const remaining = Math.max(0, 1 - selected);

  if (otherRawTotal <= 0) {
    return {
      home: selectedKey === "home" ? selected : remaining / 2,
      draw: selectedKey === "draw" ? selected : remaining / 2,
      away: selectedKey === "away" ? selected : remaining / 2
    };
  }

  const scale = remaining / otherRawTotal;
  return {
    home: selectedKey === "home" ? selected : values.home * scale,
    draw: selectedKey === "draw" ? selected : values.draw * scale,
    away: selectedKey === "away" ? selected : values.away * scale
  };
}

function expectedOuDisplayProbabilities(source: SourcePrediction) {
  const selected = selectedOuProbability(source);
  if (!source.ouPrediction || selected === null) {
    return {
      over: source.ouModelOverProbability,
      under: source.ouModelUnderProbability
    };
  }
  return source.ouPrediction === "Over 2.5"
    ? { over: selected, under: 1 - selected }
    : { over: 1 - selected, under: selected };
}

function expectNullableNumber(actual: number | null, expected: number | null) {
  if (expected === null) {
    expect(actual).toBeNull();
  } else {
    expect(actual).not.toBeNull();
    expect(actual as number).toBeCloseTo(expected, 10);
  }
}

function expectFixtureAndAnalysis(api: ApiPrediction, source: SourcePrediction) {
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
    expect(normalized.validMatchResultCount).toBeGreaterThan(0);

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

      const expectedModel = expectedMatchDisplayProbabilities(source);
      expectNullableNumber(api.probabilities.model.home ?? null, expectedModel.home);
      expectNullableNumber(api.probabilities.model.draw ?? null, expectedModel.draw);
      expectNullableNumber(api.probabilities.model.away ?? null, expectedModel.away);
      expectNullableNumber(api.probabilities.bookmaker.home ?? null, source.matchBookmakerHomeProbability);
      expectNullableNumber(api.probabilities.bookmaker.draw ?? null, source.matchBookmakerDrawProbability);
      expectNullableNumber(api.probabilities.bookmaker.away ?? null, source.matchBookmakerAwayProbability);
    }

    const ouAudit = normalized.predictions.filter((row) => row.ouValid).slice(0, 5);
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

      const expectedModel = expectedOuDisplayProbabilities(source);
      expectNullableNumber(api.probabilities.model.over ?? null, expectedModel.over);
      expectNullableNumber(api.probabilities.model.under ?? null, expectedModel.under);

      // Regression-critical mapping: source V = Bookmaker Over, W = Bookmaker Under.
      expectNullableNumber(api.probabilities.bookmaker.over ?? null, source.ouBookmakerOverProbability);
      expectNullableNumber(api.probabilities.bookmaker.under ?? null, source.ouBookmakerUnderProbability);
    }

    const norwich = ouById.get("E1NorwichE1West Brom46249");
    expect(norwich, "Norwich v West Brom missing from deployed O/U beta API").toBeTruthy();
    if (norwich) {
      expect(norwich.prediction.selection).toBe("Under 2.5");
      expect(norwich.prediction.modelPrice).toBeCloseTo(1.42, 10);
      expect(norwich.prediction.bookmakerPrice).toBeCloseTo(1.84, 10);
      expect(norwich.prediction.probability).toBeCloseTo(1 / 1.42, 10);
      expect(norwich.probabilities.model.under).toBeCloseTo(1 / 1.42, 10);
      expect(norwich.probabilities.model.over).toBeCloseTo(1 - (1 / 1.42), 10);
      expect(norwich.probabilities.bookmaker.over).toBeCloseTo(1 / 1.88, 10);
      expect(norwich.probabilities.bookmaker.under).toBeCloseTo(1 / 1.84, 10);
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
      topOverUnder25: home.topOverUnder25.map((row) => row.marketId),
      norwich: norwich ? {
        modelPrice: norwich.prediction.modelPrice,
        selectedProbability: norwich.prediction.probability,
        bookmakerPrice: norwich.prediction.bookmakerPrice,
        bookmakerOver: norwich.probabilities.bookmaker.over,
        bookmakerUnder: norwich.probabilities.bookmaker.under
      } : null
    });
  }, 60_000);
});
