import Papa from "papaparse";
import {
  activateDataset,
  createDataset,
  createSyncRun,
  finishSyncRun,
  getActiveDataset,
  getState,
  insertPredictions,
  markDatasetFailed,
  pruneOperationalDatasets,
  replaceTeamColours,
  setState,
  upsertFixtureCount,
  verifyDatasetCount
} from "./db";
import { canonicalDatasetHash, normalizeSourceRows } from "./normalize";
import { parseFixtureCount } from "./parsers";
import { REQUIRED_SOURCE_WIDTH } from "./source-columns";
import { parseTeamColourRows, TEAM_COLOUR_CSV_URL } from "./team-colours";
import type { Env, SyncResult } from "./types";

const PREDICTION_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_1dSqKC6BUuykrL9QA5_fwiIEodU3jXBCskHCA7uVU-EYnHusQWZhMFwZXNvk2bFlElmsQHZ3b4n2/pub?gid=2036795967&single=true&output=csv";

const FIXTURE_COUNT_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRoeausAAqFFCFoB0NK4vjsgmmzxP_J-WtgvUdusuau-jmJ3d3fqPAAa_ujd7nGYag5rJFOysZZUYiA/pub?gid=56710734&single=true&output=csv";

interface CsvFetchResult {
  status: number;
  text: string;
}

