import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { handleApi } from "../worker/api";
import type { Env } from "../worker/types";

class TestStatement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly args: unknown[] = []
  ) {}

  bind(...args: unknown[]) {
    return new TestStatement(this.db, this.sql, args);
  }

  async run() {
    const result = this.db.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(result.changes) } };
  }

  async first<T>() {
    return (this.db.prepare(this.sql).get(...this.args) ?? null) as T | null;
  }

  async all<T>() {
    return { results: this.db.prepare(this.sql).all(...this.args) as T[] };
  }
}

class TestD1 {
  readonly raw = new DatabaseSync(":memory:");

  constructor() {
    this.raw.exec(readFileSync(new URL("../migrations/0001_initial.sql", import.meta.url), "utf8"));
  }

  prepare(sql: string) {
    return new TestStatement(this.raw, sql);
  }

  async batch(statements: TestStatement[]) {
    const results: unknown[] = [];
    this.raw.exec("BEGIN");
    try {
      for (const statement of statements) results.push(await statement.run());
      this.raw.exec("COMMIT");
      return results;
    } catch (error) {
      this.raw.exec("ROLLBACK");
      throw error;
    }
  }

  close() {
    this.raw.close();
  }
}

interface SeedPrediction {
  marketId: string;
  homeTeam?: string;
  awayTeam?: string;
  matchEdge: number;
  ouEdge: number;
  matchValid?: boolean;
  ouValid?: boolean;
  matchPrediction?: "Home" | "Draw" | "Away";
  ouPrediction?: "Over 2.5" | "Under 2.5";
}

function insertPrediction(db: DatabaseSync, datasetId: string, prediction: SeedPrediction) {
  const matchPrediction = prediction.matchPrediction ?? "Home";
  const ouPrediction = prediction.ouPrediction ?? "Over 2.5";
  const record: Record<string, string | number | null> = {
    dataset_id: datasetId,
    market_id: prediction.marketId,
    fixture_date: "2026-08-22",
    kickoff_time: "15:00",
    country: "England",
    league: "Premier League",
    home_team: prediction.homeTeam ?? `Home ${prediction.marketId}`,
    away_team: prediction.awayTeam ?? `Away ${prediction.marketId}`,
    match_prediction: matchPrediction,
    match_model_home_probability: matchPrediction === "Home" ? 0.64 : 0.28,
    match_model_draw_probability: matchPrediction === "Draw" ? 0.55 : 0.22,
    match_model_away_probability: matchPrediction === "Away" ? 0.61 : 0.14,
    match_model_price: 1.56,
    match_bookmaker_home_probability: 0.58,
    match_bookmaker_draw_probability: 0.25,
    match_bookmaker_away_probability: 0.21,
    match_bookmaker_price: 1.72,
    match_edge: prediction.matchEdge,
    match_value_classification: prediction.matchEdge > 10 ? "High Value" : prediction.matchEdge > 0 ? "Some Value" : "No Value",
    match_valid: prediction.matchValid === false ? 0 : 1,
    ou_prediction: ouPrediction,
    ou_model_over_probability: ouPrediction === "Over 2.5" ? 0.68 : 0.37,
    ou_model_under_probability: ouPrediction === "Under 2.5" ? 0.63 : 0.32,
    ou_model_price: 1.47,
    ou_bookmaker_over_probability: 0.64,
    ou_bookmaker_under_probability: 0.43,
    ou_bookmaker_price: 1.62,
    ou_edge: prediction.ouEdge,
    ou_value_classification: prediction.ouEdge > 10 ? "High Value" : prediction.ouEdge > 0 ? "Some Value" : "No Value",
    ou_valid: prediction.ouValid === false ? 0 : 1,
    home_xgoals: 1.91,
    away_xgoals: 0.86,
    home_xshots: 15.4,
    away_xshots: 8.8,
    home_xshots_on_target: 5.7,
    away_xshots_on_target: 2.9,
    fixture_fingerprint: `fp-${prediction.marketId}`
  };

  const columns = Object.keys(record);
  const values = Object.values(record);
  db.prepare(
    `INSERT INTO predictions (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`
  ).run(...values);
}

