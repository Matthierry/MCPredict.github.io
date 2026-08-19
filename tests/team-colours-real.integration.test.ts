import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { normalizeSourceRows } from "../worker/normalize";
import { normalizeTeamKey, parseTeamColourRows, TEAM_COLOUR_CSV_URL } from "../worker/team-colours";

const PREDICTION_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_1dSqKC6BUuykrL9QA5_fwiIEodU3jXBCskHCA7uVU-EYnHusQWZhMFwZXNvk2bFlElmsQHZ3b4n2/pub?gid=2036795967&single=true&output=csv";

function parseCsv(text: string): string[][] {
  const parsed = Papa.parse<string[]>(text, { delimiter: ",", skipEmptyLines: false });
  expect(parsed.errors, JSON.stringify(parsed.errors.slice(0, 5))).toHaveLength(0);
  return parsed.data;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url: string, attempts = 4): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "text/csv,text/plain;q=0.9,*/*;q=0.1",
          "User-Agent": "MC-Predict-Team-Colours-QA/1.0"
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
      const text = await response.text();
      expect(text.trimStart().toLowerCase().startsWith("<!doctype html")).toBe(false);
      return text;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 1_500);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Unable to fetch ${url}`);
}

const realQa = process.env.RUN_REAL_SOURCE_QA === "1" ? describe : describe.skip;

realQa("published team colour source", () => {
  it("covers every team in the current valid prediction dataset with valid hex colours", async () => {
    const [predictionText, colourText] = await Promise.all([
      fetchText(PREDICTION_CSV_URL),
      fetchText(TEAM_COLOUR_CSV_URL)
    ]);

    const predictions = normalizeSourceRows(parseCsv(predictionText));
    const colours = parseTeamColourRows(parseCsv(colourText));

    expect(colours.conflictingTeamKeys).toEqual([]);
    expect(colours.records.length).toBeGreaterThan(0);

    const colourByKey = new Map(colours.records.map((record) => [record.teamKey, record]));
    const currentTeams = Array.from(new Set(
      predictions.predictions
        .filter((prediction) => prediction.matchValid || prediction.ouValid)
        .flatMap((prediction) => [prediction.homeTeam, prediction.awayTeam])
    )).sort();

    const unmatched = currentTeams.filter((team) => !colourByKey.has(normalizeTeamKey(team)));

    console.log("REAL_TEAM_COLOUR_SUMMARY", {
      colourRows: colours.records.length,
      invalidColourRows: colours.invalidRows,
      currentTeams: currentTeams.length,
      matchedTeams: currentTeams.length - unmatched.length,
      unmatched
    });

    expect(unmatched).toEqual([]);

    for (const team of currentTeams) {
      const colour = colourByKey.get(normalizeTeamKey(team));
      expect(colour, `Missing colour for ${team}`).toBeTruthy();
      expect(colour?.primaryColour).toMatch(/^#[0-9A-F]{6}$/);
      expect(colour?.secondaryColour).toMatch(/^#[0-9A-F]{6}$/);
    }
  }, 90_000);
});