async function fetchCsv(url: string): Promise<CsvFetchResult> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/csv,text/plain;q=0.9,*/*;q=0.1",
      "User-Agent": "MC-Predict-V1-Ingestion/1.0"
    }
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Source returned HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const trimmed = text.trimStart().toLowerCase();
  if (contentType.includes("text/html") || trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html")) {
    throw new Error("Source returned HTML instead of CSV.");
  }

  return { status: response.status, text };
}

function parseCsv(text: string): string[][] {
  const parsed = Papa.parse<string[]>(text, {
    delimiter: ",",
    skipEmptyLines: false
  });

  if (parsed.errors.length) {
    const summary = parsed.errors
      .slice(0, 5)
      .map((error) => `${error.code}${error.row !== undefined ? ` row ${error.row}` : ""}`)
      .join(", ");
    throw new Error(`CSV parse failed: ${summary}`);
  }

  return parsed.data;
}

async function hashText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function syncFixtureCount(env: Env): Promise<string> {
  try {
    const source = await fetchCsv(FIXTURE_COUNT_CSV_URL);
    const rows = parseCsv(source.text);
    const value = parseFixtureCount(rows[0]?.[5]);
    if (value === null) throw new Error("F1 is missing or invalid.");
    await upsertFixtureCount(env.DB, value, await hashText(String(value)));
    console.log("MC Predict stats sync", { result: "success", fixturesProcessed: value });
    return "success";
  } catch (error) {
    console.error("MC Predict stats sync failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    return "failed";
  }
}

async function syncTeamColours(env: Env): Promise<string> {
  try {
    const source = await fetchCsv(TEAM_COLOUR_CSV_URL);
    const parsed = parseTeamColourRows(parseCsv(source.text));

    if (parsed.conflictingTeamKeys.length) {
      throw new Error(
        `Conflicting team colour rows: ${parsed.conflictingTeamKeys.slice(0, 10).join(", ")}`
      );
    }
    if (!parsed.records.length) {
      throw new Error("Team colour source contains no valid colour rows.");
    }

    const canonical = parsed.records
      .map((record) => [record.teamKey, record.teamName, record.primaryColour, record.secondaryColour].join("|"))
      .join("\n");
    const sourceHash = await hashText(canonical);
    const activeHash = await getState(env.DB, "team_colour_source_hash");

    if (activeHash !== sourceHash) {
      await replaceTeamColours(env.DB, parsed.records, sourceHash);
    } else {
      await setState(env.DB, "last_successful_team_colour_sync", new Date().toISOString());
    }

    await setState(env.DB, "last_team_colour_sync_result", "success");
    console.log("MC Predict team colour sync", {
      result: activeHash === sourceHash ? "success_no_change" : "success_changed",
      colours: parsed.records.length,
      invalidRows: parsed.invalidRows
    });
    return "success";
  } catch (error) {
    try {
      await setState(env.DB, "last_team_colour_sync_result", "failed");
    } catch {
      // The colour layer is cosmetic; database/state errors must not replace a good prediction dataset.
    }
    console.error("MC Predict team colour sync failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    return "failed";
  }
}

export async function runIngestion(
  env: Env,
  source: "scheduled" | "manual",
  expectedUkScheduleHour: number | null
): Promise<{ result: SyncResult; datasetId: string | null }> {
  const runId = crypto.randomUUID();
  await createSyncRun(env.DB, runId, expectedUkScheduleHour);

  console.log("MC Predict ingestion started", {
    runId,
    source,
    expectedUkScheduleHour,
    environment: env.ENVIRONMENT ?? "unknown"
  });

  let predictionStatus: number | null = null;
  let statResult = "not_run";
  let teamColourResult = "not_run";
  let finalResult: SyncResult = "failed_fetch";
  let activatedDatasetId: string | null = null;
  let sourceHash: string | null = null;
  let sourceRowCount = 0;
  let validMatchResultCount = 0;
  let validOuCount = 0;
  let duplicateCount = 0;
  let invalidRowCount = 0;
  let errorSummary: string | null = null;

  try {
    const predictionSource = await fetchCsv(PREDICTION_CSV_URL);
    predictionStatus = predictionSource.status;
    await setState(env.DB, "last_prediction_source_check", new Date().toISOString());

    let rows: string[][];
    try {
      rows = parseCsv(predictionSource.text);
    } catch (error) {
      finalResult = "failed_parse";
      throw error;
    }

    const maxWidth = rows.reduce((max, row) => Math.max(max, row.length), 0);
    if (maxWidth < REQUIRED_SOURCE_WIDTH) {
      finalResult = "failed_validation";
      throw new Error(
        `Prediction source has ${maxWidth} columns; at least ${REQUIRED_SOURCE_WIDTH} are required.`
      );
    }

    const normalized = normalizeSourceRows(rows);
    sourceRowCount = normalized.sourceRowCount;
    validMatchResultCount = normalized.validMatchResultCount;
    validOuCount = normalized.validOuCount;
    duplicateCount = normalized.duplicateCount;
    invalidRowCount = normalized.invalidRowCount;

    console.log("MC Predict source validation", {
      runId,
      sourceRows: sourceRowCount,
      validFixtures: normalized.validFixtureCount,
      validMatchResult: validMatchResultCount,
      validOu: validOuCount,
      duplicates: duplicateCount,
      invalidRows: invalidRowCount,
      diagnosticCount: normalized.diagnostics.length
    });

    if (normalized.conflictingMarketIds.length) {
      finalResult = "failed_validation";
      throw new Error(
        `Conflicting duplicate Market IDs: ${normalized.conflictingMarketIds.slice(0, 10).join(", ")}`
      );
    }

    if (normalized.hadDataLikeRows && normalized.validFixtureCount === 0) {
      finalResult = "failed_validation";
      throw new Error("Source contains data-like rows but no valid fixtures.");
    }

    sourceHash = await canonicalDatasetHash(normalized.predictions);
    const active = await getActiveDataset(env.DB);

    if (active?.source_hash === sourceHash) {
      finalResult = normalized.validFixtureCount === 0 ? "success_empty" : "success_no_change";
      await setState(env.DB, "last_successful_prediction_sync", new Date().toISOString());
    } else {
      const datasetId = crypto.randomUUID();
      await createDataset(env.DB, {
        id: datasetId,
        sourceHash,
        sourceFetchedAt: new Date().toISOString(),
        sourceRowCount,
        validFixtureCount: normalized.validFixtureCount,
        validMatchResultCount,
        validOuCount,
        errorCount: normalized.diagnostics.length
      });

      try {
        await insertPredictions(env.DB, datasetId, normalized.predictions);
        await verifyDatasetCount(env.DB, datasetId, normalized.predictions.length);
        await activateDataset(env.DB, datasetId);
      } catch (error) {
        await markDatasetFailed(env.DB, datasetId);
        finalResult = "failed_database";
        throw error;
      }

      activatedDatasetId = datasetId;
      finalResult = normalized.validFixtureCount === 0 ? "success_empty" : "success_changed";
      await setState(env.DB, "last_successful_prediction_sync", new Date().toISOString());
      await pruneOperationalDatasets(env.DB, 5);
    }

    if (normalized.diagnostics.length) {
      console.warn("MC Predict ingestion diagnostics", normalized.diagnostics.slice(0, 20));
    }
  } catch (error) {
    errorSummary = error instanceof Error ? error.message : String(error);
    if (!["failed_parse", "failed_validation", "failed_database"].includes(finalResult)) {
      finalResult = "failed_fetch";
    }
    console.error("MC Predict prediction sync failed", { runId, result: finalResult, error: errorSummary });
  } finally {
    [statResult, teamColourResult] = await Promise.all([
      syncFixtureCount(env),
      syncTeamColours(env)
    ]);

    await finishSyncRun(env.DB, runId, {
      result: finalResult,
      predictionSourceHttpStatus: predictionStatus,
      sourceRowCount,
      validMatchResultCount,
      validOuCount,
      duplicateCount,
      invalidRowCount,
      sourceHash,
      activatedDatasetId,
      siteStatResult: statResult,
      errorSummary
    });

    console.log("MC Predict ingestion finished", {
      runId,
      result: finalResult,
      activatedDatasetId,
      statResult,
      teamColourResult
    });
  }

  return { result: finalResult, datasetId: activatedDatasetId };
}
