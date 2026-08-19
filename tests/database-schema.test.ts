import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

function createDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../migrations/0001_initial.sql", import.meta.url), "utf8"));
  db.exec(readFileSync(new URL("../migrations/0002_team_colours.sql", import.meta.url), "utf8"));
  return db;
}

describe("D1-compatible snapshot schema", () => {
  it("applies the production migrations and enforces Market ID uniqueness within a dataset", () => {
    const db = createDb();
    db.prepare("INSERT INTO prediction_datasets (id, source_hash, source_fetched_at, created_at, status) VALUES (?, ?, ?, ?, ?)")
      .run("dataset-a", "hash", "2026-08-18T12:00:00Z", "2026-08-18T12:00:00Z", "building");

    const insert = db.prepare("INSERT INTO predictions (dataset_id, market_id, fixture_date, home_team, away_team, match_valid, ou_valid, fixture_fingerprint) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    insert.run("dataset-a", "00123", "2026-08-22", "Arsenal", "Leeds", 1, 1, "fingerprint");
    expect(() => insert.run("dataset-a", "00123", "2026-08-22", "Arsenal", "Leeds", 1, 1, "fingerprint")).toThrow();
    db.close();
  });

  it("supports a safe active to superseded snapshot transition", () => {
    const db = createDb();
    const insertDataset = db.prepare("INSERT INTO prediction_datasets (id, source_hash, source_fetched_at, created_at, activated_at, status) VALUES (?, ?, ?, ?, ?, ?)");
    insertDataset.run("old", "old-hash", "2026-08-18T12:00:00Z", "2026-08-18T12:00:00Z", "2026-08-18T12:01:00Z", "active");
    insertDataset.run("new", "new-hash", "2026-08-18T13:00:00Z", "2026-08-18T13:00:00Z", null, "building");

    db.exec("BEGIN");
    db.prepare("UPDATE prediction_datasets SET status = 'superseded' WHERE id = ? AND status = 'active'").run("old");
    db.prepare("UPDATE prediction_datasets SET status = 'active', activated_at = ? WHERE id = ? AND status = 'building'").run("2026-08-18T13:01:00Z", "new");
    db.prepare("INSERT INTO site_state (key, value, updated_at) VALUES ('active_prediction_dataset_id', ?, ?)").run("new", "2026-08-18T13:01:00Z");
    db.exec("COMMIT");

    expect(db.prepare("SELECT status FROM prediction_datasets WHERE id = 'old'").get()).toMatchObject({ status: "superseded" });
    expect(db.prepare("SELECT status FROM prediction_datasets WHERE id = 'new'").get()).toMatchObject({ status: "active" });
    expect(db.prepare("SELECT value FROM site_state WHERE key = 'active_prediction_dataset_id'").get()).toMatchObject({ value: "new" });
    db.close();
  });

  it("stores validated team colours independently from prediction snapshots", () => {
    const db = createDb();
    db.prepare(
      "INSERT INTO team_colours (team_key, team_name, primary_colour, secondary_colour, source_hash, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("arsenal", "Arsenal", "#EF0107", "#063672", "colour-hash", "2026-08-19T10:00:00Z");

    expect(db.prepare("SELECT primary_colour, secondary_colour FROM team_colours WHERE team_key = 'arsenal'").get())
      .toMatchObject({ primary_colour: "#EF0107", secondary_colour: "#063672" });
    db.close();
  });
});
