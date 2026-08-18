import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { normalizeSourceRows } from "../worker/normalize";
import {
  cleanCell,
  normalizeKickoff,
  parseDecimal,
  parseEdgePercentagePoints,
  parseIsoDate,
  parsePercentage
} from "../worker/parsers";
import { getCell, REQUIRED_SOURCE_WIDTH } from "../worker/source-columns";

const PREDICTION_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_1dSqKC6BUuykrL9QA5_fwiIEodU3jXBCskHCA7uVU-EYnHusQWZhMFwZXNvk2bFlElmsQHZ3b4n2/pub?gid=2036795967&single=true&output=csv";

const FIXTURE_COUNT_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRoeausAAqFFCFoB0NK4vjsgmmzxP_J-WtgvUdusuau-jmJ3d3fqPAAa_ujd7nGYag5rJFOysZZUYiA/pub?gid=56710734&single=true&output=csv";

function parseCsv(text: string): string[][] {
  const parsed = Papa.parse<string[]>(text, { delimiter: ",", skipEmptyLines: false });
  expect(parsed.errors, JSON.stringify(parsed.errors.slice(0, 5))).toHaveLength(0);
  return parsed.data;
}

function normalizeMatchSelection(value: unknown) {
  const raw = cleanCell(value).toLowerCase();
  if (raw === "home") return "Home";
  if (raw === "draw") return "Draw";
  if (raw === "away") return "Away";
  return null;
}

function normalizeOuSelection(value: unknown) {
  const raw = cleanCell(value).toLowerCase();
  if (raw === "over" || raw === "over 2.5" || raw === "over2.5") return "Over 2.5";
  if (raw === "under" || raw === "under 2.5" || raw === "under2.5") return "Under 2.5";
  return null;
}

