import { getCell } from "./source-columns";
import {
  cleanCell,
  impliedProbabilityFromDecimalOdds,
  isSpreadsheetError,
  normalizeKickoff,
  parseDecimal,
  parseEdgePercentagePoints,
  parseIsoDate,
  parsePercentage,
  valueClassificationFallback
} from "./parsers";
import type {
  MatchSelection,
  NormalizationResult,
  NormalizedPrediction,
  OuSelection
} from "./types";

function normalizeMatchSelection(value: unknown): MatchSelection | null {
  const raw = cleanCell(value).toLowerCase().replace(/\s+/g, " ");
  if (raw === "home" || raw === "home win" || raw === "homewin") return "Home";
  if (raw === "draw") return "Draw";
  if (raw === "away" || raw === "away win" || raw === "awaywin") return "Away";
  return null;
}

function normalizeOuSelection(value: unknown): OuSelection | null {
  const raw = cleanCell(value).toLowerCase();
  if (raw === "over" || raw === "over 2.5" || raw === "over2.5") return "Over 2.5";
  if (raw === "under" || raw === "under 2.5" || raw === "under2.5") return "Under 2.5";
  return null;
}

function normalizeText(value: unknown): string | null {
  const raw = cleanCell(value);
  if (!raw || isSpreadsheetError(raw)) return null;
  return raw;
}

