CREATE TABLE IF NOT EXISTS workspace (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'company',
  owner_email TEXT,
  plan TEXT NOT NULL DEFAULT 'trial',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS project (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL DEFAULT 'ws_default',
  folder TEXT,
  name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'draft',
  owner_email TEXT,
  updated_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  rev INTEGER NOT NULL DEFAULT 1,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  thumb TEXT,
  doc TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS project_ws_updated ON project (workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS project_folder ON project (workspace_id, folder);

CREATE TABLE IF NOT EXISTS member (
  workspace_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'editor',
  folders TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  PRIMARY KEY (workspace_id, email)
);

CREATE INDEX IF NOT EXISTS member_ws ON member (workspace_id);

CREATE TABLE IF NOT EXISTS app_user (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  picture TEXT,
  kind TEXT NOT NULL DEFAULT 'trial',
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER
);

CREATE TABLE IF NOT EXISTS invite (
  code TEXT PRIMARY KEY,
  email TEXT,
  note TEXT,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS usage (
  workspace_id TEXT NOT NULL,
  period TEXT NOT NULL,
  metric TEXT NOT NULL,
  used REAL NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, period, metric)
);

CREATE TABLE IF NOT EXISTS quota (
  workspace_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  allowed REAL NOT NULL,
  PRIMARY KEY (workspace_id, metric)
);

INSERT OR IGNORE INTO workspace (id, name, kind, plan, created_at) VALUES ('ws_default', 'Darwinbox', 'company', 'company', 1755648000000);
