const SPREADSHEET_ERRORS = new Set([
  "#REF!",
  "#N/A",
  "#VALUE!",
  "#DIV/0!",
  "#NAME?",
  "#NUM!",
  "#NULL!"
]);

export function cleanCell(value: unknown): string {
  return String(value ?? "").trim();
}

export function isSpreadsheetError(value: unknown): boolean {
  return SPREADSHEET_ERRORS.has(cleanCell(value).toUpperCase());
}

export function parsePercentage(value: unknown): number | null {
  const raw = cleanCell(value);
  if (!raw || isSpreadsheetError(raw)) return null;

  const hasPercent = raw.endsWith("%");
  const numericText = hasPercent ? raw.slice(0, -1).trim() : raw;
  const numeric = Number(numericText);
  if (!Number.isFinite(numeric)) return null;

  const normalized = hasPercent ? numeric / 100 : Math.abs(numeric) <= 1 ? numeric : numeric / 100;
  if (normalized < 0 || normalized > 1) return null;
  return normalized;
}

export function parseDecimal(value: unknown): number | null {
  const raw = cleanCell(value);
  if (!raw || isSpreadsheetError(raw)) return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

export function parseEdgePercentagePoints(value: unknown): number | null {
  const raw = cleanCell(value);
  if (!raw || isSpreadsheetError(raw)) return null;
  const hasPercent = raw.endsWith("%");
  const numericText = hasPercent ? raw.slice(0, -1).trim() : raw;
  const numeric = Number(numericText);
  if (!Number.isFinite(numeric)) return null;

  const points = hasPercent ? numeric : Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
  return Math.abs(points) <= 1000 ? points : null;
}

export function parseFixtureCount(value: unknown): number | null {
  const raw = cleanCell(value);
  if (!raw || isSpreadsheetError(raw)) return null;
  const numeric = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.round(numeric);
}

export function parseIsoDate(value: unknown): string | null {
  const raw = cleanCell(value);
  if (!raw || isSpreadsheetError(raw)) return null;

  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\D.*)?$/);
  if (iso) return validateDateParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const uk = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (uk) return validateDateParts(Number(uk[3]), Number(uk[2]), Number(uk[1]));

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function validateDateParts(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

export function normalizeKickoff(value: unknown): string | null {
  const raw = cleanCell(value);
  if (!raw || isSpreadsheetError(raw)) return null;

  const time = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(am|pm))?$/i);
  if (!time) return raw;

  let hour = Number(time[1]);
  const minute = Number(time[2]);
  const meridiem = time[3]?.toLowerCase();
  if (minute > 59 || hour > 23) return raw;
  if (meridiem) {
    if (hour < 1 || hour > 12) return raw;
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  }
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

export function valueClassificationFallback(edge: number): string {
  if (edge > 10) return "High Value";
  if (edge > 5) return "Good Value";
  if (edge > 0) return "Some Value";
  if (edge > -5) return "No Value";
  if (edge > -10) return "Bad Value";
  return "Very Bad Value";
}
