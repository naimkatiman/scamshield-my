CREATE TABLE IF NOT EXISTS community_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reporter_session TEXT NOT NULL,
  platform TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  identifiers_json TEXT NOT NULL,
  narrative TEXT NOT NULL,
  evidence_r2_keys_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
);

CREATE INDEX IF NOT EXISTS idx_community_reports_created_at ON community_reports (created_at);
CREATE INDEX IF NOT EXISTS idx_community_reports_platform_category ON community_reports (platform, category);

CREATE TABLE IF NOT EXISTS verdict_cache (
  key TEXT PRIMARY KEY,
  verdict TEXT NOT NULL,
  score INTEGER NOT NULL,
  reasons_json TEXT NOT NULL,
  sources_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint_hash TEXT NOT NULL,
  platform TEXT NOT NULL,
  category TEXT NOT NULL,
  count_7d INTEGER NOT NULL DEFAULT 0,
  count_prev_7d INTEGER NOT NULL DEFAULT 0,
  trend TEXT NOT NULL DEFAULT '→',
  last_seen_at TEXT NOT NULL,
  UNIQUE(fingerprint_hash, platform, category)
);

CREATE TABLE IF NOT EXISTS warning_pages (
  slug TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verdict TEXT NOT NULL,
  headline TEXT NOT NULL,
  identifiers_json TEXT NOT NULL,
  reasons_json TEXT NOT NULL,
  og_image_r2_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_platform_category_counts (
  day TEXT NOT NULL,
  platform TEXT NOT NULL,
  category TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, platform, category)
);