CREATE TABLE IF NOT EXISTS team_colours (
  team_key TEXT PRIMARY KEY,
  team_name TEXT NOT NULL,
  primary_colour TEXT NOT NULL,
  secondary_colour TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_colours_name
  ON team_colours(team_name);