function slugPart(value: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function createFixtureFingerprint(
  fixtureDate: string,
  league: string | null,
  homeTeam: string,
  awayTeam: string
): string {
  return fnv1a(
    [fixtureDate, slugPart(league), slugPart(homeTeam), slugPart(awayTeam)].join("|")
  );
}

const CRITICAL_SHARED_FIELDS = ["marketId", "fixtureDate", "homeTeam", "awayTeam"] as const;
const OPTIONAL_SHARED_FIELDS = [
  "kickoffTime",
  "country",
  "league",
  "homeXGoals",
  "awayXGoals",
  "homeXShots",
  "awayXShots",
  "homeXShotsOnTarget",
  "awayXShotsOnTarget"
] as const;

function containsCriticalSharedSpreadsheetError(row: string[]): boolean {
  return CRITICAL_SHARED_FIELDS.some((field) => isSpreadsheetError(getCell(row, field)));
}

function optionalSharedSpreadsheetErrors(row: string[]): string[] {
  return OPTIONAL_SHARED_FIELDS.filter((field) => isSpreadsheetError(getCell(row, field)));
}

function isHeaderLike(row: string[]): boolean {
  const id = cleanCell(getCell(row, "marketId")).toLowerCase();
  const home = cleanCell(getCell(row, "homeTeam")).toLowerCase();
  const away = cleanCell(getCell(row, "awayTeam")).toLowerCase();
  return (
    id === "market id" ||
    id === "marketid" ||
    id === "market identifier" ||
    home === "home team" ||
    home === "hometeam" ||
    home === "home" ||
    away === "away team" ||
    away === "awayteam" ||
    away === "away"
  );
}

function isDataLike(row: string[]): boolean {
  return [
    "marketId",
    "fixtureDate",
    "homeTeam",
    "awayTeam",
    "matchPrediction",
    "ouPrediction"
  ].some((field) => cleanCell(getCell(row, field as Parameters<typeof getCell>[1])) !== "");
}

function maxKey<T extends string>(entries: Array<[T, number | null]>): T | null {
  const valid = entries.filter((entry): entry is [T, number] => entry[1] !== null);
  if (!valid.length) return null;
  valid.sort((a, b) => b[1] - a[1]);
  return valid[0][0];
}

function normalizeRow(
  row: string[],
  rowNumber: number,
  diagnostics: string[]
): NormalizedPrediction | null {
  if (containsCriticalSharedSpreadsheetError(row)) {
    diagnostics.push(`Row ${rowNumber}: critical shared fixture field contains a spreadsheet error.`);
    return null;
  }

  const optionalErrors = optionalSharedSpreadsheetErrors(row);
  if (optionalErrors.length) {
    diagnostics.push(
      `Row ${rowNumber}: optional shared field error(s) normalised to null: ${optionalErrors.join(", ")}.`
    );
  }

  const marketId = cleanCell(getCell(row, "marketId"));
  const fixtureDate = parseIsoDate(getCell(row, "fixtureDate"));
  const homeTeam = normalizeText(getCell(row, "homeTeam"));
  const awayTeam = normalizeText(getCell(row, "awayTeam"));

  if (!marketId || !fixtureDate || !homeTeam || !awayTeam) {
    diagnostics.push(
      `Row ${rowNumber}: invalid shared fixture data (Market ID/date/home/away required).`
    );
    return null;
  }

  const kickoffTime = normalizeKickoff(getCell(row, "kickoffTime"));
  const country = normalizeText(getCell(row, "country"));
  const league = normalizeText(getCell(row, "league"));

  const homeXGoals = parseDecimal(getCell(row, "homeXGoals"));
  const awayXGoals = parseDecimal(getCell(row, "awayXGoals"));
  const homeXShots = parseDecimal(getCell(row, "homeXShots"));
  const awayXShots = parseDecimal(getCell(row, "awayXShots"));
  const homeXShotsOnTarget = parseDecimal(getCell(row, "homeXShotsOnTarget"));
  const awayXShotsOnTarget = parseDecimal(getCell(row, "awayXShotsOnTarget"));

  const matchPredictionRaw = getCell(row, "matchPrediction");
  const matchClassificationRaw = getCell(row, "matchValueClassification");
  const matchPrediction = normalizeMatchSelection(matchPredictionRaw);
  const matchModelHomeProbability = parsePercentage(getCell(row, "matchModelHomeProbability"));
  const matchModelDrawProbability = parsePercentage(getCell(row, "matchModelDrawProbability"));
  const matchModelAwayProbability = parsePercentage(getCell(row, "matchModelAwayProbability"));
  const matchModelPrice = parseDecimal(getCell(row, "matchModelPrice"));
  const matchBookmakerHomeProbability = impliedProbabilityFromDecimalOdds(
    getCell(row, "matchBookmakerHomeProbability")
  );
  const matchBookmakerDrawProbability = impliedProbabilityFromDecimalOdds(
    getCell(row, "matchBookmakerDrawProbability")
  );
  const matchBookmakerAwayProbability = impliedProbabilityFromDecimalOdds(
    getCell(row, "matchBookmakerAwayProbability")
  );
  const matchBookmakerPrice = parseDecimal(getCell(row, "matchBookmakerPrice"));
  const matchEdge = parseEdgePercentagePoints(getCell(row, "matchEdge"));
  const matchClassificationHasError = isSpreadsheetError(matchClassificationRaw);
  const matchValueClassification =
    normalizeText(matchClassificationRaw) ??
    (matchEdge !== null && !matchClassificationHasError
      ? valueClassificationFallback(matchEdge)
      : null);

  const matchValid =
    !isSpreadsheetError(matchPredictionRaw) &&
    !matchClassificationHasError &&
    matchPrediction !== null &&
    matchModelHomeProbability !== null &&
    matchModelDrawProbability !== null &&
    matchModelAwayProbability !== null &&
    matchModelPrice !== null &&
    matchBookmakerHomeProbability !== null &&
    matchBookmakerDrawProbability !== null &&
    matchBookmakerAwayProbability !== null &&
    matchBookmakerPrice !== null &&
    matchEdge !== null &&
    matchValueClassification !== null;

  if (matchValid) {
    const highest = maxKey<MatchSelection>([
      ["Home", matchModelHomeProbability],
      ["Draw", matchModelDrawProbability],
      ["Away", matchModelAwayProbability]
    ]);
    if (highest !== matchPrediction) {
      diagnostics.push(
        `Row ${rowNumber} Market ID ${marketId}: AQ (${matchPrediction}) does not match largest AS/AT/AU (${highest}).`
      );
    }
  }

  const ouPredictionRaw = getCell(row, "ouPrediction");
  const ouClassificationRaw = getCell(row, "ouValueClassification");
  const ouPrediction = normalizeOuSelection(ouPredictionRaw);
  const ouModelOverProbability = parsePercentage(getCell(row, "ouModelOverProbability"));
  const ouModelUnderProbability = parsePercentage(getCell(row, "ouModelUnderProbability"));
  const ouModelPrice = parseDecimal(getCell(row, "ouModelPrice"));
  const ouBookmakerOverProbability = impliedProbabilityFromDecimalOdds(
    getCell(row, "ouBookmakerOverProbability")
  );
  const ouBookmakerUnderProbability = impliedProbabilityFromDecimalOdds(
    getCell(row, "ouBookmakerUnderProbability")
  );
  const ouBookmakerPrice = parseDecimal(getCell(row, "ouBookmakerPrice"));
  const ouEdge = parseEdgePercentagePoints(getCell(row, "ouEdge"));
  const ouClassificationHasError = isSpreadsheetError(ouClassificationRaw);
  const ouValueClassification =
    normalizeText(ouClassificationRaw) ??
    (ouEdge !== null && !ouClassificationHasError ? valueClassificationFallback(ouEdge) : null);

  const ouValid =
    !isSpreadsheetError(ouPredictionRaw) &&
    !ouClassificationHasError &&
    ouPrediction !== null &&
    ouModelOverProbability !== null &&
    ouModelUnderProbability !== null &&
    ouModelPrice !== null &&
    ouBookmakerOverProbability !== null &&
    ouBookmakerUnderProbability !== null &&
    ouBookmakerPrice !== null &&
    ouEdge !== null &&
    ouValueClassification !== null;

  if (ouValid) {
    const highest = maxKey<OuSelection>([
      ["Over 2.5", ouModelOverProbability],
      ["Under 2.5", ouModelUnderProbability]
    ]);
    if (highest !== ouPrediction) {
      diagnostics.push(
        `Row ${rowNumber} Market ID ${marketId}: AR (${ouPrediction}) does not match largest BJ/BK (${highest}).`
      );
    }
  }

  return {
    marketId,
    fixtureDate,
    kickoffTime,
    country,
    league,
    homeTeam,
    awayTeam,
    matchPrediction,
    matchModelHomeProbability,
    matchModelDrawProbability,
    matchModelAwayProbability,
    matchModelPrice,
    matchBookmakerHomeProbability,
    matchBookmakerDrawProbability,
    matchBookmakerAwayProbability,
    matchBookmakerPrice,
    matchEdge,
    matchValueClassification,
    matchValid,
    ouPrediction,
    ouModelOverProbability,
    ouModelUnderProbability,
    ouModelPrice,
    ouBookmakerOverProbability,
    ouBookmakerUnderProbability,
    ouBookmakerPrice,
    ouEdge,
    ouValueClassification,
    ouValid,
    homeXGoals,
    awayXGoals,
    homeXShots,
    awayXShots,
    homeXShotsOnTarget,
    awayXShotsOnTarget,
    fixtureFingerprint: createFixtureFingerprint(fixtureDate, league, homeTeam, awayTeam)
  };
}

function canonicalPrediction(prediction: NormalizedPrediction): string {
  return JSON.stringify(prediction);
}

export function normalizeSourceRows(rows: string[][]): NormalizationResult {
  const diagnostics: string[] = [];
  const normalized: NormalizedPrediction[] = [];
  let sourceRowCount = 0;
  let invalidRowCount = 0;
  let hadDataLikeRows = false;

  rows.forEach((row, index) => {
    if (!isDataLike(row) || isHeaderLike(row)) return;
    hadDataLikeRows = true;
    sourceRowCount += 1;
    const prediction = normalizeRow(row, index + 1, diagnostics);
    if (!prediction) {
      invalidRowCount += 1;
      return;
    }
    if (!prediction.matchValid && !prediction.ouValid) invalidRowCount += 1;
    normalized.push(prediction);
  });

  const byMarketId = new Map<string, NormalizedPrediction>();
  const conflictingMarketIds = new Set<string>();
  let duplicateCount = 0;

  for (const prediction of normalized) {
    const existing = byMarketId.get(prediction.marketId);
    if (!existing) {
      byMarketId.set(prediction.marketId, prediction);
      continue;
    }

    duplicateCount += 1;
    if (canonicalPrediction(existing) !== canonicalPrediction(prediction)) {
      conflictingMarketIds.add(prediction.marketId);
      diagnostics.push(`Conflicting duplicate Market ID: ${prediction.marketId}.`);
    }
  }

  const predictions = Array.from(byMarketId.values()).filter(
    (prediction) => !conflictingMarketIds.has(prediction.marketId)
  );

  return {
    predictions,
    sourceRowCount,
    validFixtureCount: predictions.length,
    validMatchResultCount: predictions.filter((prediction) => prediction.matchValid).length,
    validOuCount: predictions.filter((prediction) => prediction.ouValid).length,
    duplicateCount,
    invalidRowCount,
    diagnostics,
    conflictingMarketIds: Array.from(conflictingMarketIds),
    hadDataLikeRows
  };
}

export async function canonicalDatasetHash(
  predictions: NormalizedPrediction[]
): Promise<string> {
  const canonical = [...predictions]
    .sort((a, b) => a.marketId.localeCompare(b.marketId))
    .map((prediction) => canonicalPrediction(prediction))
    .join("\n");

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function selectedMatchProbability(prediction: NormalizedPrediction): number | null {
  if (!prediction.matchPrediction) return null;
  return impliedProbabilityFromDecimalOdds(prediction.matchModelPrice);
}

export function selectedOuProbability(prediction: NormalizedPrediction): number | null {
  if (!prediction.ouPrediction) return null;
  return impliedProbabilityFromDecimalOdds(prediction.ouModelPrice);
}
