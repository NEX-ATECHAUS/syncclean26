// src/db/index.js
// Initialises SQLite (swappable for Postgres via better-sqlite3 → pg)
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH || './data/cleansync.db';
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  -- Users
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    name        TEXT,
    created_at  INTEGER DEFAULT (unixepoch()),
    updated_at  INTEGER DEFAULT (unixepoch())
  );

  -- Magic link tokens
  CREATE TABLE IF NOT EXISTS magic_tokens (
    id          TEXT PRIMARY KEY,
    user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    token       TEXT UNIQUE NOT NULL,
    expires_at  INTEGER NOT NULL,
    used        INTEGER DEFAULT 0,
    created_at  INTEGER DEFAULT (unixepoch())
  );

  -- JWT refresh tokens
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          TEXT PRIMARY KEY,
    user_id     TEXT REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT UNIQUE NOT NULL,
    expires_at  INTEGER NOT NULL,
    created_at  INTEGER DEFAULT (unixepoch())
  );

  -- Connected platform credentials (encrypted at rest)
  CREATE TABLE IF NOT EXISTS connections (
    id            TEXT PRIMARY KEY,
    user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,
    platform      TEXT NOT NULL,          -- hubspot | salesforce | pipedrive | ...
    display_name  TEXT,
    auth_type     TEXT NOT NULL,          -- oauth | api_key | basic
    credentials   TEXT NOT NULL,          -- JSON, AES-256-GCM encrypted
    scopes        TEXT,                   -- comma-separated OAuth scopes
    status        TEXT DEFAULT 'active',  -- active | error | expired
    last_synced   INTEGER,
    created_at    INTEGER DEFAULT (unixepoch()),
    updated_at    INTEGER DEFAULT (unixepoch()),
    UNIQUE(user_id, platform)
  );

  -- Custom API connections (discovered via AI doc reading)
  CREATE TABLE IF NOT EXISTS custom_connections (
    id            TEXT PRIMARY KEY,
    user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    docs_url      TEXT,
    base_url      TEXT NOT NULL,
    auth_config   TEXT NOT NULL,          -- JSON (encrypted)
    modules       TEXT,                   -- JSON array of discovered modules
    fields        TEXT,                   -- JSON map of module -> fields
    status        TEXT DEFAULT 'active',
    created_at    INTEGER DEFAULT (unixepoch())
  );

  -- Sync jobs
  CREATE TABLE IF NOT EXISTS sync_jobs (
    id              TEXT PRIMARY KEY,
    user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,
    source_id       TEXT NOT NULL,        -- connection id
    destination_id  TEXT NOT NULL,        -- connection id
    direction       TEXT NOT NULL,        -- one_way | bidirectional
    field_map       TEXT,                 -- JSON
    dedup_rules     TEXT,                 -- JSON
    merge_strategy  TEXT,
    schedule        TEXT,                 -- cron string or 'manual'
    conflict_policy TEXT DEFAULT 'newest_wins',
    status          TEXT DEFAULT 'idle',  -- idle | running | done | error
    last_run        INTEGER,
    next_run        INTEGER,
    stats           TEXT,                 -- JSON: {total, merged, synced, errors}
    created_at      INTEGER DEFAULT (unixepoch())
  );

  -- Audit log of every sync run
  CREATE TABLE IF NOT EXISTS sync_runs (
    id          TEXT PRIMARY KEY,
    job_id      TEXT REFERENCES sync_jobs(id) ON DELETE CASCADE,
    started_at  INTEGER DEFAULT (unixepoch()),
    finished_at INTEGER,
    status      TEXT,
    records_in  INTEGER DEFAULT 0,
    records_out INTEGER DEFAULT 0,
    dupes_found INTEGER DEFAULT 0,
    errors      INTEGER DEFAULT 0,
    log         TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_magic_tokens_token   ON magic_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_connections_user     ON connections(user_id);
  CREATE INDEX IF NOT EXISTS idx_sync_jobs_user       ON sync_jobs(user_id);
  CREATE INDEX IF NOT EXISTS idx_sync_runs_job        ON sync_runs(job_id);
`);

module.exports = db;
