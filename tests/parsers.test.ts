import { describe, expect, it } from "vitest";
import {
  isSpreadsheetError,
  normalizeKickoff,
  parseDecimal,
  parseEdgePercentagePoints,
  parseFixtureCount,
  parseIsoDate,
  parsePercentage,
  valueClassificationFallback
} from "../worker/parsers";

describe("percentage parser", () => {
  it.each([
    ["54%", 0.54], ["54.2%", 0.542], ["0.542", 0.542], [54, 0.54], [0.54, 0.54], [" 54.0% ", 0.54]
  ])("normalizes %s", (input, expected) => expect(parsePercentage(input)).toBeCloseTo(expected));

  it.each(["", "#REF!", "#N/A", "abc", "120%", -0.1])("rejects %s", (input) => {
    expect(parsePercentage(input)).toBeNull();
  });
});

describe("numeric and edge parsing", () => {
  it("does not turn missing values into zero", () => expect(parseDecimal("")).toBeNull());
  it("parses real zero", () => expect(parseDecimal("0")).toBe(0));
  it.each([["+7.4%", 7.4], ["-3.2%", -3.2], [0.074, 7.4], [7.4, 7.4], [0, 0]])(
    "parses edge %s", (input, expected) => expect(parseEdgePercentagePoints(input)).toBeCloseTo(expected)
  );
  it("parses fixture count with commas", () => expect(parseFixtureCount("18,426")).toBe(18426));
});

describe("spreadsheet errors", () => {
  it.each(["#REF!", "#N/A", "#VALUE!", "#DIV/0!", "#NAME?", "#NUM!", "#NULL!"])("detects %s", (value) => {
    expect(isSpreadsheetError(value)).toBe(true);
  });
});

describe("date/time", () => {
  it("normalizes UK date", () => expect(parseIsoDate("22/08/2026")).toBe("2026-08-22"));
  it("rejects invalid date", () => expect(parseIsoDate("31/02/2026")).toBeNull());
  it("normalizes pm kickoff", () => expect(normalizeKickoff("3:00 pm")).toBe("15:00"));
});

describe("classification fallback boundaries", () => {
  it.each([
    [10.01, "High Value"], [10, "Good Value"], [5.01, "Good Value"], [5, "Some Value"],
    [0.01, "Some Value"], [0, "No Value"], [-4.99, "No Value"], [-5, "Bad Value"],
    [-9.99, "Bad Value"], [-10, "Very Bad Value"]
  ])("classifies %s", (edge, expected) => expect(valueClassificationFallback(edge)).toBe(expected));
});
