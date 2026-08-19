import type { ActiveDataset, NormalizedPrediction, SyncResult } from "./types";
import type { TeamColourRecord } from "./team-colours";

export async function getActiveDataset(db: D1Database): Promise<ActiveDataset | null> {
  return (
    (await db
      .prepare(
        `SELECT id, source_hash, source_fetched_at, activated_at,
                valid_fixture_count, valid_match_result_count, valid_ou_count
           FROM prediction_datasets
          WHERE status = 'active'
          ORDER BY activated_at DESC
          LIMIT 1`
      )
      .first<ActiveDataset>()) ?? null
  );
}

export async function createDataset(
  db: D1Database,
  args: {
    id: string;
    sourceHash: string;
    sourceFetchedAt: string;
    sourceRowCount: number;
    validFixtureCount: number;
    validMatchResultCount: number;
    validOuCount: number;
    errorCount: number;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO prediction_datasets (
        id, source_hash, source_fetched_at, created_at, status,
        source_row_count, valid_fixture_count, valid_match_result_count, valid_ou_count, error_count
      ) VALUES (?, ?, ?, ?, 'building', ?, ?, ?, ?, ?)`
    )
    .bind(
      args.id,
      args.sourceHash,
      args.sourceFetchedAt,
      now,
      args.sourceRowCount,
      args.validFixtureCount,
      args.validMatchResultCount,
      args.validOuCount,
      args.errorCount
    )
    .run();
}

function insertStatement(db: D1Database, datasetId: string, p: NormalizedPrediction) {
  return db
    .prepare(
      `INSERT INTO predictions (
        dataset_id, market_id,
        fixture_date, kickoff_time, country, league, home_team, away_team,
        match_prediction, match_model_home_probability, match_model_draw_probability,
        match_model_away_probability, match_model_price,
        match_bookmaker_home_probability, match_bookmaker_draw_probability,
        match_bookmaker_away_probability, match_bookmaker_price,
        match_edge, match_value_classification, match_valid,
        ou_prediction, ou_model_over_probability, ou_model_under_probability, ou_model_price,
        ou_bookmaker_over_probability, ou_bookmaker_under_probability, ou_bookmaker_price,
        ou_edge, ou_value_classification, ou_valid,
        home_xgoals, away_xgoals, home_xshots, away_xshots,
        home_xshots_on_target, away_xshots_on_target, fixture_fingerprint
      ) VALUES (
        ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
      )`
    )
    .bind(
      datasetId,
      p.marketId,
      p.fixtureDate,
      p.kickoffTime,
      p.country,
      p.league,
      p.homeTeam,
      p.awayTeam,
      p.matchPrediction,
      p.matchModelHomeProbability,
      p.matchModelDrawProbability,
      p.matchModelAwayProbability,
      p.matchModelPrice,
      p.matchBookmakerHomeProbability,
      p.matchBookmakerDrawProbability,
      p.matchBookmakerAwayProbability,
      p.matchBookmakerPrice,
      p.matchEdge,
      p.matchValueClassification,
      p.matchValid ? 1 : 0,
      p.ouPrediction,
      p.ouModelOverProbability,
      p.ouModelUnderProbability,
      p.ouModelPrice,
      p.ouBookmakerOverProbability,
      p.ouBookmakerUnderProbability,
      p.ouBookmakerPrice,
      p.ouEdge,
      p.ouValueClassification,
      p.ouValid ? 1 : 0,
      p.homeXGoals,
      p.awayXGoals,
      p.homeXShots,
      p.awayXShots,
      p.homeXShotsOnTarget,
      p.awayXShotsOnTarget,
      p.fixtureFingerprint
    );
}

export async function insertPredictions(
  db: D1Database,
  datasetId: string,
  predictions: NormalizedPrediction[]
): Promise<void> {
  const batchSize = 50;
  for (let i = 0; i < predictions.length; i += batchSize) {
    const statements = predictions
      .slice(i, i + batchSize)
      .map((prediction) => insertStatement(db, datasetId, prediction));
    if (statements.length) await db.batch(statements);
  }
}

export async function verifyDatasetCount(
  db: D1Database,
  datasetId: string,
  expected: number
): Promise<void> {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM predictions WHERE dataset_id = ?")
    .bind(datasetId)
    .first<{ count: number }>();
  if (!row || Number(row.count) !== expected) {
    throw new Error(`Dataset row-count verification failed: expected ${expected}, got ${row?.count}.`);
  }
}

export async function markDatasetFailed(db: D1Database, datasetId: string): Promise<void> {
  await db
    .prepare("UPDATE prediction_datasets SET status = 'failed' WHERE id = ? AND status = 'building'")
    .bind(datasetId)
    .run();
}

export async function activateDataset(db: D1Database, datasetId: string): Promise<void> {
  const now = new Date().toISOString();
  const active = await getActiveDataset(db);

  const statements = [];
  if (active?.id) {
    statements.push(
      db
        .prepare(
          "UPDATE prediction_datasets SET status = 'superseded' WHERE id = ? AND status = 'active'"
        )
        .bind(active.id)
    );
  }

  statements.push(
    db
      .prepare(
        "UPDATE prediction_datasets SET status = 'active', activated_at = ? WHERE id = ? AND status = 'building'"
      )
      .bind(now, datasetId)
  );

  statements.push(
    db
      .prepare(
        `INSERT INTO site_state (key, value, updated_at)
         VALUES ('active_prediction_dataset_id', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .bind(datasetId, now)
  );

  await db.batch(statements);
}

export async function pruneOperationalDatasets(db: D1Database, keepSuccessful = 5): Promise<void> {
  await db
    .prepare(
      `DELETE FROM prediction_datasets
       WHERE status IN ('superseded', 'failed')
         AND id NOT IN (
           SELECT id
           FROM prediction_datasets
           WHERE status IN ('active', 'superseded')
           ORDER BY COALESCE(activated_at, created_at) DESC
           LIMIT ?
         )`
    )
    .bind(keepSuccessful)
    .run();
}

export async function setState(db: D1Database, key: string, value: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO site_state (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(key, value, now)
    .run();
}

export async function getState(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT value FROM site_state WHERE key = ?")
    .bind(key)
    .first<{ value: string | null }>();
  return row?.value ?? null;
}

export async function replaceTeamColours(
  db: D1Database,
  records: TeamColourRecord[],
  sourceHash: string
): Promise<void> {
  const now = new Date().toISOString();
  const batchSize = 50;

  for (let index = 0; index < records.length; index += batchSize) {
    const statements = records.slice(index, index + batchSize).map((record) =>
      db
        .prepare(
          `INSERT INTO team_colours (
             team_key, team_name, primary_colour, secondary_colour, source_hash, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(team_key) DO UPDATE SET
             team_name = excluded.team_name,
             primary_colour = excluded.primary_colour,
             secondary_colour = excluded.secondary_colour,
             source_hash = excluded.source_hash,
             updated_at = excluded.updated_at`
        )
        .bind(
          record.teamKey,
          record.teamName,
          record.primaryColour,
          record.secondaryColour,
          sourceHash,
          now
        )
    );
    if (statements.length) await db.batch(statements);
  }

  // Only remove stale rows after every new/updated row has been written successfully.
  await db.prepare("DELETE FROM team_colours WHERE source_hash <> ?").bind(sourceHash).run();
  await setState(db, "team_colour_source_hash", sourceHash);
  await setState(db, "last_successful_team_colour_sync", now);
}

export async function getTeamColours(db: D1Database): Promise<Array<{
  team_key: string;
  team_name: string;
  primary_colour: string;
  secondary_colour: string;
}>> {
  const result = await db
    .prepare(
      `SELECT team_key, team_name, primary_colour, secondary_colour
         FROM team_colours
        ORDER BY team_key`
    )
    .all<{
      team_key: string;
      team_name: string;
      primary_colour: string;
      secondary_colour: string;
    }>();
  return result.results ?? [];
}

export async function upsertFixtureCount(
  db: D1Database,
  value: number,
  sourceHash: string
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO site_stats (key, numeric_value, updated_at, source_hash)
       VALUES ('fixtures_processed', ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         numeric_value = excluded.numeric_value,
         updated_at = excluded.updated_at,
         source_hash = excluded.source_hash`
    )
    .bind(value, now, sourceHash)
    .run();
  await setState(db, "last_site_stats_sync", now);
}

export async function getFixtureCount(
  db: D1Database
): Promise<{ value: number | null; updatedAt: string | null }> {
  const row = await db
    .prepare(
      "SELECT numeric_value AS value, updated_at AS updatedAt FROM site_stats WHERE key = 'fixtures_processed'"
    )
    .first<{ value: number | null; updatedAt: string | null }>();

  return row ?? { value: null, updatedAt: null };
}

export async function createSyncRun(
  db: D1Database,
  id: string,
  expectedUkScheduleHour: number | null
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sync_runs (id, started_at, expected_uk_schedule_hour)
       VALUES (?, ?, ?)`
    )
    .bind(id, new Date().toISOString(), expectedUkScheduleHour)
    .run();
}

export async function finishSyncRun(
  db: D1Database,
  id: string,
  details: {
    result: SyncResult;
    predictionSourceHttpStatus?: number | null;
    sourceRowCount?: number;
    validMatchResultCount?: number;
    validOuCount?: number;
    duplicateCount?: number;
    invalidRowCount?: number;
    sourceHash?: string | null;
    activatedDatasetId?: string | null;
    siteStatResult?: string | null;
    errorSummary?: string | null;
  }
): Promise<void> {
  await db
    .prepare(
      `UPDATE sync_runs SET
        finished_at = ?,
        result = ?,
        prediction_source_http_status = ?,
        source_row_count = ?,
        valid_match_result_count = ?,
        valid_ou_count = ?,
        duplicate_count = ?,
        invalid_row_count = ?,
        source_hash = ?,
        activated_dataset_id = ?,
        site_stat_result = ?,
        error_summary = ?
       WHERE id = ?`
    )
    .bind(
      new Date().toISOString(),
      details.result,
      details.predictionSourceHttpStatus ?? null,
      details.sourceRowCount ?? 0,
      details.validMatchResultCount ?? 0,
      details.validOuCount ?? 0,
      details.duplicateCount ?? 0,
      details.invalidRowCount ?? 0,
      details.sourceHash ?? null,
      details.activatedDatasetId ?? null,
      details.siteStatResult ?? null,
      details.errorSummary?.slice(0, 1000) ?? null,
      id
    )
    .run();
}
