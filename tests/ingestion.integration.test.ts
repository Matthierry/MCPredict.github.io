import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getActiveDataset, getFixtureCount } from "../worker/db";
import { runIngestion } from "../worker/ingest";
import { SOURCE_INDEXES } from "../worker/source-columns";
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

function sourceRow(overrides: Partial<Record<keyof typeof SOURCE_INDEXES, string>> = {}) {
  const cells = Array.from({ length: 63 }, () => "");
  const values: Record<string, string> = {
    marketId: "001234567890",
    fixtureDate: "22/08/2026",
    kickoffTime: "15:00",
    homeTeam: "Arsenal",
    awayTeam: "Leeds",
    matchBookmakerHomeProbability: "58%",
    matchBookmakerDrawProbability: "25%",
    matchBookmakerAwayProbability: "21%",
    ouBookmakerOverProbability: "64%",
    ouBookmakerUnderProbability: "43%",
    matchEdge: "10.3%",
    ouEdge: "10.2%",
    matchBookmakerPrice: "1.72",
    matchModelPrice: "1.56",
    ouBookmakerPrice: "1.62",
    ouModelPrice: "1.47",
    matchPrediction: "Home",
    ouPrediction: "Over",
    matchModelHomeProbability: "64%",
    matchModelDrawProbability: "22%",
    matchModelAwayProbability: "14%",
    homeXGoals: "1.91",
    awayXGoals: "0.86",
    homeXShots: "15.4",
    awayXShots: "8.8",
    homeXShotsOnTarget: "5.7",
    awayXShotsOnTarget: "2.9",
    matchValueClassification: "High Value",
    ouValueClassification: "High Value",
    country: "England",
    league: "Premier League",
    ouModelUnderProbability: "32%",
    ouModelOverProbability: "68%",
    ...overrides
  };

  Object.entries(values).forEach(([field, value]) => {
    cells[SOURCE_INDEXES[field as keyof typeof SOURCE_INDEXES]] = value;
  });
  return cells;
}

