import { describe, expect, it } from "vitest";
import { formatFixtureMetaDate } from "../src/format";

describe("fixture metadata date formatting", () => {
  it("formats dates with weekday, ordinal day and abbreviated month", () => {
    expect(formatFixtureMetaDate("2026-08-15")).toBe("Sat 15th Aug");
    expect(formatFixtureMetaDate("2026-08-21")).toBe("Fri 21st Aug");
    expect(formatFixtureMetaDate("2026-08-22")).toBe("Sat 22nd Aug");
    expect(formatFixtureMetaDate("2026-08-23")).toBe("Sun 23rd Aug");
  });

  it("handles ordinal exceptions and leaves invalid source values visible", () => {
    expect(formatFixtureMetaDate("2026-08-11")).toBe("Tue 11th Aug");
    expect(formatFixtureMetaDate("2026-08-12")).toBe("Wed 12th Aug");
    expect(formatFixtureMetaDate("2026-08-13")).toBe("Thu 13th Aug");
    expect(formatFixtureMetaDate("not-a-date")).toBe("not-a-date");
  });
});
