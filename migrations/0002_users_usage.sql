-- Migration: Users and Usage Logs for Tiered Access
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- UUID
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- 'user', 'admin', 'beta'
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT, -- NULL for anonymous
  ip TEXT NOT NULL,
  action TEXT NOT NULL, -- 'verdict', 'report_generate', 'ai_chat'
  day TEXT NOT NULL, -- YYYY-MM-DD
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_day_ip ON usage_logs (day, ip);
CREATE INDEX IF NOT EXISTS idx_usage_logs_day_user ON usage_logs (day, user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
