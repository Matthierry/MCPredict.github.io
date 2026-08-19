const TARGET_HOURS = new Set([13, 14, 15, 16, 17, 18]);

export function londonHour(timestampMs: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(timestampMs));

  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  if (!Number.isInteger(hour)) throw new Error("Unable to resolve Europe/London hour");
  return hour;
}

export function shouldRunScheduledIngestion(timestampMs: number): boolean {
  return TARGET_HOURS.has(londonHour(timestampMs));
}