function createHarness() {
  const database = new TestD1();
  const db = database.raw;
  db.prepare(
    "INSERT INTO prediction_datasets (id, source_hash, source_fetched_at, created_at, activated_at, status, valid_fixture_count, valid_match_result_count, valid_ou_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run("old", "old-hash", "2026-08-17T12:00:00Z", "2026-08-17T12:00:00Z", "2026-08-17T12:01:00Z", "superseded", 1, 1, 1);
  db.prepare(
    "INSERT INTO prediction_datasets (id, source_hash, source_fetched_at, created_at, activated_at, status, valid_fixture_count, valid_match_result_count, valid_ou_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run("active", "active-hash", "2026-08-18T12:00:00Z", "2026-08-18T12:00:00Z", "2026-08-18T12:01:00Z", "active", 4, 3, 4);

  insertPrediction(db, "old", { marketId: "OLD", matchEdge: 99, ouEdge: 99 });
  insertPrediction(db, "active", { marketId: "A", matchEdge: 4, ouEdge: 12 });
  insertPrediction(db, "active", { marketId: "B", matchEdge: 15, ouEdge: -2, matchPrediction: "Draw" });
  insertPrediction(db, "active", { marketId: "C", matchEdge: 8, ouEdge: 7, ouPrediction: "Under 2.5" });
  insertPrediction(db, "active", { marketId: "D", matchEdge: 20, ouEdge: 3, matchValid: false, matchPrediction: "Away" });

  db.prepare("INSERT INTO site_stats (key, numeric_value, updated_at, source_hash) VALUES ('fixtures_processed', ?, ?, ?)")
    .run(18426, "2026-08-18T12:02:00Z", "stats-hash");

  const env = {
    DB: database as unknown as D1Database,
    ASSETS: {} as Fetcher,
    ENVIRONMENT: "test",
    SYNC_TOKEN: "secret"
  } satisfies Env;

  return { database, env };
}

async function jsonBody<T>(response: Response | null): Promise<T> {
  if (!response) throw new Error("Expected API response.");
  return await response.json() as T;
}

describe("public API integration", () => {
  it("returns health without exposing diagnostics", async () => {
    const harness = createHarness();
    try {
      const response = await handleApi(new Request("https://beta.mcpredict.com/api/v1/health"), harness.env);
      expect(response?.status).toBe(200);
      expect(await jsonBody(response)).toEqual({ status: "ok", database: "ok", activeDataset: true });
      expect(response?.headers.get("cache-control")).toBe("no-store");
    } finally {
      harness.database.close();
    }
  });

  it("returns site stats and supports deterministic ETag revalidation", async () => {
    const harness = createHarness();
    try {
      const first = await handleApi(new Request("https://beta.mcpredict.com/api/v1/site-stats"), harness.env);
      expect(first?.status).toBe(200);
      expect(await jsonBody<{ fixturesProcessed: number }>(first)).toMatchObject({ fixturesProcessed: 18426 });
      const etag = first?.headers.get("etag");
      expect(etag).toBeTruthy();

      const second = await handleApi(new Request("https://beta.mcpredict.com/api/v1/site-stats", {
        headers: { "If-None-Match": etag ?? "" }
      }), harness.env);
      expect(second?.status).toBe(304);
    } finally {
      harness.database.close();
    }
  });

  it("builds homepage Top 3 lists from only the active dataset and each market's Edge", async () => {
    const harness = createHarness();
    try {
      const response = await handleApi(new Request("https://beta.mcpredict.com/api/v1/home"), harness.env);
      const body = await jsonBody<{
        fixturesProcessed: number;
        topMatchResult: Array<{ marketId: string }>;
        topOverUnder25: Array<{ marketId: string }>;
        hasPredictions: boolean;
      }>(response);

      expect(body.fixturesProcessed).toBe(18426);
      expect(body.topMatchResult.map((item) => item.marketId)).toEqual(["B", "C", "A"]);
      expect(body.topOverUnder25.map((item) => item.marketId)).toEqual(["A", "C", "D"]);
      expect(body.topMatchResult.some((item) => item.marketId === "OLD")).toBe(false);
      expect(body.topOverUnder25.some((item) => item.marketId === "OLD")).toBe(false);
      expect(body.hasPredictions).toBe(true);
    } finally {
      harness.database.close();
    }
  });

  it("returns only valid active Match Result rows with price-aligned selected/model probabilities", async () => {
    const harness = createHarness();
    try {
      const response = await handleApi(new Request("https://beta.mcpredict.com/api/v1/predictions/match-result"), harness.env);
      const body = await jsonBody<{
        data: Array<{
          marketId: string;
          prediction: { selection: string; probability: number; modelPrice: number };
          probabilities: { model: { home: number; draw: number; away: number } };
        }>;
        meta: { datasetId: string; count: number };
      }>(response);

      expect(body.data.map((item) => item.marketId)).toEqual(["B", "C", "A"]);
      const draw = body.data.find((item) => item.marketId === "B");
      expect(draw?.prediction.selection).toBe("Draw");
      expect(draw?.prediction.probability).toBeCloseTo(1 / 1.56);
      expect(draw?.probabilities.model.draw).toBeCloseTo(1 / 1.56);
      expect((draw?.probabilities.model.home ?? 0) + (draw?.probabilities.model.draw ?? 0) + (draw?.probabilities.model.away ?? 0)).toBeCloseTo(1);
      expect(body.data.some((item) => item.marketId === "D")).toBe(false);
      expect(body.meta).toMatchObject({ datasetId: "active", count: 3 });
    } finally {
      harness.database.close();
    }
  });

  it("returns O/U rows with bookmaker implied probabilities and model bar aligned to selected model price", async () => {
    const harness = createHarness();
    try {
      const response = await handleApi(new Request("https://beta.mcpredict.com/api/v1/predictions/over-under-25"), harness.env);
      const body = await jsonBody<{
        data: Array<{
          marketId: string;
          prediction: { selection: string; probability: number; modelPrice: number };
          probabilities: {
            model: { over: number; under: number };
            bookmaker: { over: number; under: number };
          };
        }>;
      }>(response);

      expect(body.data.map((item) => item.marketId)).toEqual(["A", "C", "D", "B"]);
      const under = body.data.find((item) => item.marketId === "C");
      expect(under?.prediction.selection).toBe("Under 2.5");
      expect(under?.prediction.probability).toBeCloseTo(1 / 1.47);
      expect(under?.probabilities.model.under).toBeCloseTo(1 / 1.47);
      expect(under?.probabilities.model.over).toBeCloseTo(1 - (1 / 1.47));
      expect(under?.probabilities.bookmaker).toEqual({ over: 0.64, under: 0.43 });
    } finally {
      harness.database.close();
    }
  });

  it("returns empty public prediction payloads when no active dataset exists", async () => {
    const database = new TestD1();
    const env = {
      DB: database as unknown as D1Database,
      ASSETS: {} as Fetcher,
      ENVIRONMENT: "test",
      SYNC_TOKEN: "secret"
    } satisfies Env;
    try {
      const response = await handleApi(new Request("https://beta.mcpredict.com/api/v1/predictions/match-result"), env);
      expect(await jsonBody(response)).toEqual({ data: [], meta: { datasetId: null, updatedAt: null, count: 0 } });
    } finally {
      database.close();
    }
  });

  it("keeps the manual sync route undiscoverable without the correct token", async () => {
    const harness = createHarness();
    try {
      const response = await handleApi(new Request("https://beta.mcpredict.com/api/internal/sync", { method: "POST" }), harness.env);
      expect(response?.status).toBe(404);
      expect(await jsonBody(response)).toEqual({ error: "Not found" });
    } finally {
      harness.database.close();
    }
  });
});
