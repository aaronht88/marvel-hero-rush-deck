-- Per-user deck sync payload (keyed by Google JWT `sub`)
CREATE TABLE IF NOT EXISTS user_sync (
  google_sub TEXT PRIMARY KEY NOT NULL,
  email TEXT,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sync_updated ON user_sync(updated_at);