async function fetchCsv(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/csv,text/plain;q=0.9,*/*;q=0.1",
      "User-Agent": "MC-Predict-V1-Real-Source-QA/1.0"
    }
  });
  expect(response.ok, `HTTP ${response.status} fetching ${url}`).toBe(true);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const text = await response.text();
  expect(contentType.includes("text/html")).toBe(false);
  expect(text.trimStart().toLowerCase().startsWith("<!doctype html")).toBe(false);
  return text;
}

const realQa = process.env.RUN_REAL_SOURCE_QA === "1" ? describe : describe.skip;

realQa("current published Google CSV sources", () => {
  it("parses and normalizes the live prediction source without structural corruption", async () => {
    const rows = parseCsv(await fetchCsv(PREDICTION_CSV_URL));
    const maxWidth = rows.reduce((max, row) => Math.max(max, row.length), 0);
    expect(maxWidth).toBeGreaterThanOrEqual(REQUIRED_SOURCE_WIDTH);

    const normalized = normalizeSourceRows(rows);
    expect(normalized.conflictingMarketIds).toEqual([]);
    if (normalized.hadDataLikeRows) {
      expect(normalized.validFixtureCount).toBeGreaterThan(0);
    }

    console.log("REAL_SOURCE_SUMMARY", {
      rows: rows.length,
      maxWidth,
      sourceRows: normalized.sourceRowCount,
      validFixtures: normalized.validFixtureCount,
      validMatchResult: normalized.validMatchResultCount,
      validOu: normalized.validOuCount,
      duplicates: normalized.duplicateCount,
      invalidRows: normalized.invalidRowCount,
      diagnostics: normalized.diagnostics.length
    });

    const auditPredictions = normalized.predictions.slice(0, 5);
    const rawByMarketId = new Map<string, string[]>();
    for (const row of rows) {
      const id = cleanCell(getCell(row, "marketId"));
      if (id && !rawByMarketId.has(id)) rawByMarketId.set(id, row);
    }

    for (const prediction of auditPredictions) {
      const raw = rawByMarketId.get(prediction.marketId);
      expect(raw, `Raw row missing for Market ID ${prediction.marketId}`).toBeTruthy();
      if (!raw) continue;

      expect(cleanCell(getCell(raw, "marketId"))).toBe(prediction.marketId);
      expect(parseIsoDate(getCell(raw, "fixtureDate"))).toBe(prediction.fixtureDate);
      expect(normalizeKickoff(getCell(raw, "kickoffTime"))).toBe(prediction.kickoffTime);
      expect(cleanCell(getCell(raw, "homeTeam"))).toBe(prediction.homeTeam);
      expect(cleanCell(getCell(raw, "awayTeam"))).toBe(prediction.awayTeam);
      expect(cleanCell(getCell(raw, "country")) || null).toBe(prediction.country);
      expect(cleanCell(getCell(raw, "league")) || null).toBe(prediction.league);

      if (prediction.matchValid) {
        expect(normalizeMatchSelection(getCell(raw, "matchPrediction"))).toBe(prediction.matchPrediction);
        expect(parsePercentage(getCell(raw, "matchModelHomeProbability"))).toBe(prediction.matchModelHomeProbability);
        expect(parsePercentage(getCell(raw, "matchModelDrawProbability"))).toBe(prediction.matchModelDrawProbability);
        expect(parsePercentage(getCell(raw, "matchModelAwayProbability"))).toBe(prediction.matchModelAwayProbability);
        expect(parsePercentage(getCell(raw, "matchBookmakerHomeProbability"))).toBe(prediction.matchBookmakerHomeProbability);
        expect(parsePercentage(getCell(raw, "matchBookmakerDrawProbability"))).toBe(prediction.matchBookmakerDrawProbability);
        expect(parsePercentage(getCell(raw, "matchBookmakerAwayProbability"))).toBe(prediction.matchBookmakerAwayProbability);
        expect(parseDecimal(getCell(raw, "matchBookmakerPrice"))).toBe(prediction.matchBookmakerPrice);
        expect(parseDecimal(getCell(raw, "matchModelPrice"))).toBe(prediction.matchModelPrice);
        expect(parseEdgePercentagePoints(getCell(raw, "matchEdge"))).toBe(prediction.matchEdge);
        expect(cleanCell(getCell(raw, "matchValueClassification"))).toBe(prediction.matchValueClassification);
      }

      if (prediction.ouValid) {
        expect(normalizeOuSelection(getCell(raw, "ouPrediction"))).toBe(prediction.ouPrediction);
        expect(parsePercentage(getCell(raw, "ouModelUnderProbability"))).toBe(prediction.ouModelUnderProbability);
        expect(parsePercentage(getCell(raw, "ouModelOverProbability"))).toBe(prediction.ouModelOverProbability);
        expect(parsePercentage(getCell(raw, "ouBookmakerOverProbability"))).toBe(prediction.ouBookmakerOverProbability);
        expect(parsePercentage(getCell(raw, "ouBookmakerUnderProbability"))).toBe(prediction.ouBookmakerUnderProbability);
        expect(parseDecimal(getCell(raw, "ouBookmakerPrice"))).toBe(prediction.ouBookmakerPrice);
        expect(parseDecimal(getCell(raw, "ouModelPrice"))).toBe(prediction.ouModelPrice);
        expect(parseEdgePercentagePoints(getCell(raw, "ouEdge"))).toBe(prediction.ouEdge);
        expect(cleanCell(getCell(raw, "ouValueClassification"))).toBe(prediction.ouValueClassification);
      }

      expect(parseDecimal(getCell(raw, "homeXGoals"))).toBe(prediction.homeXGoals);
      expect(parseDecimal(getCell(raw, "awayXGoals"))).toBe(prediction.awayXGoals);
      expect(parseDecimal(getCell(raw, "homeXShots"))).toBe(prediction.homeXShots);
      expect(parseDecimal(getCell(raw, "awayXShots"))).toBe(prediction.awayXShots);
      expect(parseDecimal(getCell(raw, "homeXShotsOnTarget"))).toBe(prediction.homeXShotsOnTarget);
      expect(parseDecimal(getCell(raw, "awayXShotsOnTarget"))).toBe(prediction.awayXShotsOnTarget);

      console.log("REAL_MARKET_ID_AUDIT", {
        marketId: prediction.marketId,
        date: prediction.fixtureDate,
        kickoff: prediction.kickoffTime,
        home: prediction.homeTeam,
        away: prediction.awayTeam,
        country: prediction.country,
        league: prediction.league,
        matchPrediction: prediction.matchPrediction,
        matchEdge: prediction.matchEdge,
        ouPrediction: prediction.ouPrediction,
        ouEdge: prediction.ouEdge
      });
    }
  }, 30_000);

  it("reads the live fixtures-processed value from F1", async () => {
    const rows = parseCsv(await fetchCsv(FIXTURE_COUNT_CSV_URL));
    const raw = cleanCell(rows[0]?.[5]);
    const value = Number(raw.replaceAll(",", ""));
    expect(raw).not.toBe("");
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    console.log("REAL_F1_AUDIT", { raw, fixturesProcessed: value });
  }, 30_000);
});