function csv(rows: string[][]) {
  return rows.map((row) => row.map((value) => {
    if (!/[",\r\n]/.test(value)) return value;
    return `"${value.replaceAll('"', '""')}"`;
  }).join(",")).join("\n");
}

function structurallyValidEmptyCsv() {
  return Array.from({ length: 63 }, () => "").join(",");
}

function fixtureCountCsv(value: number) {
  return `,,,,,${value}`;
}

function createHarness() {
  const database = new TestD1();
  const env = {
    DB: database as unknown as D1Database,
    ASSETS: {} as Fetcher,
    ENVIRONMENT: "test",
    SYNC_TOKEN: "test"
  } satisfies Env;

  let predictionStatus = 200;
  let predictionBody = csv([sourceRow()]);
  let fixtureStatus = 200;
  let fixtureBody = fixtureCountCsv(1234);

  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("gid=2036795967")) {
      return new Response(predictionBody, {
        status: predictionStatus,
        headers: { "Content-Type": "text/csv; charset=utf-8" }
      });
    }
    if (url.includes("gid=56710734")) {
      return new Response(fixtureBody, {
        status: fixtureStatus,
        headers: { "Content-Type": "text/csv; charset=utf-8" }
      });
    }
    throw new Error(`Unexpected fetch URL: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);

  return {
    database,
    env,
    setPrediction(body: string, status = 200) {
      predictionBody = body;
      predictionStatus = status;
    },
    setFixtureCount(body: string, status = 200) {
      fixtureBody = body;
      fixtureStatus = status;
    }
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ingestion integration", () => {
  it("activates a changed dataset and imports F1 independently", async () => {
    const harness = createHarness();
    try {
      const sync = await runIngestion(harness.env, "manual", null);
      expect(sync.result).toBe("success_changed");

      const active = await getActiveDataset(harness.env.DB);
      expect(active?.valid_fixture_count).toBe(1);
      expect(active?.valid_match_result_count).toBe(1);
      expect(active?.valid_ou_count).toBe(1);
      expect(harness.database.raw.prepare("SELECT COUNT(*) AS count FROM predictions WHERE dataset_id = ?").get(active?.id)).toMatchObject({ count: 1 });

      const fixtures = await getFixtureCount(harness.env.DB);
      expect(fixtures.value).toBe(1234);
    } finally {
      harness.database.close();
    }
  });

  it("does not create a replacement snapshot when normalized data is unchanged", async () => {
    const harness = createHarness();
    try {
      expect((await runIngestion(harness.env, "manual", null)).result).toBe("success_changed");
      const firstActive = await getActiveDataset(harness.env.DB);

      expect((await runIngestion(harness.env, "manual", null)).result).toBe("success_no_change");
      const secondActive = await getActiveDataset(harness.env.DB);

      expect(secondActive?.id).toBe(firstActive?.id);
      expect(harness.database.raw.prepare("SELECT COUNT(*) AS count FROM prediction_datasets").get()).toMatchObject({ count: 1 });
    } finally {
      harness.database.close();
    }
  });

  it("preserves the previous active dataset when a new source is invalid", async () => {
    const harness = createHarness();
    try {
      await runIngestion(harness.env, "manual", null);
      const before = await getActiveDataset(harness.env.DB);

      harness.setPrediction(csv([sourceRow({ fixtureDate: "not-a-date" })]));
      expect((await runIngestion(harness.env, "manual", null)).result).toBe("failed_validation");

      const after = await getActiveDataset(harness.env.DB);
      expect(after?.id).toBe(before?.id);
      expect(after?.source_hash).toBe(before?.source_hash);
    } finally {
      harness.database.close();
    }
  });

  it("activates a structurally valid empty dataset", async () => {
    const harness = createHarness();
    try {
      await runIngestion(harness.env, "manual", null);
      const before = await getActiveDataset(harness.env.DB);

      harness.setPrediction(structurallyValidEmptyCsv());
      expect((await runIngestion(harness.env, "manual", null)).result).toBe("success_empty");

      const after = await getActiveDataset(harness.env.DB);
      expect(after?.id).not.toBe(before?.id);
      expect(after?.valid_fixture_count).toBe(0);
      expect(harness.database.raw.prepare("SELECT COUNT(*) AS count FROM predictions WHERE dataset_id = ?").get(after?.id)).toMatchObject({ count: 0 });
    } finally {
      harness.database.close();
    }
  });

  it("rejects conflicting duplicate Market IDs without replacing good data", async () => {
    const harness = createHarness();
    try {
      await runIngestion(harness.env, "manual", null);
      const before = await getActiveDataset(harness.env.DB);

      harness.setPrediction(csv([
        sourceRow(),
        sourceRow({ awayTeam: "Chelsea" })
      ]));
      expect((await runIngestion(harness.env, "manual", null)).result).toBe("failed_validation");

      const after = await getActiveDataset(harness.env.DB);
      expect(after?.id).toBe(before?.id);
    } finally {
      harness.database.close();
    }
  });

  it("can activate predictions when the independent F1 source fails", async () => {
    const harness = createHarness();
    try {
      harness.setFixtureCount("unavailable", 503);
      const sync = await runIngestion(harness.env, "manual", null);
      expect(sync.result).toBe("success_changed");
      expect((await getActiveDataset(harness.env.DB))?.valid_fixture_count).toBe(1);
      expect((await getFixtureCount(harness.env.DB)).value).toBeNull();
      expect(harness.database.raw.prepare("SELECT site_stat_result FROM sync_runs ORDER BY started_at DESC LIMIT 1").get()).toMatchObject({ site_stat_result: "failed" });
    } finally {
      harness.database.close();
    }
  });

  it("preserves predictions while still updating F1 when the prediction source fails", async () => {
    const harness = createHarness();
    try {
      await runIngestion(harness.env, "manual", null);
      const before = await getActiveDataset(harness.env.DB);

      harness.setPrediction("unavailable", 503);
      harness.setFixtureCount(fixtureCountCsv(4321));
      expect((await runIngestion(harness.env, "manual", null)).result).toBe("failed_fetch");

      const after = await getActiveDataset(harness.env.DB);
      expect(after?.id).toBe(before?.id);
      expect((await getFixtureCount(harness.env.DB)).value).toBe(4321);
    } finally {
      harness.database.close();
    }
  });
});
