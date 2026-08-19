PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS prediction_datasets (
  id TEXT PRIMARY KEY,
  source_hash TEXT NOT NULL,
  source_fetched_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  activated_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('building', 'active', 'superseded', 'failed')),
  source_row_count INTEGER NOT NULL DEFAULT 0,
  valid_fixture_count INTEGER NOT NULL DEFAULT 0,
  valid_match_result_count INTEGER NOT NULL DEFAULT 0,
  valid_ou_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_prediction_datasets_status
  ON prediction_datasets(status);

CREATE INDEX IF NOT EXISTS idx_prediction_datasets_created
  ON prediction_datasets(created_at DESC);

CREATE TABLE IF NOT EXISTS predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id TEXT NOT NULL,
  market_id TEXT NOT NULL,

  fixture_date TEXT NOT NULL,
  kickoff_time TEXT,
  country TEXT,
  league TEXT,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,

  match_prediction TEXT,
  match_model_home_probability REAL,
  match_model_draw_probability REAL,
  match_model_away_probability REAL,
  match_model_price REAL,
  match_bookmaker_home_probability REAL,
  match_bookmaker_draw_probability REAL,
  match_bookmaker_away_probability REAL,
  match_bookmaker_price REAL,
  match_edge REAL,
  match_value_classification TEXT,
  match_valid INTEGER NOT NULL DEFAULT 0 CHECK (match_valid IN (0, 1)),

  ou_prediction TEXT,
  ou_model_over_probability REAL,
  ou_model_under_probability REAL,
  ou_model_price REAL,
  ou_bookmaker_over_probability REAL,
  ou_bookmaker_under_probability REAL,
  ou_bookmaker_price REAL,
  ou_edge REAL,
  ou_value_classification TEXT,
  ou_valid INTEGER NOT NULL DEFAULT 0 CHECK (ou_valid IN (0, 1)),

  home_xgoals REAL,
  away_xgoals REAL,
  home_xshots REAL,
  away_xshots REAL,
  home_xshots_on_target REAL,
  away_xshots_on_target REAL,

  fixture_fingerprint TEXT NOT NULL,

  FOREIGN KEY(dataset_id) REFERENCES prediction_datasets(id) ON DELETE CASCADE,
  UNIQUE(dataset_id, market_id)
);

CREATE INDEX IF NOT EXISTS idx_predictions_dataset
  ON predictions(dataset_id);

CREATE INDEX IF NOT EXISTS idx_predictions_match_edge
  ON predictions(dataset_id, match_valid, match_edge DESC);

CREATE INDEX IF NOT EXISTS idx_predictions_ou_edge
  ON predictions(dataset_id, ou_valid, ou_edge DESC);

CREATE INDEX IF NOT EXISTS idx_predictions_date
  ON predictions(dataset_id, fixture_date);

CREATE TABLE IF NOT EXISTS site_stats (
  key TEXT PRIMARY KEY,
  numeric_value REAL,
  text_value TEXT,
  updated_at TEXT NOT NULL,
  source_hash TEXT
);

CREATE TABLE IF NOT EXISTS site_state (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  expected_uk_schedule_hour INTEGER,
  result TEXT,
  prediction_source_http_status INTEGER,
  source_row_count INTEGER NOT NULL DEFAULT 0,
  valid_match_result_count INTEGER NOT NULL DEFAULT 0,
  valid_ou_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  invalid_row_count INTEGER NOT NULL DEFAULT 0,
  source_hash TEXT,
  activated_dataset_id TEXT,
  site_stat_result TEXT,
  error_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_started
  ON sync_runs(started_at DESC);
