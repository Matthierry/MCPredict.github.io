import { describe, expect, it } from "vitest";
import { londonHour, shouldRunScheduledIngestion } from "../worker/schedule";

function acceptedUtcHours(date: string) {
  return Array.from({ length: 7 }, (_, index) => index + 12).filter((hour) =>
    shouldRunScheduledIngestion(Date.parse(`${date}T${String(hour).padStart(2, "0")}:00:00Z`))
  );
}

describe("Europe/London ingestion gate", () => {
  it("runs exactly 13:00-18:00 local in January GMT", () => {
    expect(acceptedUtcHours("2026-01-15")).toEqual([13, 14, 15, 16, 17, 18]);
  });

  it("runs exactly 13:00-18:00 local in July BST", () => {
    expect(acceptedUtcHours("2026-07-15")).toEqual([12, 13, 14, 15, 16, 17]);
  });

  it("resolves both sides of the 2026 clock changes", () => {
    expect(londonHour(Date.parse("2026-03-29T12:00:00Z"))).toBe(13);
    expect(londonHour(Date.parse("2026-10-25T13:00:00Z"))).toBe(13);
    expect(acceptedUtcHours("2026-03-29")).toHaveLength(6);
    expect(acceptedUtcHours("2026-10-25")).toHaveLength(6);
  });
});
