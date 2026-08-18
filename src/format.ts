export function formatPrice(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "—";
}

export function formatEdge(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function formatProbability(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

export function formatMetric(value: number | null | undefined, decimals: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const fixed = value.toFixed(decimals);
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

export function formatFriendlyDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(date);
}

export function formatUpdatedAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London"
  }).format(date);
}

export function classificationClass(classification: string | null | undefined): string {
  const normalized = (classification ?? "").trim().toLowerCase().replace(/\s+/g, "-");
  return `classification classification--${normalized || "neutral"}`;
}

export const formatOdds = formatPrice;
export const formatDateLabel = formatFriendlyDate;
