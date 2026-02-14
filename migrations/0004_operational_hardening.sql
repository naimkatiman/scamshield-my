CREATE TABLE IF NOT EXISTS rate_limit_counters (
  counter_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_reset_at ON rate_limit_counters (reset_at);

CREATE TABLE IF NOT EXISTS community_report_identifiers (
  report_id INTEGER NOT NULL,
  identifier_key TEXT NOT NULL,
  identifier_value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES community_reports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_identifiers_normalized
  ON community_report_identifiers (normalized_value, created_at);
CREATE INDEX IF NOT EXISTS idx_report_identifiers_report_id
  ON community_report_identifiers (report_id);

CREATE VIRTUAL TABLE IF NOT EXISTS community_reports_fts USING fts5(
  narrative,
  tokenize='unicode61'
);

CREATE TABLE IF NOT EXISTS gamification_idempotency_keys (
  idempotency_key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gamification_idempotency_scope_user
  ON gamification_idempotency_keys (scope, user_id, created_at DESC);
